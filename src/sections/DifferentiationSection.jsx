import React from "react";

import SectionHeader from "../components/SectionHeader";
import { differentiationRows } from "../data/siteContent";

function DifferentiationSection() {
  return (
    <section id="differentiation" className="content-section">
      <SectionHeader
        eyebrow="Market Positioning"
        title="Comparative Product Differentiation"
        subtitle="Veritas is structured around minority protection, launch accessibility, and yield-linked market participation."
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Polymarket</th>
              <th>Kalshi</th>
              <th>Veritas</th>
            </tr>
          </thead>
          <tbody>
            {differentiationRows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DifferentiationSection;
