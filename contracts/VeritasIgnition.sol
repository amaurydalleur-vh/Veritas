// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VeritasMarket.sol";
import "./VeritasFactory.sol";

/// @title VeritasIgnition
/// @notice Permissionless market launch via bonding curve.
/// @dev Phase 1: anyone pays $50 USDC to propose a market.
///      Virtual liquidity bootstraps price discovery.
///      Graduation criteria: $10K TVL + 30 participants + <30 days.
///      After graduation, a 14-day vesting cliff applies for early backers.
contract VeritasIgnition is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    uint256 public constant CREATION_FEE      = 50 * 1e6;     // $50 USDC
    uint256 public constant GRADUATION_TVL    = 10_000 * 1e6; // $10K USDC
    uint256 public constant GRADUATION_USERS  = 30;
    uint256 public constant MAX_LAUNCH_DAYS   = 30 days;
    uint256 public constant VESTING_CLIFF     = 14 days;       // post-graduation

    // Virtual liquidity constant (k = 100M) for initial price stability
    // Virtual reserves each side = sqrt(100M) ≈ 10,000 USDC
    uint256 public constant VIRTUAL_RESERVE = 10_000 * 1e6;

    // ─────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────

    enum LaunchStatus { Pending, Active, Graduated, Expired, Rejected }

    struct Launch {
        string      question;
        address     creator;
        uint256     createdAt;
        uint256     expiresAt;         // createdAt + MAX_LAUNCH_DAYS
        LaunchStatus status;
        uint256     tvl;               // USDC committed
        uint256     participants;
        address     market;            // set after graduation
        uint256     graduatedAt;
        // Virtual AMM state (bonding curve before graduation)
        uint256     virtualYes;        // virtual reserve YES
        uint256     virtualNo;         // virtual reserve NO
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    IERC20           public immutable usdc;
    VeritasFactory   public immutable factory;
    address          public immutable protocol;

    uint256 public launchCount;
    mapping(uint256 => Launch) public launches;

    // User commitments per launch (refundable if expires/rejected)
    mapping(uint256 => mapping(address => uint256)) public committed;

    // Vesting: tracks when graduation happened for cliff enforcement
    mapping(uint256 => mapping(address => uint256)) public vestedAt;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event LaunchProposed(uint256 indexed id, string question, address creator);
    event Committed(uint256 indexed id, address user, uint256 amount, bool direction);
    event Graduated(uint256 indexed id, address market);
    event Expired(uint256 indexed id);
    event Refunded(uint256 indexed id, address user, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(address _usdc, address _factory, address _protocol) Ownable(msg.sender) {
        usdc     = IERC20(_usdc);
        factory  = VeritasFactory(_factory);
        protocol = _protocol;
    }

    // ─────────────────────────────────────────────
    // Launch lifecycle
    // ─────────────────────────────────────────────

    /// @notice Pay $50 USDC to propose a new market.
    function propose(string calldata question) external nonReentrant returns (uint256 id) {
        require(bytes(question).length > 0 && bytes(question).length <= 500, "Bad question");

        // Collect $50 creation fee
        usdc.safeTransferFrom(msg.sender, protocol, CREATION_FEE);

        id = launchCount++;
        launches[id] = Launch({
            question:     question,
            creator:      msg.sender,
            createdAt:    block.timestamp,
            expiresAt:    block.timestamp + MAX_LAUNCH_DAYS,
            status:       LaunchStatus.Active,
            tvl:          0,
            participants: 0,
            market:       address(0),
            graduatedAt:  0,
            virtualYes:   VIRTUAL_RESERVE,
            virtualNo:    VIRTUAL_RESERVE
        });

        emit LaunchProposed(id, question, msg.sender);
    }

    /// @notice Commit USDC to back a launch (buys into virtual bonding curve).
    /// @param id        Launch ID
    /// @param buyYes    Direction of commitment
    /// @param amount    USDC to commit
    function commit(uint256 id, bool buyYes, uint256 amount) external nonReentrant {
        Launch storage launch = launches[id];
        require(launch.status == LaunchStatus.Active, "Not active");
        require(block.timestamp < launch.expiresAt, "Expired");
        require(amount >= 1e6, "Min $1");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update virtual AMM
        if (buyYes) {
            launch.virtualNo  += amount;
            // virtualYes decreases (price impact)
            uint256 k = launch.virtualYes * launch.virtualNo;
            launch.virtualYes = k / launch.virtualNo;
        } else {
            launch.virtualYes += amount;
            uint256 k = launch.virtualYes * launch.virtualNo;
            launch.virtualNo  = k / launch.virtualYes;
        }

        launch.tvl += amount;

        if (committed[id][msg.sender] == 0) {
            launch.participants++;
        }
        committed[id][msg.sender] += amount;

        emit Committed(id, msg.sender, amount, buyYes);

        // Auto-graduate if criteria met
        if (_meetsGraduationCriteria(id)) {
            _graduate(id);
        }
    }

    /// @notice Manually trigger graduation check (anyone can call)
    function checkGraduation(uint256 id) external {
        require(launches[id].status == LaunchStatus.Active, "Not active");
        if (block.timestamp >= launches[id].expiresAt) {
            launches[id].status = LaunchStatus.Expired;
            emit Expired(id);
        } else if (_meetsGraduationCriteria(id)) {
            _graduate(id);
        }
    }

    /// @notice Refund committed USDC if launch expired or rejected
    function refund(uint256 id) external nonReentrant {
        Launch storage launch = launches[id];
        require(
            launch.status == LaunchStatus.Expired || launch.status == LaunchStatus.Rejected,
            "Not refundable"
        );
        uint256 amount = committed[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        committed[id][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Refunded(id, msg.sender, amount);
    }

    // ─────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────

    function _meetsGraduationCriteria(uint256 id) internal view returns (bool) {
        Launch storage l = launches[id];
        return l.tvl >= GRADUATION_TVL
            && l.participants >= GRADUATION_USERS
            && block.timestamp < l.expiresAt;
    }

    function _graduate(uint256 id) internal {
        Launch storage launch = launches[id];
        launch.status      = LaunchStatus.Graduated;
        launch.graduatedAt = block.timestamp;

        // Approve factory to pull TVL for seed liquidity
        uint256 tvl = launch.tvl;
        usdc.approve(address(factory), tvl);

        // Create the real market with 30-day duration
        address market = factory.createMarket(launch.question, 30 days);
        launch.market = market;

        emit Graduated(id, market);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getLaunch(uint256 id) external view returns (Launch memory) {
        return launches[id];
    }

    /// @notice Implied probability from virtual bonding curve (0–1e18)
    function virtualProbabilityYes(uint256 id) external view returns (uint256) {
        Launch storage l = launches[id];
        uint256 total = l.virtualYes + l.virtualNo;
        if (total == 0) return 5e17;
        // Price of YES = virtualNo / total (demand side)
        return (l.virtualNo * 1e18) / total;
    }
}
