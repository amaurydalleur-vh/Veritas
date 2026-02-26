import React from "react";

import SectionHeader from "../components/SectionHeader";
import { controls } from "../data/siteContent";

function ControlsSection() {
  return (
    <section id="controls" className="content-section">
      <SectionHeader
        eyebrow="Control Framework"
        title="Security, Governance, and Settlement Discipline"
        subtitle="Control surfaces are explicitly defined to reduce operational ambiguity and increase auditability for counterparties."
      />
      <div className="control-grid">
        {controls.map((control) => (
          <article className="panel-card" key={control.title}>
            <h3>{control.title}</h3>
            <ul>
              {control.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ControlsSection;
