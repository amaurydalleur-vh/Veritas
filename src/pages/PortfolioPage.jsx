import React from "react";
import { MARKETS, PORTFOLIO, fmt } from "../data/appData";

function PortfolioPage() {
  return (
    <div className="container page">
      <h1 className="page-title">Portfolio</h1>
      <div className="portfolio-top">
        {[
          ["Portfolio Value", fmt.usd(PORTFOLIO.value)],
          ["PnL", `+${fmt.usd(PORTFOLIO.pnl)} (${PORTFOLIO.pnlPct}%)`],
          ["Yield Earned", fmt.usd(PORTFOLIO.yields.rwa + PORTFOLIO.yields.fees + PORTFOLIO.yields.gravity + PORTFOLIO.yields.vals)]
        ].map(([label, value]) => (
          <article className="card stat-tile" key={label}>
            <span className="st-label">{label}</span>
            <span className="st-value">{value}</span>
          </article>
        ))}
      </div>

      <div className="portfolio-layout">
        <section className="card positions-card">
          <div className="section-label">Active Positions</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Market</th>
                <th>Side</th>
                <th className="r">Value</th>
                <th className="r">APY</th>
                <th className="r">PnL</th>
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO.positions.map((pos) => {
                const market = MARKETS.find((m) => m.id === pos.mktId);
                return (
                  <tr key={pos.mktId}>
                    <td>{market?.question.slice(0, 56)}...</td>
                    <td>{pos.side}</td>
                    <td className="r">{fmt.usd(pos.value)}</td>
                    <td className="r">{fmt.apy(pos.apy)}</td>
                    <td className="r">+{fmt.usd(pos.pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside className="side-stack">
          <article className="card side-card">
            <div className="section-label">Yield Sources</div>
            <div className="mini-list">
              <div>
                <span>RWA Base</span>
                <strong>{fmt.usd(PORTFOLIO.yields.rwa)}</strong>
              </div>
              <div>
                <span>LP Fees</span>
                <strong>{fmt.usd(PORTFOLIO.yields.fees)}</strong>
              </div>
              <div>
                <span>Gravity Boost</span>
                <strong>{fmt.usd(PORTFOLIO.yields.gravity)}</strong>
              </div>
              <div>
                <span>VALS Capture</span>
                <strong>{fmt.usd(PORTFOLIO.yields.vals)}</strong>
              </div>
            </div>
          </article>
          <article className="card side-card">
            <div className="section-label">Commitment Status</div>
            <p className="text-soft">All positions eligible for settlement bonus if held through expiry.</p>
          </article>
        </aside>
      </div>
    </div>
  );
}

export default PortfolioPage;
