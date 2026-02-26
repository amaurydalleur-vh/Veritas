export const navLinks = [
  { id: "mechanics", label: "Mechanics" },
  { id: "differentiation", label: "Differentiation" },
  { id: "controls", label: "Controls" },
  { id: "ignition", label: "Ignition" },
  { id: "roadmap", label: "Roadmap" }
];

export const heroStats = [
  { label: "Market Creation", value: "$50" },
  { label: "RWA Base Yield", value: "5% APR" },
  { label: "Minority Yield Cap", value: "95%" },
  { label: "Max Slippage", value: "50%" }
];

export const mechanicsCards = [
  {
    title: "RWA Gravity Redistribution",
    body: "Treasury yield dynamically flows toward the minority side as event maturity approaches, while the majority side keeps a guaranteed minimum share."
  },
  {
    title: "VALS Bounded Execution",
    body: "Adaptive execution logic protects participants from toxic fills with a strict 50% slippage ceiling and circuit-breaker behavior."
  },
  {
    title: "Wash-Trading Immunity",
    body: "Fee and reward accounting is based on net directional flow rather than gross churn, reducing spoofed activity and incentive abuse."
  }
];

export const differentiationRows = [
  ["Minority-side incentivization", "No", "No", "Yes"],
  ["Yield-bearing market exposure", "No", "No", "Yes"],
  ["Permissionless market launch", "No", "No", "Yes ($50 Ignition)"],
  ["Bounded execution model", "No", "No", "Yes (VALS)"],
  ["Wash-trade resistant rewards", "No", "No", "Yes (net-flow model)"]
];

export const controls = [
  {
    title: "Oracle and Settlement Stack",
    points: ["TWAP settlement window", "Multi-source oracle consensus", "Optimistic dispute layer with challenge period"]
  },
  {
    title: "Governance and Upgrade Safety",
    points: ["3/5 multisig for critical actions", "Timelocks on parameter updates", "Emergency pause with reduced signer threshold"]
  },
  {
    title: "Protocol Risk Controls",
    points: ["Safety module capital allocation", "Formal verification workflow on core market logic", "Dedicated bug bounty process"]
  }
];

export const ignitionSteps = [
  "Launch a market with a fixed $50 creation fee.",
  "Initial liquidity starts on a neutral 50/50 virtual base.",
  "Graduation requires TVL and participant thresholds within a fixed window.",
  "Escrowed launch fees are deployed to strengthen minority-side liquidity after graduation."
];

export const roadmap = [
  { phase: "Phase 01", title: "Core Market Infrastructure", status: "Complete" },
  { phase: "Phase 02", title: "Ignition Launch Engine", status: "In deployment" },
  { phase: "Phase 03", title: "Institutional Partner Integrations", status: "Planned" },
  { phase: "Phase 04", title: "Cross-Market Collateral Efficiency", status: "Planned" }
];
