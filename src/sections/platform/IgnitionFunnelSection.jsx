import React from "react";

import SectionHeader from "../../components/SectionHeader";
import { ignitionFunnel } from "../../data/platformContent";

function IgnitionFunnelSection() {
  return (
    <section id="launch-funnel" className="content-section">
      <SectionHeader
        eyebrow="Ignition"
        title="Launch Funnel and Graduation Progress"
        subtitle="Lifecycle visibility from market proposal to transition into the core market layer."
      />

      <div className="funnel-grid">
        {ignitionFunnel.map((item) => (
          <article className="panel-card funnel-card" key={item.label}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}

export default IgnitionFunnelSection;
