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
  useAddLiquidityAsymmetric,
  useRemoveLiquidityAsymmetric,
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

const HIST_KEY = (marketAddr) => `veritas_hist_${marketAddr?.toLowerCase()}`;

function loadHistory(marketAddr) {
  if (!marketAddr) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HIST_KEY(marketAddr)) || "[]");
    return Array.isArray(raw) ? raw.filter((v) => Number.isFinite(v)) : [];
  } catch {
    return [];
  }
}

function persistHistory(marketAddr, history) {
  if (!marketAddr) return;
  localStorage.setItem(HIST_KEY(marketAddr), JSON.stringify(history.slice(-60)));
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
  const [lpAddYesAmount, setLpAddYesAmount] = useState("50");
  const [lpAddNoAmount, setLpAddNoAmount] = useState("50");
  const [lpBurnYesShares, setLpBurnYesShares] = useState("0");
  const [lpBurnNoShares, setLpBurnNoShares] = useState("0");
  const [liveHistory, setLiveHistory] = useState(() => {
    if (Array.isArray(market.history) && market.history.length > 0) return market.history;
    const base = Math.round((market.yes ?? 0.5) * 100);
    return Array(10).fill(base);
  });

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

  // Reset local sparkline when switching markets.
  useEffect(() => {
    if (mktAddr) {
      const stored = loadHistory(mktAddr);
      if (stored.length > 0) {
        setLiveHistory(stored);
      } else {
        const base = Math.round(((market.yes ?? 0.5) * 100) * 10) / 10;
        const boot = Array(12).fill(base);
        setLiveHistory(boot);
        persistHistory(mktAddr, boot);
      }
      return;
    }
    if (Array.isArray(market.history) && market.history.length > 0) {
      setLiveHistory(market.history);
      return;
    }
    const base = Math.round(((market.yes ?? 0.5) * 100) * 10) / 10;
    setLiveHistory(Array(10).fill(base));
  }, [mktAddr, market.id, market.history, market.yes]);

  // Build a lightweight live price series from on-chain implied probability.
  useEffect(() => {
    if (!Number.isFinite(yesPct)) return;
    const point = Math.round(yesPct * 10) / 10;
    setLiveHistory((prev) => {
      const base = prev.length ? prev : [point];
      if (base[base.length - 1] === point) return base;
      const next = [...base, point];
      if (next.length > 30) next.shift();
      if (mktAddr) persistHistory(mktAddr, next);
      return next;
    });
  }, [yesPct, mktAddr]);

  // Derive TVL
  const tvlDisplay = mktAddr && mktInfo
    ? Number((mktInfo[1] ?? 0n) + (mktInfo[2] ?? 0n)) / 1e6
    : (market.tvl ?? 0);

  // Sparkline history: on-chain markets use live sampled series.
  const historyData = mktAddr ? liveHistory : (market.history ?? liveHistory);
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
  const lpAddYesWei = useMemo(() => {
    try { return parseUnits(lpAddYesAmount || "0", 6); }
    catch { return 0n; }
  }, [lpAddYesAmount]);
  const lpAddNoWei = useMemo(() => {
    try { return parseUnits(lpAddNoAmount || "0", 6); }
    catch { return 0n; }
  }, [lpAddNoAmount]);
  const lpAddTotalWei = lpAddYesWei + lpAddNoWei;
  const lpBurnYesWei = useMemo(() => {
    try { return parseUnits(lpBurnYesShares || "0", 6); }
    catch { return 0n; }
  }, [lpBurnYesShares]);
  const lpBurnNoWei = useMemo(() => {
    try { return parseUnits(lpBurnNoShares || "0", 6); }
    catch { return 0n; }
  }, [lpBurnNoShares]);
  const { data: lpAllowance, refetch: refetchLpAllowance } = useUSDCAllowance(
    walletAddress,
    mktAddr
  );
  const needsLpApproval = !!mktAddr && lpAddTotalWei > 0n && (!lpAllowance || lpAllowance < lpAddTotalWei);
  const {
    addLiquidityAsymmetric,
    isPending: addLpPending,
    isConfirming: addLpConfirming,
    isSuccess: addLpSuccess,
    error: addLpError,
  } = useAddLiquidityAsymmetric();
  const {
    removeLiquidityAsymmetric,
    isPending: rmLpPending,
    isConfirming: rmLpConfirming,
    isSuccess: rmLpSuccess,
    error: rmLpError,
  } = useRemoveLiquidityAsymmetric();
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
  const estRemoveYes = (totalSharesYes && totalSharesYes > 0n)
    ? ((lpBurnYesWei * reserveYes) / totalSharesYes)
    : 0n;
  const estRemoveNo = (totalSharesNo && totalSharesNo > 0n)
    ? ((lpBurnNoWei * reserveNo) / totalSharesNo)
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
          <h3>{tab === "lp" ? "Liquidity Provision Console" : "Trade"}</h3>

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
              {mktAddr && (
                <div className="ob-notice">
                  Configure YES/NO allocation to set your liquidity exposure profile.
                  Higher minority-side exposure generally increases contrarian yield weight.
                </div>
              )}
              <label className="inp-label lp-info-label">
                Add Liquidity (USDC)
                <span className="info-wrap">
                  <span className="info-dot" aria-label="Liquidity info">i</span>
                  <span className="info-bubble">
                    LP deposits are capital allocated to market reserves.
                    <br />
                    Symmetric LP means YES and NO are funded equally.
                    <br />
                    Asymmetric LP means you choose different YES/NO allocation.
                    <br />
                    As skew increases, minority-side exposure receives higher yield weight.
                    Majority side still earns yield, typically at lower weight.
                  </span>
                </span>
              </label>
              <div className="trade-stats">
                <div>
                  <span>YES side amount</span>
                  <input
                    className="inp"
                    value={lpAddYesAmount}
                    onChange={(e) => setLpAddYesAmount(e.target.value)}
                  />
                </div>
                <div>
                  <span>NO side amount</span>
                  <input
                    className="inp"
                    value={lpAddNoAmount}
                    onChange={(e) => setLpAddNoAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="trade-stats">
                <div>
                  <span>Total deposit</span>
                  <strong>${(Number(lpAddTotalWei) / 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <span>Current minority side</span>
                  <strong>{minoritySide}</strong>
                </div>
              </div>
              {needsLpApproval ? (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress}
                  onClick={() => approve(mktAddr, Number(lpAddYesAmount || 0) + Number(lpAddNoAmount || 0))}
                >
                  Approve USDC for LP
                </button>
              ) : (
                <button
                  className="btn btn-primary w100"
                  disabled={!mktAddr || !walletAddress || lpAddTotalWei === 0n || addLpPending || addLpConfirming}
                  onClick={() =>
                    addLiquidityAsymmetric(
                      mktAddr,
                      Number(lpAddYesAmount || 0),
                      Number(lpAddNoAmount || 0),
                      0,
                      0
                    )
                  }
                >
                  {addLpPending || addLpConfirming ? "Adding..." : "Add Asymmetric Liquidity"}
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

              <label className="inp-label lp-info-label" style={{ marginTop: 12 }}>
                Remove Liquidity (shares)
                <span className="info-wrap">
                  <span className="info-dot" aria-label="Liquidity removal info">i</span>
                  <span className="info-bubble">
                    Asymmetric withdrawal burns YES and NO LP shares independently.
                    <br />
                    This gives full control of your liquidity profile: reduce one side, keep the other.
                    <br />
                    Burning more minority-side shares reduces contrarian yield exposure.
                    <br />
                    Burning more majority-side shares increases relative minority exposure.
                  </span>
                </span>
              </label>
              <div className="trade-stats">
                <div>
                  <span>Burn YES shares</span>
                  <input
                    className="inp"
                    value={lpBurnYesShares}
                    onChange={(e) => setLpBurnYesShares(e.target.value)}
                  />
                </div>
                <div>
                  <span>Burn NO shares</span>
                  <input
                    className="inp"
                    value={lpBurnNoShares}
                    onChange={(e) => setLpBurnNoShares(e.target.value)}
                  />
                </div>
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
                disabled={!mktAddr || !walletAddress || (lpBurnYesWei === 0n && lpBurnNoWei === 0n) || rmLpPending || rmLpConfirming}
                onClick={() =>
                  removeLiquidityAsymmetric(
                    mktAddr,
                    Number(lpBurnYesShares || 0),
                    Number(lpBurnNoShares || 0),
                    0,
                    0
                  )
                }
              >
                {rmLpPending || rmLpConfirming ? "Removing..." : "Remove Asymmetric Liquidity"}
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
