const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployCore, usdc, advanceTime } = require("./helpers/deploy.cjs");

describe("Issue #10 - Ignition and Factory critical coverage", function () {
  it("uses full Ignition TVL on graduation and supports linear vesting claims", async function () {
    const { owner, usdcToken, ignition } = await deployCore();

    await (await usdcToken.approve(await ignition.getAddress(), usdc(50))).wait();
    await (await ignition.propose("Will test suite pass this sprint?")).wait();

    const participants = [];
    for (let i = 0; i < 30; i++) {
      const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
      participants.push(wallet);
      await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
      await (await usdcToken.mint(wallet.address, usdc(600))).wait();
      await (await usdcToken.connect(wallet).approve(await ignition.getAddress(), usdc(600))).wait();
    }

    for (let i = 0; i < participants.length; i++) {
      await (await ignition.connect(participants[i]).commit(0, i % 2 === 0, usdc(400))).wait();
    }

    const launch = await ignition.launches(0);
    expect(launch.status).to.equal(2n); // Graduated
    expect(launch.market).to.not.equal(ethers.ZeroAddress);

    const market = await ethers.getContractAt("VeritasMarket", launch.market);
    expect(await usdcToken.balanceOf(await ignition.getAddress())).to.equal(0n);
    expect((await market.reserveYes()) + (await market.reserveNo())).to.equal(launch.tvl);

    // Claim immediately should not unlock anything yet.
    await expect(ignition.connect(participants[0]).claimVested(0)).to.be.revertedWith("Nothing claimable");

    // Halfway through vesting window.
    await advanceTime(7 * 24 * 60 * 60);
    await (await ignition.connect(participants[0]).claimVested(0)).wait();

    const halfClaimYes = await market.sharesYes(participants[0].address);
    const halfClaimNo = await market.sharesNo(participants[0].address);
    expect(halfClaimYes + halfClaimNo).to.be.gt(0n);

    // End of vesting.
    await advanceTime(7 * 24 * 60 * 60 + 60);
    await (await ignition.connect(participants[0]).claimVested(0)).wait();

    const fullClaimYes = await market.sharesYes(participants[0].address);
    const fullClaimNo = await market.sharesNo(participants[0].address);
    expect(fullClaimYes).to.be.gte(halfClaimYes);
    expect(fullClaimNo).to.be.gte(halfClaimNo);

    await expect(ignition.connect(participants[0]).claimVested(0)).to.be.revertedWith("Nothing claimable");
  });

  it("supports owner rejection and user refunds", async function () {
    const { owner, usdcToken, ignition } = await deployCore();
    const [, alice] = await ethers.getSigners();

    await (await usdcToken.approve(await ignition.getAddress(), usdc(50))).wait();
    await (await ignition.propose("Rejectable launch")).wait();

    await (await usdcToken.mint(alice.address, usdc(200))).wait();
    await (await usdcToken.connect(alice).approve(await ignition.getAddress(), usdc(200))).wait();
    await (await ignition.connect(alice).commit(0, true, usdc(120))).wait();

    await (await ignition.connect(owner).rejectLaunch(0)).wait();
    const launch = await ignition.launches(0);
    expect(launch.status).to.equal(4n); // Rejected

    const before = await usdcToken.balanceOf(alice.address);
    await (await ignition.connect(alice).refund(0)).wait();
    const after = await usdcToken.balanceOf(alice.address);
    expect(after - before).to.equal(usdc(120));
  });

  it("transfers initial LP shares to the creator in factory.createMarket()", async function () {
    const { usdcToken, factory } = await deployCore();
    const [, alice] = await ethers.getSigners();

    await (await usdcToken.mint(alice.address, usdc(500))).wait();
    await (await usdcToken.connect(alice).approve(await factory.getAddress(), usdc(500))).wait();
    await (await factory.connect(alice).createMarket("Factory LP receiver test", 7 * 24 * 60 * 60)).wait();

    const marketAddress = await factory.markets(0);
    const market = await ethers.getContractAt("VeritasMarket", marketAddress);

    expect(await market.sharesYes(await factory.getAddress())).to.equal(0n);
    expect(await market.sharesNo(await factory.getAddress())).to.equal(0n);
    expect(await market.sharesYes(alice.address)).to.equal(usdc(100));
    expect(await market.sharesNo(alice.address)).to.equal(usdc(100));
  });

  it("moves virtual probability in the expected direction", async function () {
    const { usdcToken, ignition } = await deployCore();
    const [, alice] = await ethers.getSigners();

    await (await usdcToken.approve(await ignition.getAddress(), usdc(50))).wait();
    await (await ignition.propose("Will YES probability move up after YES buy?")).wait();

    const before = await ignition.virtualProbabilityYes(0);
    await (await usdcToken.mint(alice.address, usdc(100))).wait();
    await (await usdcToken.connect(alice).approve(await ignition.getAddress(), usdc(100))).wait();
    await (await ignition.connect(alice).commit(0, true, usdc(50))).wait();
    const afterYes = await ignition.virtualProbabilityYes(0);
    expect(afterYes).to.be.gt(before);

    await (await usdcToken.approve(await ignition.getAddress(), usdc(50))).wait();
    await (await ignition.propose("Will YES probability move down after NO buy?")).wait();
    const beforeNo = await ignition.virtualProbabilityYes(1);
    await (await ignition.connect(alice).commit(1, false, usdc(50))).wait();
    const afterNo = await ignition.virtualProbabilityYes(1);
    expect(afterNo).to.be.lt(beforeNo);
  });
});
