# Step 4 - Focused PoC Validation Pass

## Scope
- Validate AMM behavior under real flow.
- Validate CLOB limit lifecycle and matching.
- Validate LP/Gravity mechanics before high-volume mock trading.

## Preconditions
- Correct network: Arbitrum Sepolia.
- Wallet funded with test USDC.
- At least 2 test wallets for matching scenarios.
- Use only on-chain markets from `Markets`.

## Test Matrix

### 1) AMM Execution and Price Update
1. Open market: `Will the US CPI print below 3% in May 2025?`
2. Wallet A: buy YES with small size (`5 USDC`).
3. Confirm:
- Tx success.
- `Execution Receipt` visible with tx link + before/after price delta.
- Chart and headline price update.
4. Wallet A: buy YES with medium size (`75 USDC` or valid size < 20% TVL).
5. Confirm same items as above.

Pass criteria:
- Every successful AMM tx updates UI state and receipt.
- If amount > 20% TVL, UI blocks with explicit VALS message.

### 2) CLOB Order Book Both Sides + Matching
1. Wallet A: place YES limit at `P` (example `60c`) for `20 USDC`.
2. Wallet B: place NO limit at `100-P` (`40c`) for `20 USDC`.
3. Confirm:
- Orders appear in depth and open orders.
- Complementary orders match and depth updates.
- Cancel flow works for unmatched orders.

Pass criteria:
- Order book updates without refresh hacks.
- Matching and cancel behavior are deterministic.

### 3) Market End Visibility
1. In `Markets`, verify every market card shows end information.
2. Confirm `Ends <date>` renders when `expiresAt` exists.

Pass criteria:
- End timing is clear on list view for all live markets.

### 4) LP and Gravity Explanation UX
1. Open LP tab.
2. Hover gravity info bubble.
3. Confirm explanation covers:
- why gravity pool grows;
- why LP reserve shifts can move implied price.

Pass criteria:
- Explanations are visible and understandable in-panel.

### 5) Yield Breakdown UX
1. Open Yield tab.
2. Confirm:
- minority and majority APY shown;
- explanatory block under metrics is present;
- minority/majority weight split text is visible.

Pass criteria:
- User can understand why both sides earn, with minority tilt.

## Evidence to Capture
- 1 screenshot per section above.
- 2 explorer tx links for AMM trades.
- 2 explorer tx links for CLOB placement/match/cancel.
- Short notes for any mismatch (`expected`, `actual`, `market`, `wallet`, `tx`).

## Defect Log Template
| ID | Area | Expected | Actual | Repro Steps | Tx/Link | Severity |
|----|------|----------|--------|-------------|---------|----------|
| D-01 | AMM | ... | ... | ... | ... | High/Med/Low |

