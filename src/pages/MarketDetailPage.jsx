import React, { useMemo, useState } from "react";
import Badge from "../components/ui/Badge";
import Sparkline from "../components/ui/Sparkline";
import { fmt } from "../data/appData";

function MarketDetailPage({ market, onBack }) {
  const [side, setSide] = useState("YES");
  const [amount, setAmount] = useState("1000");
  const [tab, setTab] = useState("trade");
  const isMinority = useMemo(
    () => (side === "YES" ? market.yes < 0.5 : market.no < 0.5),
    [market, side]
  );
  const apy = isMinority ? market.minApy : market.majApy;
  const changePct = ((market.yes - market.history[0] / 100) * 100).toFixed(1);

  return (
    <div className="container page">
      <button className="btn btn-ghost" onClick={onBack}>
        Back to Markets
      </button>

      <div className="detail-layout">
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
                <div className="chart-price">{fmt.pct(market.yes)}</div>
                <div className={`chart-change ${Number(changePct) >= 0 ? "up" : "down"}`}>
                  {Number(changePct) >= 0 ? "+" : ""}
                  {changePct}c from open
                </div>
              </div>
              <div className="chart-meta">
                <div className="chart-meta-val">{fmt.usd(market.tvl)}</div>
                <div className="chart-meta-lbl">Total Value Locked</div>
              </div>
            </div>
            <Sparkline data={market.history} stroke="var(--accent)" fill />
          </div>

          <div className="tab-bar">
            {["trade", "yield", "oracle"].map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === "trade" ? (
            <div className="card tab-card">
              <div className="section-label">Order Book Depth</div>
              <div className="stats-inline">
                <div>
                  <label>YES Side</label>
                  <strong>{fmt.pct(market.yes)}</strong>
                </div>
                <div>
                  <label>NO Side</label>
                  <strong>{fmt.pct(market.no)}</strong>
                </div>
                <div>
                  <label>24H Volume</label>
                  <strong>{fmt.usd(market.vol)}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {tab === "yield" ? (
            <div className="card tab-card">
              <div className="section-label">Minority Yield Breakdown</div>
              <div className="stats-inline">
                <div>
                  <label>Minority APY</label>
                  <strong>{fmt.apy(market.minApy)}</strong>
                </div>
                <div>
                  <label>Majority APY</label>
                  <strong>{fmt.apy(market.majApy)}</strong>
                </div>
                <div>
                  <label>Settlement Days</label>
                  <strong>{market.days}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {tab === "oracle" ? (
            <div className="card tab-card">
              <div className="section-label">Settlement Oracle Stack</div>
              <div className="oracle-list">
                <div>
                  <span>Pyth Network</span>
                  <strong>Active</strong>
                </div>
                <div>
                  <span>Chainlink</span>
                  <strong>Active</strong>
                </div>
                <div>
                  <span>C2PA Verifier</span>
                  <strong>Standby</strong>
                </div>
                <div>
                  <span>UMA Dispute Layer</span>
                  <strong>Standby</strong>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="card trade-card">
          <h3>Trade</h3>
          <div className="trade-side">
            <button className={`btn btn-yes ${side === "YES" ? "active" : ""}`} onClick={() => setSide("YES")}>
              YES
            </button>
            <button className={`btn btn-no ${side === "NO" ? "active" : ""}`} onClick={() => setSide("NO")}>
              NO
            </button>
          </div>
          <label className="inp-label">Order Size (USDC)</label>
          <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="trade-stats">
            <div>
              <span>Expected APY</span>
              <strong>{fmt.apy(apy)}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{isMinority ? "Minority Side" : "Majority Side"}</strong>
            </div>
          </div>
          <button className="btn btn-primary w100">Preview Order</button>
        </aside>
      </div>
    </div>
  );
}

export default MarketDetailPage;
