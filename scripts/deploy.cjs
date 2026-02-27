/**
 * deploy.js
 * Deploys all Veritas contracts to Arbitrum Sepolia testnet.
 * Run: npx hardhat run scripts/deploy.js --network arbitrumSepolia
 */

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n=== VERITAS DEPLOYMENT ===");
  console.log("Deployer :", deployer.address);
  console.log("Network  :", hre.network.name);
  console.log("Chain ID :", (await hre.ethers.provider.getNetwork()).chainId);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance  :", hre.ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund it from an Arbitrum Sepolia faucet first.");
  }

  // ── 1. MockUSDC ──────────────────────────────────────────────
  console.log("Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed   :", usdcAddress);

  // ── 2. MockOracle ─────────────────────────────────────────────
  console.log("Deploying MockOracle...");
  const MockOracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("MockOracle deployed :", oracleAddress);

  // ── 3. VeritasFactory ─────────────────────────────────────────
  console.log("Deploying VeritasFactory...");
  const VeritasFactory = await hre.ethers.getContractFactory("VeritasFactory");
  const factory = await VeritasFactory.deploy(usdcAddress, oracleAddress, deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("VeritasFactory deployed:", factoryAddress);

  // ── 4. VeritasIgnition ────────────────────────────────────────
  console.log("Deploying VeritasIgnition...");
  const VeritasIgnition = await hre.ethers.getContractFactory("VeritasIgnition");
  const ignition = await VeritasIgnition.deploy(usdcAddress, factoryAddress, deployer.address);
  await ignition.waitForDeployment();
  const ignitionAddress = await ignition.getAddress();
  console.log("VeritasIgnition deployed:", ignitionAddress);

  // ── 5. VeritasDutchAuction ────────────────────────────────────
  console.log("Deploying VeritasDutchAuction...");
  const VeritasDutchAuction = await hre.ethers.getContractFactory("VeritasDutchAuction");
  const dutchAuction = await VeritasDutchAuction.deploy(usdcAddress, factoryAddress);
  await dutchAuction.waitForDeployment();
  const dutchAuctionAddress = await dutchAuction.getAddress();
  console.log("VeritasDutchAuction deployed:", dutchAuctionAddress);

  // Register Dutch Auction as authorized creator in the factory
  console.log("Registering Dutch Auction as authorized creator...");
  await (await factory.setAuthorizedCreator(dutchAuctionAddress, true)).wait();
  console.log("Dutch Auction registered.");

  // Register Ignition as authorized creator for custom-seed graduation markets
  console.log("Registering Ignition as authorized creator...");
  await (await factory.setAuthorizedCreator(ignitionAddress, true)).wait();
  console.log("Ignition registered.");

  // ── 6. Seed 3 example markets ─────────────────────────────────
  console.log("\nSeeding example markets...");

  // Approve factory to pull seed liquidity (200 USDC * 3 markets = 600 USDC)
  const seedPerMarket = 200n * 1_000_000n; // 200 USDC (6 decimals)
  await (await usdc.approve(factoryAddress, seedPerMarket * 3n)).wait();

  const markets = [
    { question: "Will the Fed cut rates in Q3 2025?",           duration: 90 * 24 * 3600 },
    { question: "Will ETH exceed $5,000 before Jan 1, 2026?",  duration: 60 * 24 * 3600 },
    { question: "Will the US CPI print below 3% in May 2025?", duration: 45 * 24 * 3600 },
  ];

  const deployedMarkets = [];
  for (const m of markets) {
    const tx = await factory.createMarket(m.question, m.duration);
    const receipt = await tx.wait();
    // Find the MarketCreated event
    const event = receipt.logs
      .map(log => { try { return factory.interface.parseLog(log); } catch { return null; } })
      .find(e => e && e.name === "MarketCreated");
    const marketAddress = event ? event.args.market : "unknown";
    deployedMarkets.push({ question: m.question, address: marketAddress });
    console.log("Market created:", marketAddress, "-", m.question);
  }

  // ── 6. Write deployment artifacts ────────────────────────────
  const deployment = {
    network:     hre.network.name,
    chainId:     Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer:    deployer.address,
    deployedAt:  new Date().toISOString(),
    contracts: {
      MockUSDC:             usdcAddress,
      MockOracle:           oracleAddress,
      VeritasFactory:       factoryAddress,
      VeritasIgnition:      ignitionAddress,
      VeritasDutchAuction:  dutchAuctionAddress,
    },
    seedMarkets: deployedMarkets,
  };

  // Write to src/contracts/deployment.json (used by React frontend)
  const outDir = path.join(__dirname, "../src/contracts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );

  // Also write ABI files for the frontend
  await writeABI(hre, "MockUSDC",             outDir);
  await writeABI(hre, "MockOracle",           outDir);
  await writeABI(hre, "VeritasMarket",        outDir);
  await writeABI(hre, "VeritasFactory",       outDir);
  await writeABI(hre, "VeritasIgnition",      outDir);
  await writeABI(hre, "VeritasDutchAuction",  outDir);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Artifacts written to src/contracts/");
  console.log("\nAdd these to your .env:");
  console.log(`VITE_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`VITE_IGNITION_ADDRESS=${ignitionAddress}`);
  console.log(`VITE_USDC_ADDRESS=${usdcAddress}`);
  console.log(`VITE_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`VITE_DUTCH_AUCTION_ADDRESS=${dutchAuctionAddress}`);
  console.log(`VITE_CHAIN_ID=421614`);
  console.log("\nFaucet test USDC: call usdc.faucet() from your wallet address.");
}

async function writeABI(hre, contractName, outDir) {
  const artifact = await hre.artifacts.readArtifact(contractName);
  fs.writeFileSync(
    path.join(outDir, `${contractName}.json`),
    JSON.stringify({ abi: artifact.abi }, null, 2)
  );
  console.log(`ABI written: src/contracts/${contractName}.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
