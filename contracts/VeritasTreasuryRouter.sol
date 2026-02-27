// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBondAdapter.sol";

/// @notice Shared treasury router for source contracts (OrderBook / Market).
/// Sources can deposit idle USDC and request on-demand liquidity.
contract VeritasTreasuryRouter is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IBondAdapter public adapter;

    mapping(address => bool) public allowedSource;
    mapping(address => uint256) public principalBySource;
    uint256 public totalPrincipal;
    uint256 public bufferBps = 1000; // 10% liquid buffer by default

    event SourceSet(address indexed source, bool allowed);
    event AdapterSet(address indexed adapter);
    event SourceDeposited(address indexed source, uint256 amount);
    event LiquidityProvided(address indexed source, address indexed to, uint256 amount);
    event Invested(uint256 amount);
    event Divested(uint256 amount);
    event BufferUpdated(uint256 bufferBps);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero usdc");
        usdc = IERC20(_usdc);
    }

    modifier onlySource() {
        require(allowedSource[msg.sender], "Not source");
        _;
    }

    function setSource(address source, bool allowed) external onlyOwner {
        require(source != address(0), "Zero source");
        allowedSource[source] = allowed;
        emit SourceSet(source, allowed);
    }

    function setAdapter(address _adapter) external onlyOwner {
        adapter = IBondAdapter(_adapter);
        emit AdapterSet(_adapter);
    }

    /// @notice Set liquid buffer in basis points over total principal obligations.
    function setBufferBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "Buffer too high");
        bufferBps = bps;
        emit BufferUpdated(bps);
    }

    /// @notice Source deposits USDC into router principal ledger.
    function depositFromSource(uint256 amount) external onlySource {
        require(amount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        principalBySource[msg.sender] += amount;
        totalPrincipal += amount;
        emit SourceDeposited(msg.sender, amount);
    }

    /// @notice Source asks router for USDC liquidity.
    function requestLiquidity(uint256 amount, address to)
        external
        onlySource
        returns (uint256 provided)
    {
        require(to != address(0), "Zero to");
        require(amount > 0, "Zero amount");
        require(principalBySource[msg.sender] >= amount, "Exceeds principal");

        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amount && address(adapter) != address(0)) {
            uint256 need = amount - bal;
            uint256 liquid = adapter.availableLiquidity();
            if (liquid > 0) {
                if (need > liquid) need = liquid;
                adapter.redeem(need, address(this));
            }
        }

        provided = usdc.balanceOf(address(this));
        if (provided > amount) provided = amount;
        require(provided == amount, "Insufficient router liquidity");

        principalBySource[msg.sender] -= provided;
        totalPrincipal -= provided;
        usdc.safeTransfer(to, provided);
        emit LiquidityProvided(msg.sender, to, provided);
    }

    /// @notice Owner invests idle router USDC into adapter.
    function invest(uint256 amount) external onlyOwner {
        require(address(adapter) != address(0), "No adapter");
        require(amount > 0, "Zero amount");
        uint256 bal = usdc.balanceOf(address(this));
        require(amount <= bal, "Insufficient cash");
        uint256 minBuffer = (totalPrincipal * bufferBps) / 10_000;
        require(bal - amount >= minBuffer, "Breaches buffer");
        usdc.safeIncreaseAllowance(address(adapter), amount);
        adapter.deposit(amount);
        emit Invested(amount);
    }

    /// @notice Owner pulls USDC back from adapter into router buffer.
    function divest(uint256 amount) external onlyOwner {
        require(address(adapter) != address(0), "No adapter");
        require(amount > 0, "Zero amount");
        adapter.redeem(amount, address(this));
        emit Divested(amount);
    }

    function totalManagedAssets() public view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        if (address(adapter) == address(0)) return bal;
        return bal + adapter.totalManagedAssets();
    }

    function accruedYield() external view returns (uint256) {
        uint256 aum = totalManagedAssets();
        if (aum <= totalPrincipal) return 0;
        return aum - totalPrincipal;
    }
}
