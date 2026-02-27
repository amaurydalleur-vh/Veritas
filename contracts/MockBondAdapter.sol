// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBondAdapter.sol";

/// @notice Simple adapter mock:
/// - accepts USDC deposits
/// - holds underlying in-contract
/// - supports instant redeem from available balance
/// - optional yield donation via `donateYield`
contract MockBondAdapter is Ownable, IBondAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function asset() external view returns (address) {
        return address(usdc);
    }

    function totalManagedAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function availableLiquidity() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        require(assets > 0, "Zero assets");
        uint256 aumBefore = totalManagedAssets();
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        if (totalShares == 0 || aumBefore == 0) {
            sharesOut = assets;
        } else {
            sharesOut = (assets * totalShares) / aumBefore;
        }
        require(sharesOut > 0, "Dust deposit");
        totalShares += sharesOut;
        shares[msg.sender] += sharesOut;
    }

    function previewRedeem(uint256 assets) public view returns (uint256 sharesBurned) {
        require(assets > 0, "Zero assets");
        uint256 aum = totalManagedAssets();
        require(aum > 0 && totalShares > 0, "No liquidity");
        sharesBurned = (assets * totalShares + aum - 1) / aum; // round up
    }

    function redeem(uint256 assets, address to) external returns (uint256 sharesBurned) {
        sharesBurned = previewRedeem(assets);
        require(shares[msg.sender] >= sharesBurned, "Insufficient shares");
        shares[msg.sender] -= sharesBurned;
        totalShares -= sharesBurned;
        usdc.safeTransfer(to, assets);
    }

    /// @notice Simulate external yield accrual by sending USDC into adapter.
    function donateYield(uint256 amount) external {
        require(amount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }
}

