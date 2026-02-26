import React, { useMemo, useState } from "react";
import { MARKETS } from "../data/appData";
import MarketCard from "../components/ui/MarketCard";

function MarketsPage({ onOpenMarket, onNavigate }) {
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState("tvl");
  const categories = ["ALL", "CRYPTO", "POLITICS", "MACRO", "TECH", "SPORTS"];

  const rows = useMemo(() => {
    return MARKETS.filter((m) => category === "ALL" || m.category === category).sort((a, b) =>
      sortBy === "apy" ? b.minApy - a.minApy : sortBy === "volume" ? b.vol - a.vol : b.tvl - a.tvl
    );
  }, [category, sortBy]);

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Markets</h1>
        <p className="page-sub">
          {MARKETS.filter((m) => m.phase === "core").length} live -{" "}
          {MARKETS.filter((m) => m.phase === "ignition").length} ignition - earn yield on every
          position
        </p>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          {categories.map((c) => (
            <button
              key={c}
              className={`btn btn-ghost ${category === c ? "active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="sort-label">Sort:</span>
          {["tvl", "apy", "volume"].map((s) => (
            <button
              key={s}
              className={`btn btn-ghost ${sortBy === s ? "active" : ""}`}
              onClick={() => setSortBy(s)}
            >
              Sort: {s.toUpperCase()}
            </button>
          ))}
          <button className="btn btn-primary" onClick={() => onNavigate("ignition")}>
            + Launch Market
          </button>
        </div>
      </div>

      <div className="markets-grid">
        {rows.map((market) => (
          <MarketCard key={market.id} market={market} onOpen={onOpenMarket} />
        ))}
      </div>
    </div>
  );
}

export default MarketsPage;
