const { expect } = require("chai");
const { ethers } = require("hardhat");

const USDC = 10n ** 6n;
const usdc = (n) => BigInt(n) * USDC;

describe("VeritasMarket asymmetric LP", function () {
  async function deployMarket() {
    const [owner, alice] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();

    const VeritasFactory = await ethers.getContractFactory("VeritasFactory");
    const factory = await VeritasFactory.deploy(
      await token.getAddress(),
      owner.address,
      owner.address
    );
    await factory.waitForDeployment();

    await (await token.approve(await factory.getAddress(), usdc(500))).wait();
    await (await factory.createMarket("Asymmetric LP test market", 7 * 24 * 60 * 60)).wait();
    const marketAddr = await factory.markets(0);
    const market = await ethers.getContractAt("VeritasMarket", marketAddr);

    await (await token.mint(alice.address, usdc(1000))).wait();
    await (await token.connect(alice).approve(marketAddr, usdc(1000))).wait();

    return { owner, alice, token, market };
  }

  it("adds liquidity asymmetrically and mints side-specific shares", async function () {
    const { alice, market } = await deployMarket();

    await (await market.connect(alice).addLiquidityAsymmetric(
      usdc(60),
      usdc(20),
      usdc(60),
      usdc(20)
    )).wait();

    expect(await market.sharesYes(alice.address)).to.equal(usdc(60));
    expect(await market.sharesNo(alice.address)).to.equal(usdc(20));
  });

  it("allows asymmetric withdrawal from one side only", async function () {
    const { alice, token, market } = await deployMarket();

    await (await market.connect(alice).addLiquidityAsymmetric(usdc(60), usdc(20), 0, 0)).wait();

    const before = await token.balanceOf(alice.address);
    const tx = await market.connect(alice).removeLiquidityAsymmetric(
      usdc(30), // burn only YES shares
      0,
      usdc(29), // conservative min out
      0
    );
    const receipt = await tx.wait();
    const after = await token.balanceOf(alice.address);

    const evt = receipt.logs
      .map((log) => { try { return market.interface.parseLog(log); } catch { return null; } })
      .find((e) => e && e.name === "LiquidityRemoved");
    expect(evt).to.not.equal(undefined);
    const outYes = evt.args.amountYes;
    const outNo = evt.args.amountNo;

    expect(outYes).to.be.gt(0n);
    expect(outNo).to.equal(0n);
    expect(after - before).to.equal(outYes + outNo);
    expect(await market.sharesYes(alice.address)).to.equal(usdc(30));
    expect(await market.sharesNo(alice.address)).to.equal(usdc(20));
  });

  it("enforces slippage constraints on asymmetric add", async function () {
    const { alice, market } = await deployMarket();

    await expect(
      market.connect(alice).addLiquidityAsymmetric(
        usdc(10),
        0,
        usdc(11), // impossible min shares
        0
      )
    ).to.be.revertedWith("YES slippage");
  });

  it("enforces slippage constraints on asymmetric remove", async function () {
    const { alice, market } = await deployMarket();

    await (await market.connect(alice).addLiquidityAsymmetric(usdc(20), usdc(20), 0, 0)).wait();

    await expect(
      market.connect(alice).removeLiquidityAsymmetric(
        usdc(10),
        usdc(10),
        usdc(11),
        usdc(11)
      )
    ).to.be.revertedWith("YES out too low");
  });
});
