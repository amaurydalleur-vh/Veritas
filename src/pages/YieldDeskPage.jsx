import React, { useMemo, useState } from "react";
import { useMarketsInfo, useTreasuryRouterStatus } from "../web3/hooks";
import { ADDRESSES } from "../web3/contracts";

function pct(v) {
  return `${v.toFixed(1)}%`;
}

function px(v) {
  return `$${v.toFixed(2)}`;
}

function usd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function YieldDeskPage() {
  const { data: marketsInfo } = useMarketsInfo(0, 200);
  const treasury = useTreasuryRouterStatus(ADDRESSES.treasuryRouter);
  const [externalWallets, setExternalWallets] = useState("");
  const [outsideMajoritySide, setOutsideMajoritySide] = useState("YES");
  const [outsideThesis, setOutsideThesis] = useState("");
  const treasuryBufferPct = Number(treasury.bufferBps ?? 1000n) / 100;
  const treasuryManagedUsd = Number(treasury.totalManagedAssets ?? 0n) / 1e6;
  const treasuryYieldUsd = Number(treasury.accruedYield ?? 0n) / 1e6;
  const treasuryLiquidUsd = Number(treasury.usdcBuffer ?? 0n) / 1e6;
  const treasuryAdapterOn = !!treasury.adapter && treasury.adapter !== "0x0000000000000000000000000000000000000000";
  const treasuryRouterOn = !!ADDRESSES.treasuryRouter;

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
          reserveYes: yes,
          reserveNo: no,
          yesPct,
          noPct,
          yesPrice: yes / total,
          noPrice: no / total,
          minoritySide,
          majoritySide,
          minorityYieldWeight,
          majorityYieldWeight,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);
  }, [marketsInfo]);

  const snapshot = useMemo(() => {
    if (!rows.length) {
      return {
        reserveMode: "No active reserve data",
        reserveSkew: "0.0%",
      };
    }
    const totalYes = rows.reduce((acc, r) => acc + r.reserveYes, 0);
    const totalNo = rows.reduce((acc, r) => acc + r.reserveNo, 0);
    const total = totalYes + totalNo;
    const yesShare = total > 0 ? (totalYes / total) * 100 : 50;
    const noShare = 100 - yesShare;
    const skew = Math.abs(yesShare - noShare);

    let reserveMode = "Balanced reserve profile";
    if (skew >= 2) {
      reserveMode = yesShare > noShare
        ? "Asymmetric tilt to YES reserves"
        : "Asymmetric tilt to NO reserves";
    }

    return {
      reserveMode,
      reserveSkew: `${skew.toFixed(1)}%`,
    };
  }, [rows]);

  const recommendation = useMemo(() => {
    const cleanThesis = outsideThesis.trim().toLowerCase();
    const hedgeSide = outsideMajoritySide === "YES" ? "NO" : "YES";

    if (!rows.length) {
      return {
        type: "launch",
        title: "No active market fit detected",
        body: "No live on-chain markets are available for the current edge profile. Launch a permissionless edge market through Ignition to hedge external majority exposure and keep yield alignment.",
      };
    }

    // Prefer markets where current minority side aligns with the requested hedge side.
    const aligned = rows
      .filter((r) => r.minoritySide === hedgeSide)
      .sort((a, b) => b.minorityYieldWeight - a.minorityYieldWeight);

    const thesisScored = cleanThesis
      ? rows
          .map((r) => {
            const q = r.question.toLowerCase();
            const tokens = cleanThesis.split(/\s+/).filter((t) => t.length > 3);
            const score = tokens.reduce((acc, t) => acc + (q.includes(t) ? 1 : 0), 0);
            return { row: r, score };
          })
          .sort((a, b) => b.score - a.score)
      : [];

    const thesisBest = thesisScored.length > 0 ? thesisScored[0] : null;
    const best = thesisBest && thesisBest.score > 0
      ? thesisBest.row
      : (aligned[0] || rows[0]);

    if (!best) {
      return {
        type: "launch",
        title: "No active market fit detected",
        body: "No relevant live market was identified for your edge profile. Launch a new market through Ignition and set asymmetric LP around your outside majority risk.",
      };
    }

    return {
      type: "market",
      title: `Recommended edge market: ${best.question}`,
      body: `Suggested hedge side: ${hedgeSide}. Current minority side: ${best.minoritySide}. Minority yield weight: ${pct(best.minorityYieldWeight)}.`,
      market: best,
    };
  }, [rows, outsideMajoritySide, outsideThesis]);

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
            <label>Current Reserve Profile</label>
            <strong>{snapshot.reserveMode}</strong>
          </div>
          <div>
            <label>Minority Side Treatment</label>
            <strong>Yield uplift (contrarian)</strong>
          </div>
          <div>
            <label>System Reserve Skew</label>
            <strong>{snapshot.reserveSkew}</strong>
          </div>
        </div>
        <div className="stats-inline" style={{ marginTop: 8 }}>
          <div>
            <label>Idle Capital Policy</label>
            <strong>{treasuryAdapterOn ? "Tokenized-bond deployed" : "Local reserve only"}</strong>
          </div>
          <div>
            <label>Liquid Safety Buffer</label>
            <strong>{treasuryBufferPct.toFixed(1)}%</strong>
          </div>
          <div>
            <label>Treasury Router</label>
            <strong>{treasuryRouterOn ? "Configured" : "Not configured"}</strong>
          </div>
        </div>
        <div className="stats-inline" style={{ marginTop: 8 }}>
          <div>
            <label>Managed Collateral</label>
            <strong>{px(treasuryManagedUsd)}</strong>
          </div>
          <div>
            <label>Liquid Buffer (USDC)</label>
            <strong>{px(treasuryLiquidUsd)}</strong>
          </div>
          <div>
            <label>Accrued Collateral Yield</label>
            <strong>{px(treasuryYieldUsd)}</strong>
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
              <th className="r">YES / NO Price ($)</th>
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
                    {px(r.yesPrice)} / {px(r.noPrice)}
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
        <div className="section-label">Cross-Venue Position Hedging</div>
        <p className="text-soft" style={{ marginTop: 6, marginBottom: 10 }}>
          Institutional hedge assistant for off-platform LP and directional exposure.
        </p>
        <div className="stats-inline">
          <div style={{ minWidth: 260 }}>
            <label className="inp-label lp-info-label">
              External LP Wallet Set
              <span className="info-wrap">
                <span className="info-dot" aria-label="External LP info">i</span>
                <span className="info-bubble">
                  Veritas contrarian yield can be used to hedge majority-leaning external positions.
                  Register external LP wallets to map exposure and receive hedge-side recommendations.
                </span>
              </span>
            </label>
            <input
              className="inp"
              placeholder="0xabc..., 0xdef..., 0x123..."
              value={externalWallets}
              onChange={(e) => setExternalWallets(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <label className="inp-label">Outside Majority Side</label>
            <div className="trade-side">
              <button
                className={`btn btn-yes ${outsideMajoritySide === "YES" ? "active" : ""}`}
                onClick={() => setOutsideMajoritySide("YES")}
              >
                YES Majority
              </button>
              <button
                className={`btn btn-no ${outsideMajoritySide === "NO" ? "active" : ""}`}
                onClick={() => setOutsideMajoritySide("NO")}
              >
                NO Majority
              </button>
            </div>
          </div>
          <div style={{ minWidth: 280 }}>
            <label className="inp-label">Outside Market Thesis (optional)</label>
            <input
              className="inp"
              placeholder="Fed rates, ETH, CPI, election..."
              value={outsideThesis}
              onChange={(e) => setOutsideThesis(e.target.value)}
            />
          </div>
        </div>

        <div className="ob-notice" style={{ marginTop: 10, marginBottom: 0 }}>
          <strong>{recommendation.title}</strong>
          <br />
          {recommendation.body}
          <div style={{ marginTop: 12 }}>
            {recommendation.type === "market" ? (
              <a className="btn btn-primary" href="/markets" style={{ textDecoration: "none" }}>
                Open Markets and Edge Position
              </a>
            ) : (
              <a className="btn btn-primary" href="/ignition" style={{ textDecoration: "none" }}>
                Edge Yourself Permissionlessly via Ignition
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="card tab-card" style={{ marginTop: 12 }}>
        <div className="section-label">Interpretation</div>
        <p className="text-soft">
          Minority yield weight rises when one side reserve becomes relatively thinner. Majority side still earns
          yield, but at a lower relative weight. LP entry is asymmetry-capable and reserve profile is updated
          directly from live on-chain markets (including newly created and graduated markets).
        </p>
        <p className="text-soft" style={{ marginTop: 8 }}>
          Zero-idle target: collateral can be deployed to instantly redeemable tokenized bonds while maintaining a
          liquid {treasuryBufferPct.toFixed(1)}% buffer for exits, order cancelations, and settlement claims.
        </p>
      </section>
    </div>
  );
}

export default YieldDeskPage;
