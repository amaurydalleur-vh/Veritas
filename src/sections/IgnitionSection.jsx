import React from "react";

import SectionHeader from "../components/SectionHeader";
import { ignitionSteps } from "../data/siteContent";

function IgnitionSection() {
  return (
    <section id="ignition" className="content-section">
      <SectionHeader
        eyebrow="Launch System"
        title="Veritas Ignition"
        subtitle="A low-friction but rule-constrained market onboarding path with explicit graduation criteria and structured fee deployment."
      />

      <div className="timeline-panel">
        {ignitionSteps.map((step, index) => (
          <div key={step} className="timeline-row">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default IgnitionSection;
