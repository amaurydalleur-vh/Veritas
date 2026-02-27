import React, { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import Sparkline from "../components/ui/Sparkline";
import { ABIS, ADDRESSES } from "../web3/contracts";
import { useMarketsInfo, useUSDCBalance } from "../web3/hooks";

function formatUsdPrecise(v) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function historyKey(walletAddress) {
  return `veritas_portfolio_hist_${(walletAddress || "anon").toLowerCase()}`;
}

function loadHistory(walletAddress) {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey(walletAddress)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => Number.isFinite(x)) : [];
  } catch {
    return [];
  }
}

function saveHistory(walletAddress, history) {
  localStorage.setItem(historyKey(walletAddress), JSON.stringify(history.slice(-48)));
}

function orderStoreKey(walletAddress) {
  return `veritas_ob_${(walletAddress || "anon").toLowerCase()}`;
}

function loadOpenOrders(walletAddress) {
  try {
    const parsed = JSON.parse(localStorage.getItem(orderStoreKey(walletAddress)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function PortfolioPage() {
  const { address: walletAddress } = useAccount();
  const { data: marketsInfo } = useMarketsInfo(0, 200);
  const { data: walletUsdc } = useUSDCBalance(walletAddress);
  const [valueHistory, setValueHistory] = useState(() => loadHistory(walletAddress));
  const [openOrders, setOpenOrders] = useState(() => loadOpenOrders(walletAddress));

  useEffect(() => {
    setValueHistory(loadHistory(walletAddress));
  }, [walletAddress]);

  useEffect(() => {
    setOpenOrders(loadOpenOrders(walletAddress));
  }, [walletAddress]);

  const markets = useMemo(() => {
    if (!marketsInfo) return [];
    const addrs = marketsInfo[0] || [];
    const questions = marketsInfo[1] || [];
    const reservesYes = marketsInfo[2] || [];
    const reservesNo = marketsInfo[3] || [];

    return addrs.map((addr, i) => ({
      address: addr,
      question: questions[i] || "On-chain market",
      reserveYes: reservesYes[i] || 0n,
      reserveNo: reservesNo[i] || 0n,
    }));
  }, [marketsInfo]);

  const contracts = useMemo(() => {
    if (!walletAddress || markets.length === 0) return [];
    const reads = [];
    for (const m of markets) {
      reads.push(
        { address: m.address, abi: ABIS.market, functionName: "positionYes", args: [walletAddress] },
        { address: m.address, abi: ABIS.market, functionName: "positionNo", args: [walletAddress] },
        { address: m.address, abi: ABIS.market, functionName: "sharesYes", args: [walletAddress] },
        { address: m.address, abi: ABIS.market, functionName: "sharesNo", args: [walletAddress] },
        { address: m.address, abi: ABIS.market, functionName: "totalSharesYes" },
        { address: m.address, abi: ABIS.market, functionName: "totalSharesNo" }
      );
      if (ADDRESSES.orderBook) {
        reads.push(
          { address: ADDRESSES.orderBook, abi: ABIS.orderBook, functionName: "positionYes", args: [walletAddress, m.address] },
          { address: ADDRESSES.orderBook, abi: ABIS.orderBook, functionName: "positionNo", args: [walletAddress, m.address] }
        );
      }
    }
    return reads;
  }, [walletAddress, markets]);

  const { data: rawReads } = useReadContracts({
    contracts,
    query: { enabled: !!walletAddress && contracts.length > 0, refetchInterval: 10_000 },
  });

  const openOrderContracts = useMemo(() => {
    if (!ADDRESSES.orderBook || !openOrders.length) return [];
    return openOrders
      .map((o) => {
        try {
          const orderId = BigInt(o?.orderId ?? 0);
          return {
            address: ADDRESSES.orderBook,
            abi: ABIS.orderBook,
            functionName: "getOrder",
            args: [orderId],
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, [openOrders]);

  const { data: openOrderReads } = useReadContracts({
    contracts: openOrderContracts,
    query: { enabled: openOrderContracts.length > 0, refetchInterval: 10_000 },
  });

  const openLockedByMarket = useMemo(() => {
    const locked = new Map();
    if (!openOrders.length || !openOrderReads) return locked;
    for (let i = 0; i < openOrders.length; i += 1) {
      const localOrder = openOrders[i];
      const order = openOrderReads[i]?.result;
      if (!order) continue;
      const marketAddress = String(localOrder?.marketAddress || "").toLowerCase();
      if (!marketAddress) continue;
      const size = order?.size ?? order?.[4] ?? 0n;
      const filled = order?.filled ?? order?.[5] ?? 0n;
      const cancelled = order?.cancelled ?? order?.[6] ?? false;
      if (cancelled) continue;
      const remaining = size > filled ? size - filled : 0n;
      if (remaining <= 0n) continue;
      locked.set(marketAddress, (locked.get(marketAddress) ?? 0n) + remaining);
    }
    return locked;
  }, [openOrders, openOrderReads]);

  const portfolio = useMemo(() => {
    if (!walletAddress || markets.length === 0 || !rawReads) {
      return { rows: [], totalNotional: 0, marketCount: 0 };
    }

    let idx = 0;
    const rows = [];
    let totalNotional = 0;

    for (const m of markets) {
      const ammYes = rawReads[idx++]?.result ?? 0n;
      const ammNo = rawReads[idx++]?.result ?? 0n;
      const lpSharesYes = rawReads[idx++]?.result ?? 0n;
      const lpSharesNo = rawReads[idx++]?.result ?? 0n;
      const totalSharesYes = rawReads[idx++]?.result ?? 0n;
      const totalSharesNo = rawReads[idx++]?.result ?? 0n;
      const clobYes = ADDRESSES.orderBook ? (rawReads[idx++]?.result ?? 0n) : 0n;
      const clobNo = ADDRESSES.orderBook ? (rawReads[idx++]?.result ?? 0n) : 0n;
      const openLimitLocked = openLockedByMarket.get(String(m.address).toLowerCase()) ?? 0n;

      const lpUnderlyingYes = totalSharesYes > 0n ? (lpSharesYes * m.reserveYes) / totalSharesYes : 0n;
      const lpUnderlyingNo = totalSharesNo > 0n ? (lpSharesNo * m.reserveNo) / totalSharesNo : 0n;

      const yesPosition = ammYes + clobYes;
      const noPosition = ammNo + clobNo;
      const yesLp = lpUnderlyingYes;
      const noLp = lpUnderlyingNo;
      const total = yesPosition + noPosition + yesLp + noLp;
      if (total === 0n && openLimitLocked === 0n) continue;

      const reserveTotal = m.reserveYes + m.reserveNo;
      const yesPrice = reserveTotal > 0n ? Number((m.reserveNo * 10000n) / reserveTotal) / 100 : 50;
      const noPrice = 100 - yesPrice;
      const skewNorm = Math.min(1, Math.abs(yesPrice - 50) / 50);
      const minorityApr = 4 + 12 * skewNorm;

      const yesPositionUsd = Number(yesPosition) / 1e6;
      const noPositionUsd = Number(noPosition) / 1e6;
      const yesLpUsd = Number(yesLp) / 1e6;
      const noLpUsd = Number(noLp) / 1e6;
      const openLimitUsd = Number(openLimitLocked) / 1e6;
      const totalUsd = yesPositionUsd + noPositionUsd + yesLpUsd + noLpUsd + openLimitUsd;
      totalNotional += totalUsd;

      const lpUnderlyingTotal = Number(yesLp + noLp) / 1e6;
      const lpMixYesPct = lpUnderlyingTotal > 0 ? (yesLpUsd / lpUnderlyingTotal) * 100 : 0;
      const lpMixNoPct = lpUnderlyingTotal > 0 ? (noLpUsd / lpUnderlyingTotal) * 100 : 0;

      rows.push({
        address: m.address,
        question: m.question,
        yesPositionUsd,
        noPositionUsd,
        yesLpUsd,
        noLpUsd,
        openLimitUsd,
        yesPrice,
        noPrice,
        minorityApr,
        lpMixYesPct,
        lpMixNoPct,
      });
    }

    rows.sort(
      (a, b) =>
        (b.yesPositionUsd + b.noPositionUsd + b.yesLpUsd + b.noLpUsd + b.openLimitUsd) -
        (a.yesPositionUsd + a.noPositionUsd + a.yesLpUsd + a.noLpUsd + a.openLimitUsd)
    );
    return { rows, totalNotional, marketCount: rows.length };
  }, [walletAddress, markets, rawReads, openLockedByMarket]);

  useEffect(() => {
    if (!walletAddress) return;
    if (!Number.isFinite(portfolio.totalNotional) || portfolio.totalNotional <= 0) return;
    setValueHistory((prev) => {
      const base = prev.length ? prev : [portfolio.totalNotional];
      const last = base[base.length - 1];
      if (Math.abs(last - portfolio.totalNotional) < 0.01) return base;
      const next = [...base, portfolio.totalNotional];
      saveHistory(walletAddress, next);
      return next;
    });
  }, [walletAddress, portfolio.totalNotional]);

  const chartData = valueHistory.length >= 2 ? valueHistory : [portfolio.totalNotional || 0, portfolio.totalNotional || 0];

  return (
    <div className="container page">
      <h1 className="page-title">Portfolio</h1>
      <div className="portfolio-top">
        {[
          ["On-chain Notional", formatUsdPrecise(portfolio.totalNotional)],
          ["Wallet USDC", formatUsdPrecise(Number(walletUsdc ?? 0n) / 1e6)],
          ["Active Markets", String(portfolio.marketCount)],
        ].map(([label, value]) => (
          <article className="card stat-tile" key={label}>
            <span className="st-label">{label}</span>
            <span className="st-value">{value}</span>
          </article>
        ))}
      </div>

      <section className="card tab-card" style={{ marginBottom: 12 }}>
        <div className="section-label">Portfolio Value History</div>
        <Sparkline data={chartData} stroke="var(--accent)" fill />
      </section>

      <section className="card positions-card">
        <div className="section-label">Active On-Chain Positions</div>
        {!walletAddress ? (
          <p className="text-soft" style={{ margin: 0 }}>Connect wallet to load portfolio data.</p>
        ) : portfolio.rows.length === 0 ? (
          <p className="text-soft" style={{ margin: 0 }}>No active AMM/CLOB/LP positions found.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Market</th>
                <th className="r">YES / NO Positions</th>
                <th className="r">YES / NO LPs</th>
                <th className="r">YES / NO Price</th>
                <th className="r">Minority APR</th>
                <th className="r">Your LP Mix (Y/N)</th>
                <th className="r">Open Limit Orders (USDC locked)</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.rows.map((row) => (
                <tr key={row.address}>
                  <td>{row.question}</td>
                  <td className="r">{formatUsdPrecise(row.yesPositionUsd)} / {formatUsdPrecise(row.noPositionUsd)}</td>
                  <td className="r">{formatUsdPrecise(row.yesLpUsd)} / {formatUsdPrecise(row.noLpUsd)}</td>
                  <td className="r">{row.yesPrice.toFixed(1)}% / {row.noPrice.toFixed(1)}%</td>
                  <td className="r">{row.minorityApr.toFixed(1)}%</td>
                  <td className="r">{row.lpMixYesPct.toFixed(1)}% / {row.lpMixNoPct.toFixed(1)}%</td>
                  <td className="r">{formatUsdPrecise(row.openLimitUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default PortfolioPage;
