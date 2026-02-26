import React from "react";

import SectionHeader from "../../components/SectionHeader";
import { marketRows } from "../../data/platformContent";

function MarketsBoardSection() {
  return (
    <section id="live-markets" className="content-section">
      <SectionHeader
        eyebrow="Markets"
        title="Live Market Board"
        subtitle="Representative markets with probability, open interest, and minority-side yield profile."
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Category</th>
              <th>Implied Probability</th>
              <th>Open Interest</th>
              <th>Minority APY</th>
            </tr>
          </thead>
          <tbody>
            {marketRows.map((row) => (
              <tr key={row.market}>
                <td>{row.market}</td>
                <td>{row.category}</td>
                <td>{row.probability}</td>
                <td>{row.openInterest}</td>
                <td>{row.minorityApy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default MarketsBoardSection;
