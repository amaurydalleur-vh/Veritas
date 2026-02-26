import React from "react";
import Badge from "./Badge";
import Sparkline from "./Sparkline";
import { fmt } from "../../data/appData";

function MarketCard({ market, onOpen }) {
  const isIgnition = market.phase === "ignition";
  const progress = isIgnition ? Math.min((market.tvl / market.tvlTarget) * 100, 100) : 0;

  return (
    <article className={`market-card card ${isIgnition ? "ignition" : ""}`} onClick={() => onOpen(market)}>
      <div className="mkt-card-top">
        <div className="mkt-badges">
          <Badge variant="sky">{market.category}</Badge>
          <Badge variant={isIgnition ? "amber" : "jade"}>{isIgnition ? "Ignition" : "Live"}</Badge>
        </div>
        <span className="mkt-meta">{market.days}d left</span>
      </div>
      <p className="mkt-q">{market.question}</p>
      <div className="mkt-prices">
        <div className="mkt-price yes">
          <div className="mkt-price-val">{fmt.pct(market.yes)}</div>
          <div className="mkt-price-lbl">YES</div>
        </div>
        <div className="mkt-price no">
          <div className="mkt-price-val">{fmt.pct(market.no)}</div>
          <div className="mkt-price-lbl">NO</div>
        </div>
      </div>

      {isIgnition ? (
        <div className="ign-prog">
          <div className="ign-prog-top">
            <span className="ign-prog-label">TVL Progress</span>
            <span className="ign-prog-val">
              {fmt.usd(market.tvl)} / {fmt.usd(market.tvlTarget)}
            </span>
          </div>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${progress.toFixed(0)}%` }} />
          </div>
        </div>
      ) : (
        <div className="mkt-skew">
          <div className="mkt-skew-bar">
            <div className="mkt-skew-yes" style={{ width: `${market.skew}%` }} />
          </div>
          <div className="mkt-skew-labels">
            <span>{market.skew}% YES</span>
            <span>{100 - market.skew}% NO</span>
          </div>
        </div>
      )}

      <div className="mkt-footer">
        <div className="mkt-stat">
          <div className="mkt-stat-val">{fmt.usd(market.tvl)}</div>
          <div className="mkt-stat-lbl">TVL</div>
        </div>
        <div className="mkt-stat">
          <div className="mkt-stat-val">{fmt.usd(market.vol)}</div>
          <div className="mkt-stat-lbl">Vol 24h</div>
        </div>
        {!isIgnition ? (
          <div className="mkt-stat">
            <div className="mkt-stat-val amber">{fmt.apy(market.minApy)}</div>
            <div className="mkt-stat-lbl">Min APY</div>
          </div>
        ) : null}
      </div>

      <div className="mkt-spk">
        <Sparkline data={market.history} stroke="var(--accent)" fill />
      </div>
    </article>
  );
}

export default MarketCard;
