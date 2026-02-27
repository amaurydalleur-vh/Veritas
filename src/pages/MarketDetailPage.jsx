import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import Badge from "../components/ui/Badge";
import Sparkline from "../components/ui/Sparkline";
import OrderBookPanel from "../components/OrderBookPanel";
import { fmt } from "../data/appData";
import {
  useMarketInfo,
  useImpliedProbability,
  useOrderBookPosition,
  useAddLiquidity,
  useRemoveLiquidity,
  useUSDCAllowance,
  useApproveUSDC,
  usePlaceOrder,
  useCancelOrder,
  useClaimOrderBookPosition,
} from "../web3/hooks";
import { ADDRESSES, ABIS } from "../web3/contracts";

// ─── localStorage helpers for open CLOB orders ────────────────────────────

const LS_KEY = (addr) => `veritas_ob_${addr?.toLowerCase()}`;

function loadOrders(addr) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(addr)) || "[]"); }
  catch { return []; }
}

function persistOrder(addr, order) {
  const all = loadOrders(addr);
  all.push(order);
  localStorage.setItem(LS_KEY(addr), JSON.stringify(all.slice(-40)));
}

function removeOrder(addr, orderId) {
  const all = loadOrders(addr).filter((o) => o.orderId !== orderId);
  localStorage.setItem(LS_KEY(addr), JSON.stringify(all));
}

// ──────────────────────────────────────────────────────────────────────────

function MarketDetailPage({ market, onBack }) {
  const { address: walletAddress } = useAccount();
  const mktAddr = market?.address;          // undefined for mock markets

  // Tabs
  const [tab, setTab]           = useState("trade");
  const [tradeMode, setTradeMode] = useState("market"); // "market" | "limit"

  // AMM market-order form
  const [side, setSide]     = useState("YES");
  const [amount, setAmount] = useState("100");

  // CLOB limit-order form
  const [limitSide, setLimitSide]   = useState("YES");
  const [limitPrice, setLimitPrice] = useState(50);
  const [limitSize, setLimitSize]   = useState("100");
  // LP form
  const [lpAddAmount, setLpAddAmount] = useState("100");
  const [lpRemovePct, setLpRemovePct] = useState(25);

  // Open orders (localStorage-backed)
  const [openOrders, setOpenOrders] = useState(() => loadOrders(walletAddress));
  const marketOrders = openOrders.filter(
    (o) => mktAddr && o.marketAddress?.toLowerCase() === mktAddr.toLowerCase()
  );

  // Refresh orders whenever wallet changes
  useEffect(() => { setOpenOrders(loadOrders(walletAddress)); }, [walletAddress]);

  // ─── On-chain data ──────────────────────────────────────────────────────

  const { data: mktInfo, refetch: refetchMktInfo } = useMarketInfo(mktAddr);
  const { data: impliedProb } = useImpliedProbability(mktAddr);
  const { positionYes, positionNo } = useOrderBookPosition(mktAddr, walletAddress);
  const { data: userSharesYes, refetch: refetchUserSharesYes } = useReadContract({
    address: mktAddr,
    abi: ABIS.market,
    functionName: "sharesYes",
    args: [walletAddress],
    query: { enabled: !!mktAddr && !!walletAddress },
  });
  const { data: userSharesNo, refetch: refetchUserSharesNo } = useReadContract({
    address: mktAddr,
    abi: ABIS.market,
    functionName: "sharesNo",
    args: [walletAddress],
    query: { enabled: !!mktAddr && !!walletAddress },
  });
  const { data: totalSharesYes, refetch: refetchTotalSharesYes } = useReadContract({
    address: mktAddr,
    abi: ABIS.market,
    functionName: "totalSharesYes",
    query: { enabled: !!mktAddr },
  });
  const { data: totalSharesNo, refetch: refetchTotalSharesNo } = useReadContract({
    address: mktAddr,
    abi: ABIS.market,
    functionName: "totalSharesNo",
    query: { enabled: !!mktAddr },
  });

  // Derive display-ready probability
  const yesPct = mktAddr && impliedProb != null
    ? Number(impliedProb) / 1e16        // 1e18 scale → 0-100
    : (market.yes ?? 0.5) * 100;
  const noPct = 100 - yesPct;

  // Derive TVL
  const tvlDisplay = mktAddr && mktInfo
    ? Number((mktInfo[1] ?? 0n) + (mktInfo[2] ?? 0n)) / 1e6
    : (market.tvl ?? 0);

  // History sparkline (mock if no real data)
  const historyData = market.history ?? Array(10).fill(Math.round(yesPct));
  const changePct   = ((yesPct / 100 - (historyData[0] ?? 50) / 100) * 100).toFixed(1);

  // ─── CLOB: USDC approval ────────────────────────────────────────────────

  const limitSizeWei = useMemo(() => {
    try { return parseUnits(limitSize || "0", 6); }
    catch { return 0n; }
  }, [limitSize]);

  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowance(
    walletAddress,
    ADDRESSES.orderBook
  );
  const needsApproval = !allowance || allowance < limitSizeWei;

  // LP approval and actions
  const lpAddWei = useMemo(() => {
    try { return parseUnits(lpAddAmount || "0", 6); }
    catch { return 0n; }
  }, [lpAddAmount]);
  const { data: lpAllowance, refetch: refetchLpAllowance } = useUSDCAllowance(
    walletAddress,
    mktAddr
  );
  const needsLpApproval = !!mktAddr && (!lpAllowance || lpAllowance < lpAddWei);
  const { addLiquidity, isPending: addLpPending, isConfirming: addLpConfirming, isSuccess: addLpSuccess, error: addLpError } = useAddLiquidity();
  const { removeLiquidity, isPending: rmLpPending, isConfirming: rmLpConfirming, isSuccess: rmLpSuccess, error: rmLpError } = useRemoveLiquidity();
  useEffect(() => {
    if (!addLpSuccess && !rmLpSuccess) return;
    refetchLpAllowance();
    refetchMktInfo();
    refetchUserSharesYes();
    refetchUserSharesNo();
    refetchTotalSharesYes();
    refetchTotalSharesNo();
  }, [
    addLpSuccess,
    rmLpSuccess,
    refetchLpAllowance,
    refetchMktInfo,
    refetchUserSharesYes,
    refetchUserSharesNo,
    refetchTotalSharesYes,
    refetchTotalSharesNo,
  ]);

  const { approve, isSuccess: approveOk } = useApproveUSDC();
  useEffect(() => {
    if (!approveOk) return;
    refetchAllowance();
    refetchLpAllowance();
  }, [approveOk, refetchAllowance, refetchLpAllowance]);

  // ─── CLOB: Read nextOrderId (to know the ID before placing) ────────────

  const { data: nextOrderId, refetch: refetchNextId } = useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "nextOrderId",
    query: { enabled: !!ADDRESSES.orderBook },
  });
  const pendingOrderId = useRef(null);
  const pendingCancelId = useRef(null);

  // ─── CLOB: Place order ──────────────────────────────────────────────────

  const {
    placeOrder,
    hash: placeHash,
    isPending: placePending,
    isSuccess: placeConfirmed,
    error: placeError,
  } = usePlaceOrder();

  const handlePlaceOrder = async () => {
    if (!mktAddr || !walletAddress) return;
    // Snapshot the upcoming orderId BEFORE sending the tx
    const refreshed = await refetchNextId();
    pendingOrderId.current =
      refreshed?.data?.toString() ?? nextOrderId?.toString() ?? null;
    placeOrder(mktAddr, limitSide === "YES", limitPrice, Number(limitSize));
  };

  // Save to localStorage once the tx is confirmed
  useEffect(() => {
    if (!placeConfirmed || !pendingOrderId.current || !walletAddress || !mktAddr) return;
    persistOrder(walletAddress, {
      orderId:       pendingOrderId.current,
      marketAddress: mktAddr,
      buyYes:        limitSide === "YES",
      price:         limitPrice,
      size:          limitSizeWei.toString(),
    });
    setOpenOrders(loadOrders(walletAddress));
    pendingOrderId.current = null;
  }, [placeConfirmed]);

  // ─── CLOB: Cancel order ─────────────────────────────────────────────────

  const { cancelOrder, isSuccess: cancelOk } = useCancelOrder();
  const handleCancel = (orderId) => {
    pendingCancelId.current = String(orderId);
    cancelOrder(orderId);
  };
  useEffect(() => {
    if (!cancelOk || !walletAddress || !pendingCancelId.current) return;
    removeOrder(walletAddress, pendingCancelId.current);
    setOpenOrders(loadOrders(walletAddress));
    pendingCancelId.current = null;
  }, [cancelOk, walletAddress]);

  // CLOB claim (after settlement)
  const {
    claimPosition,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isSuccess: claimSuccess,
    error: claimError,
  } = useClaimOrderBookPosition();

  const settled = !!(mktInfo && mktInfo[5]);
  const outcomeYes = !!(mktInfo && mktInfo[6]);
  const claimable = settled
    ? (outcomeYes ? (positionYes ?? 0n) : (positionNo ?? 0n))
    : 0n;

  // LP analytics
  const reserveYes = mktInfo?.[1] ?? 0n;
  const reserveNo = mktInfo?.[2] ?? 0n;
  const gravityPool = mktInfo?.[3] ?? 0n;
  const minoritySide = reserveYes < reserveNo ? "YES" : reserveNo < reserveYes ? "NO" : "BALANCED";
  const userMinorityShares = minoritySide === "YES" ? (userSharesYes ?? 0n) : minoritySide === "NO" ? (userSharesNo ?? 0n) : 0n;
  const totalMinorityShares = minoritySide === "YES" ? (totalSharesYes ?? 0n) : minoritySide === "NO" ? (totalSharesNo ?? 0n) : 0n;
  const estGravityClaim = totalMinorityShares > 0n
    ? (gravityPool * userMinorityShares) / totalMinorityShares
    : 0n;
  const userPoolShareBps = (totalSharesYes && totalSharesNo && totalSharesYes > 0n && totalSharesNo > 0n)
    ? (((userSharesYes ?? 0n) * 10_000n) / totalSharesYes + ((userSharesNo ?? 0n) * 10_000n) / totalSharesNo) / 2n
    : 0n;
  const userLpUnderlyingYes = (totalSharesYes && totalSharesYes > 0n)
    ? (((userSharesYes ?? 0n) * reserveYes) / totalSharesYes)
    : 0n;
  const userLpUnderlyingNo = (totalSharesNo && totalSharesNo > 0n)
    ? (((userSharesNo ?? 0n) * reserveNo) / totalSharesNo)
    : 0n;
  const userLpNotional = userLpUnderlyingYes + userLpUnderlyingNo;
  const removeBps = BigInt(lpRemovePct * 100);
  const estRemoveYes = (totalSharesYes && totalSharesYes > 0n)
    ? (((userSharesYes ?? 0n) * removeBps * reserveYes) / (10_000n * totalSharesYes))
    : 0n;
  const estRemoveNo = (totalSharesNo && totalSharesNo > 0n)
    ? (((userSharesNo ?? 0n) * removeBps * reserveNo) / (10_000n * totalSharesNo))
    : 0n;

  // ─── AMM minority / majority display ───────────────────────────────────

  const isMinority = side === "YES" ? yesPct < 50 : noPct < 50;
  const apy        = isMinority
    ? (market.minApy ?? 0)
    : (market.majApy ?? 0);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="container page">
      <button className="btn btn-ghost" onClick={onBack}>
        Back to Markets
      </button>

      <div className="detail-layout">

        {/* ── Left: Chart + Tabs ─────────────────────────────────────────── */}
        <section>
          <div className="market-top">
            <Badge variant="sky">{market.category}</Badge>
            <Badge variant={market.phase === "ignition" ? "amber" : "jade"}>
              {market.phase === "ignition" ? "Ignition" : "Live"}
            </Badge>
          </div>
          <h1 className="page-title detail-title">{market.question}</h1>

          <div className="card chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-price">{yesPct.toFixed(0)}¢</div>
                <div className={`chart-change ${Number(changePct) >= 0 ? "up" : "down"}`}>
                  {Number(changePct) >= 0 ? "+" : ""}{changePct}c from open
                </div>
              </div>
              <div className="chart-meta">
                <div className="chart-meta-val">{fmt.usd(tvlDisplay)}</div>
                <div className="chart-meta-lbl">Total Value Locked</div>
              </div>
            </div>
            <Sparkline data={historyData} stroke="var(--accent)" fill />
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            {["trade", "lp", "yield", "oracle"].map((t) => (
              <button
                key={t}
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Trade tab: order book depth */}
          {tab === "trade" && (
            <div className="card tab-card">
              <div className="section-label" style={{ marginBottom: 12 }}>
                Order Book Depth
              </div>
              <OrderBookPanel
                marketAddress={mktAddr}
                openOrders={marketOrders}
                onCancelOrder={handleCancel}
              />
              {!mktAddr && (
                <div className="stats-inline" style={{ marginTop: 12 }}>
                  <div>
                    <label>YES Side</label>
                    <strong>{yesPct.toFixed(0)}¢</strong>
                  </div>
                  <div>
                    <label>NO Side</label>
                    <strong>{noPct.toFixed(0)}¢</strong>
                  </div>
                  <div>
                    <label>24H Volume</label>
                    <strong>{fmt.usd(market.vol ?? 0)}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "lp" && (
            <div className="card tab-card">
              <div className="section-label">Liquidity Provider Console</div>
              <div className="stats-inline">
                <div>
                  <label>Your YES shares</label>
                  <strong>{(Number(userSharesYes ?? 0n) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <label>Your NO shares</label>
                  <strong>{(Number(userSharesNo ?? 0n) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <label>Estimated pool share</label>
                  <strong>{(Number(userPoolShareBps) / 100).toFixed(2)}%</strong>
                </div>
              </div>
              <div className="stats-inline" style={{ marginTop: 8 }}>
                <div>
                  <label>Minority side</label>
                  <strong>{minoritySide}</strong>
                </div>
                <div>
                  <label>Gravity pool</label>
                  <strong>${(Number(gravityPool) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <label>Est. contrarian claim</label>
                  <strong>${(Number(estGravityClaim) / 1e6).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )}

          {tab === "yield" && (
            <div className="card tab-card">
              <div className="section-label">Minority Yield Breakdown</div>
              <div className="stats-inline">
                <div>
                  <label>Minority APY</label>
                  <strong>{fmt.apy(market.minApy ?? 0)}</strong>
                </div>
                <div>
                  <label>Majority APY</label>
                  <strong>{fmt.apy(market.majApy ?? 0)}</strong>
                </div>
                <div>
                  <label>Settlement Days</label>
                  <strong>{market.days ?? "—"}</strong>
                </div>
              </div>
            </div>
          )}

          {tab === "oracle" && (
            <div className="card tab-card">
              <div className="section-label">Settlement Oracle Stack</div>
              <div className="oracle-list">
                <div><span>Pyth Network</span><strong>Active</strong></div>
                <div><span>Chainlink</span><strong>Active</strong></div>
                <div><span>C2PA Verifier</span><strong>Standby</strong></div>
                <div><span>UMA Dispute Layer</span><strong>Standby</strong></div>
              </div>
            </div>
          )}
        </section>

        {/* ── Right: Trade sidebar ───────────────────────────────────────── */}
        <aside className="card trade-card">
          <h3>{tab === "lp" ? "Liquidity Provider" : "Trade"}</h3>

          {/* Market / Limit sub-tabs */}
          {tab === "trade" && (
            <div className="trade-subtabs">
              <button
                className={`subtab-btn ${tradeMode === "market" ? "active" : ""}`}
                onClick={() => setTradeMode("market")}
              >
                Market Order
              </button>
              <button
                className={`subtab-btn ${tradeMode === "limit" ? "active" : ""}`}
                onClick={() => setTradeMode("limit")}
              >
                Limit Order
              </button>
            </div>
          )}

          {/* ── Market Order (AMM) ───────────────────────────────────────── */}
          {tab === "trade" && tradeMode === "market" && (
            <>
              <div className="trade-side">
                <button
                  className={`btn btn-yes ${side === "YES" ? "active" : ""}`}
                  onClick={() => setSide("YES")}
                >
                  YES
                </button>
                <button
                  className={`btn btn-no ${side === "NO" ? "active" : ""}`}
                  onClick={() => setSide("NO")}
                >
                  NO
                </button>
              </div>
              <label className="inp-label">Order Size (USDC)</label>
              <input
                className="inp"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="trade-stats">
                <div>
                  <span>Expected APY</span>
                  <strong>{fmt.apy(apy)}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{isMinority ? "Minority Side" : "Majority Side"}</strong>
                </div>
                <div>
                  <span>Implied Prob</span>
                  <strong>{yesPct.toFixed(0)}¢ YES</strong>
                </div>
              </div>
              <button className="btn btn-primary w100">Preview Order</button>
            </>
          )}

          {/* ── Limit Order (CLOB) ───────────────────────────────────────── */}
          {tab === "trade" && tradeMode === "limit" && (
            <>
              {!mktAddr && (
                <div className="ob-notice">
                  Limit orders require an on-chain market. Select one from the Markets page.
                </div>
              )}

              <div className="trade-side">
                <button
                  className={`btn btn-yes ${limitSide === "YES" ? "active" : ""}`}
                  onClick={() => setLimitSide("YES")}
                >
                  YES
                </button>
                <button
                  className={`btn btn-no ${limitSide === "NO" ? "active" : ""}`}
                  onClick={() => setLimitSide("NO")}
                >
                  NO
                </button>
              </div>

              <label className="inp-label">
                Price — {limitSide} at&nbsp;
                <strong style={{ color: "var(--accent)" }}>{limitPrice}¢</strong>
                &nbsp;per share
              </label>
              <input
                type="range"
                className="price-slider"
                min={1}
                max={99}
                value={limitPrice}
                onChange={(e) => setLimitPrice(Number(e.target.value))}
              />
              <div className="limit-price-row">
                <span className="limit-price-label">
                  {limitSide === "YES" ? "YES" : "NO"} @ {limitPrice}¢
                </span>
                <span className="limit-price-label" style={{ color: "var(--muted)" }}>
                  matches NO @ {100 - limitPrice}¢
                </span>
              </div>

              <label className="inp-label" style={{ marginTop: 10 }}>Size (USDC)</label>
              <input
                className="inp"
                value={limitSize}
                onChange={(e) => setLimitSize(e.target.value)}
              />

              <div className="trade-stats">
                <div>
                  <span>You pay</span>
                  <strong>{limitSize || "0"} USDC</strong>
                </div>
                <div>
                  <span>If {limitSide} wins</span>
                  <strong>
                    {limitSize && limitPrice
                      ? `$${((Number(limitSize) * 100) / limitPrice).toFixed(2)}`
                      : "—"}
                  </strong>
                </div>
              </div>

              {needsApproval ? (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress}
                  onClick={() => approve(ADDRESSES.orderBook, limitSize)}
                >
                  Approve USDC
                </button>
              ) : (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress || placePending}
                  onClick={handlePlaceOrder}
                >
                  {placePending ? "Placing…" : "Place Limit Order"}
                </button>
              )}

              {placeError && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {placeError.shortMessage ?? placeError.message}
                </div>
              )}
              {placeConfirmed && (
                <div className="ob-notice" style={{ color: "var(--jade)", marginTop: 8 }}>
                  Order placed!
                </div>
              )}

              {settled && (
                <>
                  <div className="ob-notice" style={{ marginTop: 10 }}>
                    Market settled. Claimable CLOB payout: <strong>${(Number(claimable) / 1e6).toFixed(2)}</strong>
                  </div>
                  <button
                    className="btn btn-primary w100"
                    disabled={!mktAddr || !walletAddress || claimable === 0n || claimPending || claimConfirming}
                    onClick={() => claimPosition(mktAddr)}
                  >
                    {claimPending || claimConfirming ? "Claiming..." : "Claim CLOB Payout"}
                  </button>
                  {claimError && (
                    <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                      {claimError.shortMessage ?? claimError.message}
                    </div>
                  )}
                  {claimSuccess && (
                    <div className="ob-notice" style={{ color: "var(--jade)", marginTop: 8 }}>
                      CLOB payout claimed.
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === "lp" && (
            <>
              {!mktAddr && (
                <div className="ob-notice">
                  LP actions require an on-chain market. Select one from the Markets page.
                </div>
              )}
              <label className="inp-label">Add Liquidity (USDC)</label>
              <input
                className="inp"
                value={lpAddAmount}
                onChange={(e) => setLpAddAmount(e.target.value)}
              />
              {needsLpApproval ? (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress}
                  onClick={() => approve(mktAddr, lpAddAmount)}
                >
                  Approve USDC for LP
                </button>
              ) : (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress || addLpPending || addLpConfirming}
                  onClick={() => addLiquidity(mktAddr, Number(lpAddAmount))}
                >
                  {addLpPending || addLpConfirming ? "Adding..." : "Add Liquidity"}
                </button>
              )}
              {addLpError && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {addLpError.shortMessage ?? addLpError.message}
                </div>
              )}

              <div className="trade-stats" style={{ marginTop: 10 }}>
                <div>
                  <span>Your LP notional</span>
                  <strong>${(Number(userLpNotional) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <span>LP underlying (YES / NO)</span>
                  <strong>
                    ${(Number(userLpUnderlyingYes) / 1e6).toFixed(2)} / ${(Number(userLpUnderlyingNo) / 1e6).toFixed(2)}
                  </strong>
                </div>
              </div>

              <label className="inp-label" style={{ marginTop: 12 }}>Remove Liquidity (%)</label>
              <input
                type="range"
                className="price-slider"
                min={1}
                max={100}
                value={lpRemovePct}
                onChange={(e) => setLpRemovePct(Number(e.target.value))}
              />
              <div className="limit-price-row">
                <span className="limit-price-label">Withdraw {lpRemovePct}%</span>
                <span className="limit-price-label" style={{ color: "var(--muted)" }}>
                  {lpRemovePct * 100} bps
                </span>
              </div>
              <div className="trade-stats">
                <div>
                  <span>Estimated withdrawal</span>
                  <strong>${(Number(estRemoveYes + estRemoveNo) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <span>Estimated YES / NO out</span>
                  <strong>
                    ${(Number(estRemoveYes) / 1e6).toFixed(2)} / ${(Number(estRemoveNo) / 1e6).toFixed(2)}
                  </strong>
                </div>
              </div>
              <button
                className="btn btn-primary w100"
                disabled={!mktAddr || !walletAddress || rmLpPending || rmLpConfirming}
                onClick={() => removeLiquidity(mktAddr, lpRemovePct * 100)}
              >
                {rmLpPending || rmLpConfirming ? "Removing..." : "Remove Liquidity"}
              </button>
              {rmLpError && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {rmLpError.shortMessage ?? rmLpError.message}
                </div>
              )}
              {(addLpSuccess || rmLpSuccess) && (
                <div className="ob-notice" style={{ color: "var(--jade)", marginTop: 8 }}>
                  LP action confirmed on-chain.
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default MarketDetailPage;
