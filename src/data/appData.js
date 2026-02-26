export const NAV_PAGES = [
  ["markets", "Markets"],
  ["ignition", "Ignition"],
  ["portfolio", "Portfolio"],
  ["docs", "Litepaper"]
];

export const MARKETS = [
  {
    id: 1,
    phase: "core",
    category: "CRYPTO",
    question: "Will Bitcoin exceed $150,000 before end of Q2 2026?",
    yes: 0.68,
    no: 0.32,
    tvl: 4200000,
    vol: 890000,
    skew: 68,
    days: 47,
    participants: 1240,
    minApy: 122.9,
    majApy: 11.2,
    history: [52, 55, 58, 61, 59, 63, 65, 67, 66, 68]
  },
  {
    id: 2,
    phase: "core",
    category: "POLITICS",
    question: "Will the EU pass the AI Liability Directive before June 2026?",
    yes: 0.41,
    no: 0.59,
    tvl: 1850000,
    vol: 320000,
    skew: 41,
    days: 118,
    participants: 640,
    minApy: 94.3,
    majApy: 8.7,
    history: [55, 52, 49, 45, 43, 44, 42, 41, 40, 41]
  },
  {
    id: 3,
    phase: "core",
    category: "MACRO",
    question: "Will the Fed cut rates at least twice before September 2026?",
    yes: 0.73,
    no: 0.27,
    tvl: 7100000,
    vol: 1400000,
    skew: 73,
    days: 210,
    participants: 2180,
    minApy: 138.4,
    majApy: 14.1,
    history: [60, 62, 65, 68, 71, 70, 72, 74, 73, 73]
  },
  {
    id: 4,
    phase: "ignition",
    category: "SPORTS",
    question: "Will Real Madrid win the Champions League 2025/26 season?",
    yes: 0.61,
    no: 0.39,
    tvl: 6800,
    vol: 12000,
    skew: 61,
    days: 24,
    participants: 42,
    participantsTarget: 30,
    tvlTarget: 10000,
    minApy: 0,
    majApy: 0,
    history: [50, 53, 55, 58, 60, 62, 61, 61, 60, 61]
  },
  {
    id: 5,
    phase: "core",
    category: "TECH",
    question: "Will OpenAI release GPT-5 before Anthropic releases Claude 4?",
    yes: 0.38,
    no: 0.62,
    tvl: 920000,
    vol: 180000,
    skew: 38,
    days: 65,
    participants: 890,
    minApy: 108.7,
    majApy: 9.3,
    history: [55, 50, 47, 44, 41, 40, 38, 37, 38, 38]
  },
  {
    id: 6,
    phase: "core",
    category: "CRYPTO",
    question: "Will Ethereum flip Bitcoin by market cap in 2026?",
    yes: 0.22,
    no: 0.78,
    tvl: 3400000,
    vol: 560000,
    skew: 22,
    days: 308,
    participants: 1560,
    minApy: 185.2,
    majApy: 12.8,
    history: [30, 28, 26, 25, 24, 23, 22, 21, 22, 22]
  }
];

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
