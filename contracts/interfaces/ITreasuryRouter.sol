// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryRouter {
    function depositFromSource(uint256 amount) external;
    function requestLiquidity(uint256 amount, address to) external returns (uint256 provided);
}

