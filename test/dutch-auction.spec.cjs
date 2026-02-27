const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployCore, usdc, advanceTime } = require("./helpers/deploy.cjs");

function commitHash(pricePercent, buyYes, salt, amount) {
  return ethers.solidityPackedKeccak256(
    ["uint8", "bool", "bytes32", "uint256"],
    [pricePercent, buyYes, salt, amount]
  );
}

describe("Issue #10 - Dutch Auction critical coverage", function () {
  it("finalizes with deterministic clearing and handles filled/unfilled/pro-rata claims", async function () {
    const { usdcToken, dutchAuction } = await deployCore();
    const [, y1, n1, n2] = await ethers.getSigners();

    for (const s of [y1, n1, n2]) {
      await (await usdcToken.mint(s.address, usdc(1_000))).wait();
      await (await usdcToken.connect(s).approve(await dutchAuction.getAddress(), usdc(1_000))).wait();
    }

    await (await dutchAuction.createAuction("Auction settlement test", 3600, 3600, 7 * 24 * 60 * 60)).wait();

    // Book design (USDC-weighted median):
    // YES: y1 @ 50 for 100
    // NO:  n1 @ 40 for 200, n2 @ 50 for 200
    // Weighted median should be cp=50.
    // Then perSide=100, NO side demand at <=50 is 400 => n1 and n2 both pro-rata.
    const y1Amt = usdc(100);
    const n1Amt = usdc(200);
    const n2Amt = usdc(200);
    const y1Salt = ethers.id("y1");
    const n1Salt = ethers.id("n1");
    const n2Salt = ethers.id("n2");

    await (await dutchAuction.connect(y1).commit(0, commitHash(50, true, y1Salt, y1Amt), y1Amt)).wait();
    await (await dutchAuction.connect(n1).commit(0, commitHash(40, false, n1Salt, n1Amt), n1Amt)).wait();
    await (await dutchAuction.connect(n2).commit(0, commitHash(50, false, n2Salt, n2Amt), n2Amt)).wait();

    await advanceTime(3601);
    await (await dutchAuction.connect(y1).reveal(0, 50, true, y1Salt, y1Amt)).wait();
    await (await dutchAuction.connect(n1).reveal(0, 40, false, n1Salt, n1Amt)).wait();
    await (await dutchAuction.connect(n2).reveal(0, 50, false, n2Salt, n2Amt)).wait();

    await advanceTime(3601);
    await (await dutchAuction.finalize(0)).wait();

    const auction = await dutchAuction.auctions(0);
    expect(auction.status).to.equal(3n); // Finalized
    expect(auction.clearingPrice).to.equal(50n);
    expect(auction.totalSeed).to.equal(usdc(200));
    expect(auction.market).to.not.equal(ethers.ZeroAddress);

    const market = await ethers.getContractAt("VeritasMarket", auction.market);

    const n1UsdcBefore = await usdcToken.balanceOf(n1.address);
    await (await dutchAuction.connect(n1).claimLPShares(0)).wait();
    const n1UsdcAfter = await usdcToken.balanceOf(n1.address);
    expect(n1UsdcAfter - n1UsdcBefore).to.equal(usdc(150)); // pro-rata refund
    expect((await market.sharesYes(n1.address)) + (await market.sharesNo(n1.address))).to.be.gt(0n);

    const y1UsdcBefore = await usdcToken.balanceOf(y1.address);
    await (await dutchAuction.connect(y1).claimLPShares(0)).wait();
    const y1UsdcAfter = await usdcToken.balanceOf(y1.address);
    expect(y1UsdcAfter - y1UsdcBefore).to.equal(0n); // fully filled, no refund
    expect((await market.sharesYes(y1.address)) + (await market.sharesNo(y1.address))).to.be.gt(0n);

    const n2UsdcBefore = await usdcToken.balanceOf(n2.address);
    await (await dutchAuction.connect(n2).claimLPShares(0)).wait();
    const n2UsdcAfter = await usdcToken.balanceOf(n2.address);
    expect(n2UsdcAfter - n2UsdcBefore).to.equal(usdc(150)); // pro-rata refund
    expect((await market.sharesYes(n2.address)) + (await market.sharesNo(n2.address))).to.be.gt(0n);
  });

  it("refunds unrevealed bids after finalize", async function () {
    const { usdcToken, dutchAuction } = await deployCore();
    const [, bidder] = await ethers.getSigners();

    await (await usdcToken.mint(bidder.address, usdc(500))).wait();
    await (await usdcToken.connect(bidder).approve(await dutchAuction.getAddress(), usdc(500))).wait();

    await (await dutchAuction.createAuction("Unrevealed refund test", 3600, 3600, 3 * 24 * 60 * 60)).wait();

    const amount = usdc(120);
    const salt = ethers.id("unrevealed");
    await (await dutchAuction.connect(bidder).commit(0, commitHash(55, true, salt, amount), amount)).wait();

    await advanceTime(3601 + 3601);
    await (await dutchAuction.finalize(0)).wait();

    const before = await usdcToken.balanceOf(bidder.address);
    await (await dutchAuction.connect(bidder).claimLPShares(0)).wait();
    const after = await usdcToken.balanceOf(bidder.address);
    expect(after - before).to.equal(amount);
  });

  it("refunds full escrow when auction is cancelled", async function () {
    const { owner, usdcToken, dutchAuction } = await deployCore();
    const [, bidder] = await ethers.getSigners();

    await (await usdcToken.mint(bidder.address, usdc(500))).wait();
    await (await usdcToken.connect(bidder).approve(await dutchAuction.getAddress(), usdc(500))).wait();

    await (await dutchAuction.createAuction("Cancelled auction refund", 3600, 3600, 3 * 24 * 60 * 60)).wait();

    const amount = usdc(150);
    const salt = ethers.id("cancelled");
    await (await dutchAuction.connect(bidder).commit(0, commitHash(45, false, salt, amount), amount)).wait();
    await (await dutchAuction.connect(owner).cancelAuction(0)).wait();

    const before = await usdcToken.balanceOf(bidder.address);
    await (await dutchAuction.connect(bidder).claimLPShares(0)).wait();
    const after = await usdcToken.balanceOf(bidder.address);
    expect(after - before).to.equal(amount);
  });
});
