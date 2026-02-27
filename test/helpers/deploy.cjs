const { ethers } = require("hardhat");

const USDC_DECIMALS = 6n;
const USDC_UNIT = 10n ** USDC_DECIMALS;

function usdc(amount) {
  return BigInt(amount) * USDC_UNIT;
}

async function deployCore() {
  const [owner] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdcToken = await MockUSDC.deploy();
  await usdcToken.waitForDeployment();

  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();

  const VeritasFactory = await ethers.getContractFactory("VeritasFactory");
  const factory = await VeritasFactory.deploy(
    await usdcToken.getAddress(),
    await oracle.getAddress(),
    owner.address
  );
  await factory.waitForDeployment();

  const VeritasIgnition = await ethers.getContractFactory("VeritasIgnition");
  const ignition = await VeritasIgnition.deploy(
    await usdcToken.getAddress(),
    await factory.getAddress(),
    owner.address
  );
  await ignition.waitForDeployment();

  const VeritasDutchAuction = await ethers.getContractFactory("VeritasDutchAuction");
  const dutchAuction = await VeritasDutchAuction.deploy(
    await usdcToken.getAddress(),
    await factory.getAddress()
  );
  await dutchAuction.waitForDeployment();

  await (await factory.setAuthorizedCreator(await ignition.getAddress(), true)).wait();
  await (await factory.setAuthorizedCreator(await dutchAuction.getAddress(), true)).wait();

  return {
    owner,
    usdcToken,
    oracle,
    factory,
    ignition,
    dutchAuction,
  };
}

async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

module.exports = {
  usdc,
  deployCore,
  advanceTime,
};
