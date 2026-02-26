import React from "react";
import { MARKETS } from "../data/appData";

function IgnitionPage() {
  const ignition = MARKETS.filter((m) => m.phase === "ignition");

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Veritas Ignition</h1>
        <p className="page-sub">Permissionless launch flow with graduation and governance controls.</p>
      </div>

      <div className="ignition-layout">
        <section className="card ignition-form">
          <div className="section-label">Launch Workflow</div>
          <div className="wizard-steps">
            {["Market Question", "Category & Dates", "Oracle Setup", "Review & Launch"].map((step, i) => (
              <div className="ws-item" key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <div>
              <label className="inp-label">Market Question</label>
              <input className="inp" placeholder="Will X happen before Y?" />
            </div>
            <div>
              <label className="inp-label">Category</label>
              <input className="inp" placeholder="Macro / Crypto / Politics / Tech" />
            </div>
            <div>
              <label className="inp-label">Resolution Date</label>
              <input className="inp" placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <label className="inp-label">Creation Fee</label>
              <input className="inp" value="$50 USDC" readOnly />
            </div>
          </div>
          <button className="btn btn-primary">Launch Market - $50</button>
        </section>

        <aside className="side-stack">
          <article className="card side-card">
            <div className="section-label">Active Ignition Markets</div>
            {ignition.map((m) => (
              <div className="ignition-item" key={m.id}>
                <p>{m.question}</p>
                <small>
                  TVL ${m.tvl.toLocaleString()} / ${m.tvlTarget.toLocaleString()}
                </small>
              </div>
            ))}
          </article>
          <article className="card side-card">
            <div className="section-label">How Ignition Works</div>
            <ul>
              <li>$50 creation fee</li>
              <li>50/50 neutral bootstrap</li>
              <li>Graduation by TVL and participant thresholds</li>
              <li>Escrowed fee injection to minority side</li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  );
}

export default IgnitionPage;
