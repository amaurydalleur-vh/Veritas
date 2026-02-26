// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockOracle
/// @notice Testnet oracle. Owner resolves markets with YES (true) or NO (false).
/// @dev In production, replace with Chainlink / UMA / Pyth.
contract MockOracle is Ownable {
    struct Resolution {
        bool resolved;
        bool outcome; // true = YES wins, false = NO wins
        uint256 resolvedAt;
    }

    mapping(address => Resolution) public resolutions;

    event MarketResolved(address indexed market, bool outcome, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    /// @notice Resolve a market. Can only be called once per market.
    function resolve(address market, bool outcome) external onlyOwner {
        require(!resolutions[market].resolved, "Already resolved");
        resolutions[market] = Resolution({
            resolved: true,
            outcome: outcome,
            resolvedAt: block.timestamp
        });
        emit MarketResolved(market, outcome, block.timestamp);
    }

    /// @notice Check if a market is resolved and get the outcome
    function getResolution(address market) external view returns (bool resolved, bool outcome) {
        Resolution memory r = resolutions[market];
        return (r.resolved, r.outcome);
    }
}
