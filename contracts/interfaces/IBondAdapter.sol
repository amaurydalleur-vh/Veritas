// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBondAdapter {
    function asset() external view returns (address);
    function totalManagedAssets() external view returns (uint256);
    function availableLiquidity() external view returns (uint256);
    function deposit(uint256 assets) external returns (uint256 sharesOut);
    function redeem(uint256 assets, address to) external returns (uint256 sharesBurned);
    function previewRedeem(uint256 assets) external view returns (uint256 sharesBurned);
}

