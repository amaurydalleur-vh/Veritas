# Step 4 - PoC Validation Results

Run date:
Tester:
Network:
Build/Commit:

## Summary
- Total checks:
- Passed:
- Failed:
- Blocked:

## Section 1 - AMM Execution and Price Update

### 1.1 Small AMM trade (`5 USDC`)
- Status: `PASS`
- Market: `Will the US CPI print below 3% in May 2025?` (to confirm)
- Wallet: `tester wallet` (to confirm)
- Tx: `https://sepolia.arbiscan.io/tx/0x19cc5d2b175e4238451ee14f642fd2008e542ee1e534c4135af7afb9b27840cb`
- Notes: Small AMM order executed on-chain. UI receipt/price update confirmation pending tester note.

### 1.2 Medium AMM trade (`~75 USDC`, under 20% TVL)
- Status: `PASS / FAIL / BLOCKED`
- Market:
- Wallet:
- Tx:
- Notes:

### 1.3 Oversized AMM trade (`>20% TVL`) rejection UX
- Status: `PASS / FAIL / BLOCKED`
- Market:
- Wallet:
- Notes:

## Section 2 - CLOB Lifecycle and Matching

### 2.1 YES order placement
- Status: `PASS`
- Market: `Will the US CPI print below 3% in May 2025?` (to confirm)
- Wallet: `tester wallet` (to confirm)
- Tx: `https://sepolia.arbiscan.io/tx/0xc207275a42c6194324cab1194501e4a53bb6609094c46c2ea34170234f880a63`
- Notes: Limit order buy submitted and confirmed on-chain.

### 2.2 NO complementary order placement
- Status: `PASS / FAIL / BLOCKED`
- Market:
- Wallet:
- Tx:
- Notes:

### 2.3 Match confirmation (book update)
- Status: `PASS / FAIL / BLOCKED`
- Market:
- Notes:

### 2.4 Cancel unmatched order
- Status: `PASS / FAIL / BLOCKED`
- Market:
- Wallet:
- Tx:
- Notes:

## Section 3 - Market End Visibility

### 3.1 End-date clarity on market cards
- Status: `PASS / FAIL / BLOCKED`
- Notes:

## Section 4 - LP / Gravity UX

### 4.1 Gravity info bubble
- Status: `PASS / FAIL / BLOCKED`
- Notes:

### 4.2 Price impact explanation from reserve imbalance
- Status: `PASS / FAIL / BLOCKED`
- Notes:

## Section 5 - Yield Breakdown UX

### 5.1 Minority/Majority APY display
- Status: `PASS / FAIL / BLOCKED`
- Notes:

### 5.2 Explanatory block under APY numbers
- Status: `PASS / FAIL / BLOCKED`
- Notes:

## Evidence
- Screenshot links/paths:
1.
2.
3.
4.
5.

- Explorer links:
1. https://sepolia.arbiscan.io/tx/0x19cc5d2b175e4238451ee14f642fd2008e542ee1e534c4135af7afb9b27840cb
2. https://sepolia.arbiscan.io/tx/0xc207275a42c6194324cab1194501e4a53bb6609094c46c2ea34170234f880a63
3.
4.

## Defects
| ID | Area | Expected | Actual | Repro Steps | Tx/Link | Severity | Status |
|----|------|----------|--------|-------------|---------|----------|--------|
| D-01 |  |  |  |  |  |  | Open |

## Sign-off
- Ready for next step (`YES/NO`):
- Conditions for sign-off:
