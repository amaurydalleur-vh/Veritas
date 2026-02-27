import React, { useMemo } from "react";
import { useOrderBook, formatUSDC } from "../web3/hooks";

/**
 * Two-sided CLOB depth table for a Veritas binary prediction market.
 *
 * YES buyers sit on the left at each probability price level P.
 * NO buyers at NO price Q appear in the row P = 100 − Q (complementary pair).
 *
 * The bars are filled proportionally to the largest resting USDC amount visible.
 */
function barPct(usdc, maxUsdc) {
  if (!usdc || maxUsdc === 0n) return 0;
  return Math.min(100, Number((usdc * 100n) / maxUsdc));
}

function OrderBookPanel({ marketAddress, openOrders = [], onCancelOrder }) {
  const { data: yesBids } = useOrderBook(marketAddress, true);
  const { data: noBids }  = useOrderBook(marketAddress, false);

  // Merge YES and NO bids into a unified price-level map (keyed by YES price)
  const levels = useMemo(() => {
    const map = new Map();
    const entry = (p) => map.get(p) ?? { price: p, yesUSDC: 0n, noUSDC: 0n };

    if (yesBids?.[0]?.length) {
      yesBids[0].forEach((p, i) => {
        const e = entry(Number(p));
        e.yesUSDC = BigInt(yesBids[1][i]);
        map.set(Number(p), e);
      });
    }
    if (noBids?.[0]?.length) {
      noBids[0].forEach((q, i) => {
        const p = 100 - Number(q);   // map NO price → YES price row
        const e = entry(p);
        e.noUSDC = BigInt(noBids[1][i]);
        map.set(p, e);
      });
    }

    return [...map.values()].sort((a, b) => b.price - a.price).slice(0, 10);
  }, [yesBids, noBids]);

  const maxUSDC = useMemo(() => {
    let max = 0n;
    for (const { yesUSDC, noUSDC } of levels) {
      if (yesUSDC > max) max = yesUSDC;
      if (noUSDC  > max) max = noUSDC;
    }
    return max;
  }, [levels]);

  if (!marketAddress) {
    return (
      <div className="ob-empty">
        Select an on-chain market to view its order book
      </div>
    );
  }

  return (
    <div className="ob-wrap">
      {/* Column headers */}
      <div className="ob-header">
        <span>YES SIZE</span>
        <span>PRICE</span>
        <span>NO SIZE</span>
      </div>

      {levels.length === 0 ? (
        <div className="ob-empty">No resting orders — be the first</div>
      ) : (
        levels.map(({ price, yesUSDC, noUSDC }) => (
          <div key={price} className="ob-row">
            {/* YES side: bar grows right-to-left from the price column */}
            <div className="ob-yes-cell">
              {yesUSDC > 0n && (
                <div
                  className="ob-bar ob-bar-yes"
                  style={{ width: `${barPct(yesUSDC, maxUSDC)}%` }}
                />
              )}
              <span className="ob-size-val">
                {yesUSDC > 0n ? `$${formatUSDC(yesUSDC)}` : "—"}
              </span>
            </div>

            <div className="ob-price-cell">{price}¢</div>

            {/* NO side: bar grows left-to-right from the price column */}
            <div className="ob-no-cell">
              {noUSDC > 0n && (
                <div
                  className="ob-bar ob-bar-no"
                  style={{ width: `${barPct(noUSDC, maxUSDC)}%` }}
                />
              )}
              <span className="ob-size-val">
                {noUSDC > 0n ? `$${formatUSDC(noUSDC)}` : "—"}
              </span>
            </div>
          </div>
        ))
      )}

      {/* User's open orders for this market */}
      {openOrders.length > 0 && (
        <div className="ob-open-orders">
          <div className="section-label" style={{ marginTop: 16, marginBottom: 8 }}>
            Open Orders
          </div>
          {openOrders.map((o) => (
            <div key={o.orderId} className="ob-order-row">
              <span className={`ob-side-badge ${o.buyYes ? "yes" : "no"}`}>
                {o.buyYes ? "YES" : "NO"}
              </span>
              <span className="ob-order-meta">@{o.price}¢</span>
              <span className="ob-order-meta">${formatUSDC(BigInt(o.size))}</span>
              <span className="ob-order-id">#{o.orderId}</span>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-ghost"
                style={{ padding: "2px 10px", fontSize: 11 }}
                onClick={() => onCancelOrder?.(o.orderId)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrderBookPanel;
