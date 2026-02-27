import React, { useMemo, useState } from "react";
import { MARKETS } from "../data/appData";
import MarketCard from "../components/ui/MarketCard";
import { useMarketsInfo } from "../web3/hooks";

function MarketsPage({ onOpenMarket, onNavigate }) {
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState("tvl");
  const { data: marketsInfo } = useMarketsInfo(0, 200);

  const onchainMarkets = useMemo(() => {
    if (!marketsInfo) return [];

    const addrs = marketsInfo[0] || [];
    const questions = marketsInfo[1] || [];
    const reservesYes = marketsInfo[2] || [];
    const reservesNo = marketsInfo[3] || [];
    const settledFlags = marketsInfo[4] || [];
    const expiresAts = marketsInfo[5] || [];

    const now = Math.floor(Date.now() / 1000);

    return addrs.map((addr, i) => {
      const reserveYes = Number(reservesYes[i] || 0n) / 1e6;
      const reserveNo = Number(reservesNo[i] || 0n) / 1e6;
      const total = reserveYes + reserveNo;
      const yes = total > 0 ? reserveNo / total : 0.5;
      const no = 1 - yes;
      const expiresAt = Number(expiresAts[i] || 0n);
      const days = Math.max(0, Math.ceil((expiresAt - now) / 86400));

      return {
        id: `onchain-${String(addr).toLowerCase()}`,
        address: addr,
        phase: "core",
        category: "ONCHAIN",
        question: questions[i] || "On-chain market",
        yes,
        no,
        tvl: total,
        vol: 0,
        skew: Math.round(yes * 100),
        days,
        participants: 0,
        minApy: 0,
        majApy: 0,
        history: Array(10).fill(Math.round(yes * 100)),
        settled: !!settledFlags[i],
      };
    });
  }, [marketsInfo]);

  const mergedMarkets = useMemo(() => [...onchainMarkets, ...MARKETS], [onchainMarkets]);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(mergedMarkets.map((m) => m.category)))],
    [mergedMarkets]
  );

  const rows = useMemo(() => {
    return mergedMarkets.filter((m) => category === "ALL" || m.category === category).sort((a, b) =>
      sortBy === "apy" ? b.minApy - a.minApy : sortBy === "volume" ? b.vol - a.vol : b.tvl - a.tvl
    );
  }, [category, sortBy, mergedMarkets]);

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Markets</h1>
        <p className="page-sub">
          {mergedMarkets.filter((m) => m.phase === "core").length} live -{" "}
          {mergedMarkets.filter((m) => m.phase === "ignition").length} ignition - earn yield on every
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
