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
    uint256 public constant VESTING_CLIFF     = 14 days;       // linear vesting window post-graduation

    // Virtual liquidity constant (k = 100M) for initial price stability
    // Virtual reserves each side = sqrt(100M) ≈ 10,000 USDC
    uint256 public constant VIRTUAL_RESERVE = 10_000 * 1e6;
    // Graduation anti-hype shift: move 5% from majority seed side to minority seed side.
    uint256 public constant MINORITY_INJECTION_BPS = 500;

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
        uint256     seedYes;
        uint256     seedNo;
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
    mapping(uint256 => mapping(address => uint256)) public claimedYes;
    mapping(uint256 => mapping(address => uint256)) public claimedNo;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event LaunchProposed(uint256 indexed id, string question, address creator);
    event Committed(uint256 indexed id, address user, uint256 amount, bool direction);
    event Graduated(uint256 indexed id, address market);
    event Expired(uint256 indexed id);
    event Rejected(uint256 indexed id);
    event Refunded(uint256 indexed id, address user, uint256 amount);
    event VestedClaimed(uint256 indexed id, address user, uint256 sharesYes, uint256 sharesNo);

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
            seedYes:      0,
            seedNo:       0,
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

        // Update virtual AMM from prior state (constant-product invariant).
        uint256 oldYes = launch.virtualYes;
        uint256 oldNo  = launch.virtualNo;
        uint256 k      = oldYes * oldNo;
        if (buyYes) {
            uint256 newNo = oldNo + amount;
            uint256 newYes = k / newNo;
            launch.virtualNo  = newNo;
            launch.virtualYes = newYes;
        } else {
            uint256 newYes = oldYes + amount;
            uint256 newNo = k / newYes;
            launch.virtualYes = newYes;
            launch.virtualNo  = newNo;
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
        launch.tvl -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Refunded(id, msg.sender, amount);
    }

    /// @notice Reject an active launch (governance/admin safeguard). Enables refunds.
    function rejectLaunch(uint256 id) external onlyOwner {
        Launch storage launch = launches[id];
        require(launch.status == LaunchStatus.Active, "Not active");
        launch.status = LaunchStatus.Rejected;
        emit Rejected(id);
    }

    /// @notice Claim vested LP shares after graduation (linear vesting over 14 days).
    function claimVested(uint256 id) external nonReentrant {
        Launch storage launch = launches[id];
        require(launch.status == LaunchStatus.Graduated, "Not graduated");

        uint256 deposited = committed[id][msg.sender];
        require(deposited > 0, "No commitment");
        require(launch.tvl > 0, "Bad launch TVL");

        uint256 elapsed = block.timestamp - launch.graduatedAt;
        if (elapsed > VESTING_CLIFF) elapsed = VESTING_CLIFF;
        uint256 vestedBps = (elapsed * 10_000) / VESTING_CLIFF;

        uint256 totalEntitledYes = (deposited * launch.seedYes) / launch.tvl;
        uint256 totalEntitledNo  = (deposited * launch.seedNo)  / launch.tvl;

        uint256 vestedYes = (totalEntitledYes * vestedBps) / 10_000;
        uint256 vestedNo  = (totalEntitledNo  * vestedBps) / 10_000;

        uint256 claimYes = vestedYes - claimedYes[id][msg.sender];
        uint256 claimNo  = vestedNo  - claimedNo[id][msg.sender];
        require(claimYes > 0 || claimNo > 0, "Nothing claimable");

        claimedYes[id][msg.sender] += claimYes;
        claimedNo[id][msg.sender]  += claimNo;

        VeritasMarket(launch.market).transferLPSharesFromAuction(msg.sender, claimYes, claimNo);
        emit VestedClaimed(id, msg.sender, claimYes, claimNo);
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

        // Seed the market with 100% of Ignition TVL.
        uint256 tvl = launch.tvl;
        require(tvl > 1, "Insufficient TVL");

        // Translate virtual state into initial reserve split.
        uint256 pYes = (launch.virtualNo * 1e18) / (launch.virtualYes + launch.virtualNo);
        uint256 seedNo  = (tvl * pYes) / 1e18;
        uint256 seedYes = tvl - seedNo;

        // Ensure both sides have strictly positive seed.
        if (seedYes == 0) {
            seedYes = 1;
            seedNo = tvl - 1;
        } else if (seedNo == 0) {
            seedNo = 1;
            seedYes = tvl - 1;
        }

        // Minority-side injection at graduation (anti-hype balancing).
        uint256 injection = (tvl * MINORITY_INJECTION_BPS) / 10_000;
        if (injection > 0) {
            if (seedYes > seedNo) {
                uint256 shift = injection;
                if (shift >= seedYes) shift = seedYes - 1;
                seedYes -= shift;
                seedNo  += shift;
            } else if (seedNo > seedYes) {
                uint256 shift = injection;
                if (shift >= seedNo) shift = seedNo - 1;
                seedNo  -= shift;
                seedYes += shift;
            }
        }

        launch.seedYes = seedYes;
        launch.seedNo  = seedNo;

        usdc.approve(address(factory), 0);
        usdc.approve(address(factory), tvl);

        // Create the real market with 30-day duration and transfer LP shares to this contract.
        address market = factory.createMarketWithCustomSeed(launch.question, 30 days, seedYes, seedNo);
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
