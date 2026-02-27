import React, { useMemo } from "react";
import { useMarketsInfo } from "../web3/hooks";

function pct(v) {
  return `${v.toFixed(1)}%`;
}

function usd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function YieldDeskPage() {
  const { data: marketsInfo } = useMarketsInfo(0, 200);

  const rows = useMemo(() => {
    if (!marketsInfo) return [];
    const addrs = marketsInfo[0] || [];
    const questions = marketsInfo[1] || [];
    const reservesYes = marketsInfo[2] || [];
    const reservesNo = marketsInfo[3] || [];
    const settled = marketsInfo[4] || [];

    return addrs
      .map((addr, i) => {
        if (settled[i]) return null;

        const yes = Number(reservesYes[i] || 0n) / 1e6;
        const no = Number(reservesNo[i] || 0n) / 1e6;
        const total = yes + no;
        if (total <= 0) return null;

        const yesPct = (no / total) * 100;
        const noPct = 100 - yesPct;
        const minoritySide = yes < no ? "YES" : no < yes ? "NO" : "Balanced";
        const majoritySide = minoritySide === "YES" ? "NO" : minoritySide === "NO" ? "YES" : "Balanced";

        // Estimated yield weights with inverse reserve weighting.
        const yesYieldWeight = (no / total) * 100;
        const noYieldWeight = (yes / total) * 100;

        const minorityYieldWeight =
          minoritySide === "YES" ? yesYieldWeight : minoritySide === "NO" ? noYieldWeight : 50;
        const majorityYieldWeight =
          majoritySide === "YES" ? yesYieldWeight : majoritySide === "NO" ? noYieldWeight : 50;

        return {
          address: addr,
          question: questions[i] || "Untitled market",
          total,
          yesPct,
          noPct,
          minoritySide,
          majoritySide,
          minorityYieldWeight,
          majorityYieldWeight,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);
  }, [marketsInfo]);

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Liquidity Yield Desk</h1>
        <p className="page-sub">
          Global LP monitoring for majority and minority-side yield profile across live on-chain markets.
        </p>
      </div>

      <div className="card tab-card">
        <div className="section-label">Policy Snapshot</div>
        <div className="stats-inline">
          <div>
            <label>Current LP Deposit Mode</label>
            <strong>Balanced 50/50</strong>
          </div>
          <div>
            <label>Minority Side Treatment</label>
            <strong>Yield uplift (contrarian)</strong>
          </div>
          <div>
            <label>Majority Side Treatment</label>
            <strong>Still yield-positive, lower weight</strong>
          </div>
        </div>
      </div>

      <section className="card tab-card" style={{ marginTop: 12 }}>
        <div className="section-label">Market Yield Monitor</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Market</th>
              <th className="r">TVL</th>
              <th className="r">YES / NO Price</th>
              <th className="r">Minority Side</th>
              <th className="r">Minority Yield Weight</th>
              <th className="r">Majority Yield Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No live on-chain markets detected.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.address}>
                  <td>{r.question}</td>
                  <td className="r">{usd(r.total)}</td>
                  <td className="r">
                    {pct(r.yesPct)} / {pct(r.noPct)}
                  </td>
                  <td className="r">{r.minoritySide}</td>
                  <td className="r">{pct(r.minorityYieldWeight)}</td>
                  <td className="r">{pct(r.majorityYieldWeight)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="card tab-card" style={{ marginTop: 12 }}>
        <div className="section-label">Interpretation</div>
        <p className="text-soft">
          Minority yield weight rises when one side reserve becomes relatively thinner. Majority side still earns
          yield, but at a lower relative weight. With current 50/50 LP entry, your exposure is split across both
          sides and your realized profile follows market skew over time.
        </p>
      </section>
    </div>
  );
}

export default YieldDeskPage;
