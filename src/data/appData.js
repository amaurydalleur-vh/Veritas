export const NAV_PAGES = [
  ["markets", "Markets"],
  ["ignition", "Ignition"],
  ["yieldDesk", "Yield Desk"],
  ["portfolio", "Portfolio"],
  ["docs", "Litepaper"]
];

export const MARKETS = [];

export const PORTFOLIO = {
  value: 48320,
  pnl: 6840,
  pnlPct: 16.5,
  positions: [
    { mktId: 1, side: "YES", cost: 12000, value: 14200, apy: 122.9, pnl: 2200 },
    { mktId: 3, side: "NO", cost: 8000, value: 10100, apy: 138.4, pnl: 2100 },
    { mktId: 5, side: "YES", cost: 15000, value: 17400, apy: 108.7, pnl: 2400 },
    { mktId: 6, side: "NO", cost: 5000, value: 6620, apy: 185.2, pnl: 1620 }
  ],
  yields: { rwa: 1240, fees: 3890, gravity: 1420, vals: 290 },
  apyHistory: [
    { label: "D-6", value: 98 },
    { label: "D-5", value: 104 },
    { label: "D-4", value: 112 },
    { label: "D-3", value: 119 },
    { label: "D-2", value: 115 },
    { label: "D-1", value: 128 },
    { label: "Today", value: 134 }
  ]
};

export const DOC_SECTIONS = [
  [
    "Executive Summary",
    "Veritas combines yield-bearing market participation with a permissionless launch framework, bounded execution protection, and minority incentive reinforcement."
  ],
  [
    "RWA Gravity Redistribution",
    "Treasury yield progressively shifts toward minority-side liquidity as settlement approaches while preserving a minimum allocation to majority exposure."
  ],
  [
    "VALS Bounded Slippage",
    "Execution impact is bounded by design with adaptive response behavior to separate genuine information shocks from toxic opportunistic flow."
  ],
  [
    "Veritas Ignition Mechanics",
    "$50 market launch, explicit graduation thresholds, and escrowed fee injection create a low-friction but policy-constrained market onboarding path."
  ],
  [
    "Settlement and Oracle Policy",
    "TWAP settlement windows, multi-oracle consensus, and optimistic challenge procedures establish dispute-resilient market finalization."
  ],
  [
    "Security Architecture",
    "Multisig governance, timelocks, safety module funding, and formal verification support institutional-grade operational controls."
  ]
];

export const fmt = {
  usd: (v) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`,
  pct: (v) => `${(v * 100).toFixed(0)}c`,
  apy: (v) => `${v.toFixed(1)}%`
};
