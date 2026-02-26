import React from "react";
import Badge from "../components/ui/Badge";
import { DOC_SECTIONS } from "../data/appData";

function DocsPage() {
  return (
    <div className="container page">
      <div className="docs-layout">
        <Badge variant="amber">Technical Litepaper - Feb 2026</Badge>
        <h1 className="page-title" style={{ marginTop: "10px" }}>
          VERITAS
        </h1>
        <p className="page-sub">Yield-Bearing Prediction Markets - Production Architecture</p>

        {DOC_SECTIONS.map(([title, body], i) => (
          <section className="doc-row" key={title}>
            <div className="doc-index">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </section>
        ))}

        <section className="card compare-wrap">
          <h3>Competitive Positioning</h3>
          <table className="tbl compare-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Polymarket</th>
                <th>Kalshi</th>
                <th>Veritas</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Minority LP yield", "No", "No", "Yes"],
                ["Wash-trade guard", "None", "None", "Net flow only"],
                ["VALS slippage cap", "None", "None", "50% max"],
                ["Yield-bearing orders", "No", "No", "Yes"],
                ["Permissionless create", "No", "No", "$50 Ignition"],
                ["LP APY", "0%", "0%", "100%+ minority"]
              ].map(([feature, a, b, c]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td className="veritas">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default DocsPage;
