// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Testnet USDC with 6 decimals. Anyone can mint up to 10,000 USDC per call.
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6; // 10,000 USDC

    constructor() ERC20("USD Coin (Testnet)", "USDC") Ownable(msg.sender) {
        // Mint 1M to deployer for seeding liquidity
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Free faucet — get 10,000 USDC for testing
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint arbitrary amounts (for seeding markets)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
