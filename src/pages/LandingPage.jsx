import React from "react";
import Badge from "../components/ui/Badge";
import LiveDot from "../components/ui/LiveDot";
import { MARKETS } from "../data/appData";
import MarketCard from "../components/ui/MarketCard";

function LandingPage({ onNavigate, onOpenMarket }) {
  const features = [
    ["RWA Gravity", "Core Innovation", "Treasury yield redistributed toward minority-side positions."],
    ["Veritas Ignition", "$50 Launch", "Permissionless market launch with graduation requirements."],
    ["VALS Protection", "Bounded Execution", "Bounded slippage and toxicity-aware execution behavior."],
    ["Yield-Bearing Orders", "Capital Efficiency", "Idle collateral remains productive while orders wait."],
    ["Inverse LP Fees", "Minority Premium", "Minority side captures higher fee weight under skew."],
    ["Dutch Auction Launch", "Fair Discovery", "Launch sequencing reduces early-stage pricing distortion."]
  ];

  return (
    <div className="container page">
      <section className="hero card">
        <div className="hero-eyebrow">
          <LiveDot />
          <Badge variant="jade">Live on Base Testnet</Badge>
          <Badge variant="dim">v1.0 POC</Badge>
        </div>
        <h1 className="hero-headline">
          Predict.
          <br />
          <em>Earn yield.</em>
          <br />
          Repeat.
        </h1>
        <p className="hero-sub">
          Institutional-grade prediction markets with structured incentives, bounded execution,
          and capital-efficient market participation.
        </p>
        <div className="hero-cta-row">
          <button className="btn btn-primary" onClick={() => onNavigate("markets")}>
            Explore Markets
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("ignition")}>
            Launch a Market - $50
          </button>
        </div>
        <div className="hero-stats">
          {[
            ["$24.7M", "Total Value Locked"],
            ["47", "Active Markets"],
            ["127%", "Avg Minority APY"],
            ["$182M", "Total Volume"]
          ].map(([value, label]) => (
            <div className="hs-item" key={label}>
              <span className="hs-val">{value}</span>
              <span className="hs-lbl">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-label">Core Innovations</div>
        <div className="feat-grid">
          {features.map(([title, tag, desc]) => (
            <article className="feat-cell card" key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
              <Badge variant="amber">{tag}</Badge>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="card apy-callout">
          <div className="apy-head">
            <div className="section-label">Example: 7-day market - $10M TVL - 80/20 skew</div>
            <Badge variant="amber">Economic Model</Badge>
          </div>
          <div className="apy-grid">
            {[
              ["RWA Gravity", "15.5% APY", "Treasury yield redistributed"],
              ["Inverse LP Fees", "70.4% APY", "0.7% volume fee, inverse-weighted"],
              ["Gravity Boost", "32.8% APY", "Net directional flow incentive"],
              ["VALS Capture", "4.2% APY", "Toxic flow penalties capture"]
            ].map(([title, value, sub]) => (
              <div className="apy-cell" key={title}>
                <div>{title}</div>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="apy-total">
            <span>Total Minority APY</span>
            <strong>122.9%</strong>
            <small>vs 0% on legacy platforms</small>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-label">Market Preview</div>
        <div className="markets-grid">
          {MARKETS.slice(0, 3).map((market) => (
            <MarketCard key={market.id} market={market} onOpen={onOpenMarket} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
