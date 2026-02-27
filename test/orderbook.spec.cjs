const { expect } = require("chai");
const { ethers } = require("hardhat");

const USDC = 10n ** 6n;
const usdc = (n) => BigInt(n) * USDC;

describe("VeritasOrderBook", function () {
  async function deployStackWithOracleEOA() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();

    const VeritasFactory = await ethers.getContractFactory("VeritasFactory");
    const factory = await VeritasFactory.deploy(
      await token.getAddress(),
      owner.address, // oracle as EOA for test settlement
      owner.address
    );
    await factory.waitForDeployment();

    const VeritasOrderBook = await ethers.getContractFactory("VeritasOrderBook");
    const orderBook = await VeritasOrderBook.deploy(
      await token.getAddress(),
      await factory.getAddress(),
      owner.address
    );
    await orderBook.waitForDeployment();

    return { owner, alice, bob, token, factory, orderBook };
  }

  it("rejects unknown market addresses", async function () {
    const { alice, token, orderBook } = await deployStackWithOracleEOA();
    await (await token.mint(alice.address, usdc(200))).wait();
    await (await token.connect(alice).approve(await orderBook.getAddress(), usdc(200))).wait();

    await expect(
      orderBook.connect(alice).placeOrder(alice.address, true, 50, usdc(10))
    ).to.be.revertedWith("Unknown market");
  });

  it("best bid views do not revert when book is empty", async function () {
    const { orderBook, owner } = await deployStackWithOracleEOA();

    const yes = await orderBook.bestYesBid(owner.address);
    const no = await orderBook.bestNoBid(owner.address);
    expect(yes[0]).to.equal(0n);
    expect(yes[1]).to.equal(false);
    expect(no[0]).to.equal(0n);
    expect(no[1]).to.equal(false);
  });

  it("matches complementary orders and allows winner to claim after settlement", async function () {
    const { owner, alice, bob, token, factory, orderBook } = await deployStackWithOracleEOA();

    await (await token.mint(alice.address, usdc(500))).wait();
    await (await token.mint(bob.address, usdc(500))).wait();

    // Create a market through factory so it passes orderbook whitelist.
    await (await token.approve(await factory.getAddress(), usdc(500))).wait();
    await (await factory.createMarket("Will test market settle YES?", 7 * 24 * 60 * 60)).wait();
    const marketAddr = await factory.markets(0);
    const market = await ethers.getContractAt("VeritasMarket", marketAddr);

    await (await token.connect(alice).approve(await orderBook.getAddress(), usdc(500))).wait();
    await (await token.connect(bob).approve(await orderBook.getAddress(), usdc(500))).wait();

    // Complementary match: YES@40 with NO@60.
    await (await orderBook.connect(alice).placeOrder(marketAddr, true, 40, usdc(100))).wait();
    await (await orderBook.connect(bob).placeOrder(marketAddr, false, 60, usdc(100))).wait();

    // Settle market YES (owner is oracle in this test stack).
    await (await market.connect(owner).settle(true)).wait();

    const beforeAlice = await token.balanceOf(alice.address);
    await (await orderBook.connect(alice).claimPosition(marketAddr)).wait();
    const afterAlice = await token.balanceOf(alice.address);
    expect(afterAlice).to.be.gt(beforeAlice);

    await expect(orderBook.connect(bob).claimPosition(marketAddr)).to.be.revertedWith("Nothing to claim");
  });
});
