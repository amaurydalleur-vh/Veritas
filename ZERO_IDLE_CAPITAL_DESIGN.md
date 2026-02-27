# Zero Idle Capital Design (Litepaper Alignment)

## Goal
Ensure capital is not idle:
- CLOB escrow and AMM idle collateral are deployed into instantly redeemable tokenized bonds.
- Redemptions (claims, cancels, withdrawals) remain immediate from user perspective.

## Current Gap
- `VeritasOrderBook` holds USDC escrow idle in contract balance.
- `VeritasMarket` holds reserves in raw USDC.
- Yield effects are modeled (`gravityPool`) but not sourced from external tokenized bond yield.

## Target Architecture

### Components
1. `IBondAdapter` (new interface)
- Wraps any yield-bearing token (e.g. ERC-4626 vault share token, tokenized T-Bill wrapper).
- Handles deposit/redeem and instant liquidity checks.

2. `VeritasTreasuryRouter` (new contract)
- Central collateral allocator for `VeritasMarket` + `VeritasOrderBook`.
- Maintains:
  - liquid USDC buffer;
  - invested principal in adapter;
  - accounting per source (`market`, `orderBook`, fees).

3. `VeritasMarket` + `VeritasOrderBook` integration
- Replace direct long-term USDC idle storage with router calls.
- Keep direct in-contract USDC only for short-latency execution buffers.

## Core Interfaces

### `IBondAdapter`
```solidity
interface IBondAdapter {
    function asset() external view returns (address); // USDC
    function totalManagedAssets() external view returns (uint256);
    function availableLiquidity() external view returns (uint256); // instant redeemable now
    function deposit(uint256 assets) external returns (uint256 shares);
    function redeem(uint256 assets, address to) external returns (uint256 sharesBurned);
    function previewRedeem(uint256 assets) external view returns (uint256 shares);
}
```

### `VeritasTreasuryRouter` (high-level)
```solidity
function registerSource(address source, bool allowed) external onlyOwner;
function setBufferBps(uint256 bps) external onlyOwner; // e.g. 1500 = 15%

function depositFromSource(uint256 amount) external; // source transfers USDC first
function requestLiquidity(uint256 amount, address to) external returns (uint256 provided);

function harvestYield() external returns (uint256 netYield);
function sourceBalance(address source) external view returns (uint256);
function totalUsdcEquivalent() external view returns (uint256);
```

## Accounting Model

### Principle
- Keep principal ownership per source.
- Allocate adapter yield via explicit policy:
  - protocol bucket;
  - gravity bucket;
  - optional LP fee bucket.

### Per-source ledger
- `principalDeposited[source]`
- `principalWithdrawn[source]`
- `netPrincipal[source]`
- `accruedYieldGlobal`

### Why
- Avoid cross-subsidy between CLOB escrow and AMM reserves.
- Make claims/cancels solvency auditable.

## Execution Flow Changes

### A) AMM (`VeritasMarket`)
1. Trade in:
- user sends USDC to market.
- market forwards excess idle to router (`depositFromSource`).
2. Trade out / LP remove / redeem:
- market requests needed USDC from router (`requestLiquidity`).
- fallback: use local buffer first, then router.
3. Gravity:
- `harvestYield` output routes partly into `gravityPool`.
- gravity no longer purely simulated.

### B) CLOB (`VeritasOrderBook`)
1. Place order:
- escrow USDC as today.
- periodically or per-threshold push excess escrow to router.
2. Cancel / claim:
- if local buffer insufficient, pull from router before transfer.
3. Matched notional:
- still credited to virtual positions; backing comes from router-managed capital.

## Buffer + Instant Redeemability

### Buffer policy
- Maintain minimum on-hand USDC buffer (`bufferBps` of obligations).
- Current policy: **10% liquid buffer** (`bufferBps = 1000`).
- Examples:
  - CLOB: based on open escrow + expected near-term cancellations.
  - Market: based on recent withdrawal/redeem velocity.

### Failure handling
- `requestLiquidity` must revert only when insolvency, not temporary routing issues.
- adapter must expose real `availableLiquidity`.
- do not assume full redeemability every block.

## Solvency Invariants
1. `router.totalUsdcEquivalent() + localBuffers >= totalUserLiabilities`
2. For CLOB:
- `sum(unfilled escrow obligations + claimable settled positions)` fully covered.
3. For Market:
- reserves + redeemable obligations + LP withdrawals covered.

Add explicit view:
```solidity
function solvencySnapshot() external view returns (...);
```

## Security Requirements
1. Reentrancy guards on router liquidity pull/push paths.
2. Adapter whitelist only (`onlyOwner` settable with timelock in prod).
3. Emergency pause:
- disable new deposits to adapter;
- keep withdrawals/cancels/claims enabled.
4. Cap exposure:
- max invest ratio (e.g. <= 85%) to preserve buffer.

## Migration Plan

### Phase 1 (safe, low disruption)
1. Deploy router + mock adapter.
2. Wire only `VeritasOrderBook` idle escrow to router.
3. Validate cancel/claim instant behavior under load.

### Phase 2
1. Wire `VeritasMarket` reserves idle tranche.
2. Route real harvested yield into `gravityPool`.

### Phase 3
1. Activate production adapter (tokenized bond source).
2. Enable policy controls via admin panel.

## Test Plan Additions

### Contract tests
1. CLOB cancel after full adapter deployment (instant).
2. Claim after settlement when most capital is invested.
3. AMM large redeem path with router pull.
4. Yield harvest allocation correctness (`protocol/gravity` split).
5. Adapter liquidity shortfall handling.

### UI tests
1. Show:
- invested collateral;
- liquid buffer;
- router-backed solvency indicator.
2. Execution receipts include funding source (`buffer` vs `router pull` optional).

## UI/Config Requirements
1. New env vars:
- `VITE_TREASURY_ROUTER_ADDRESS`
- `VITE_BOND_ADAPTER_ADDRESS`
2. Yield tab additions:
- “Tokenized Bond Yield (realized)”
- “Instant Liquidity Buffer”
- “Invested Ratio”

## Suggested Next Implementation Step
Implement `IBondAdapter` + `MockBondAdapter` + `VeritasTreasuryRouter`, then integrate CLOB first.
This gives the fastest path to prove “no idle capital” with minimal risk before AMM integration.
