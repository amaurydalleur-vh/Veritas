export const platformStats = [
  { label: "Active Markets", value: "42" },
  { label: "Open Interest", value: "$18.4M" },
  { label: "Avg Daily Volume", value: "$2.1M" },
  { label: "Institutional Accounts", value: "23" }
];

export const marketRows = [
  {
    market: "US CPI YoY > 3.0% by Q3 2026",
    category: "Macro",
    probability: "37%",
    openInterest: "$3.2M",
    minorityApy: "114%"
  },
  {
    market: "ECB first rate cut before Fed in 2026",
    category: "Rates",
    probability: "46%",
    openInterest: "$2.8M",
    minorityApy: "92%"
  },
  {
    market: "ETH spot ETF net inflows exceed BTC in Q2 2026",
    category: "Digital Assets",
    probability: "29%",
    openInterest: "$1.9M",
    minorityApy: "136%"
  },
  {
    market: "US recession probability above 50% by year-end 2026",
    category: "Macro",
    probability: "41%",
    openInterest: "$4.0M",
    minorityApy: "88%"
  }
];

export const ignitionFunnel = [
  { label: "Markets Submitted", value: "186" },
  { label: "Approved for Ignition", value: "119" },
  { label: "Graduated to Core", value: "47" },
  { label: "Avg Graduation Time", value: "13.6 days" }
];

export const portfolioBlocks = [
  {
    title: "Treasury Yield Attribution",
    lines: [
      "Majority-side base allocation",
      "Minority-side gravity uplift",
      "Protocol safety reserve"
    ]
  },
  {
    title: "Execution Quality Monitoring",
    lines: [
      "Bounded VALS slippage control",
      "Circuit-breaker trigger telemetry",
      "Net-flow fee integrity checks"
    ]
  },
  {
    title: "Governance Operations",
    lines: [
      "Multisig signer policy in force",
      "Timelock queue transparency",
      "Emergency control readiness"
    ]
  }
];
