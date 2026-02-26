/**
 * generate-wallet.js
 * Creates a fresh testnet-only deployer wallet and prints the private key.
 * Run: node scripts/generate-wallet.js
 */

const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();

console.log("\n========================================");
console.log("  VERITAS TESTNET DEPLOYER WALLET");
console.log("========================================");
console.log("Address    :", wallet.address);
console.log("Private Key:", wallet.privateKey);
console.log("Mnemonic   :", wallet.mnemonic.phrase);
console.log("========================================");
console.log("\nNEXT STEPS:");
console.log("1. Copy the Private Key above");
console.log("2. Create a .env file in the project root:");
console.log("   cp .env.example .env");
console.log("3. Paste the key as DEPLOYER_PRIVATE_KEY in .env");
console.log("4. Fund this address with Arbitrum Sepolia ETH:");
console.log("   https://faucet.quicknode.com/arbitrum/sepolia");
console.log("   or: https://www.alchemy.com/faucets/arbitrum-sepolia");
console.log("5. Once funded, run:");
console.log("   node scripts/deploy.js");
console.log("\nWARNING: Save your mnemonic securely.");
console.log("NEVER use this wallet for real funds.\n");
