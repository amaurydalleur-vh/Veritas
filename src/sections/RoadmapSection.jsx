import React from "react";

import SectionHeader from "../components/SectionHeader";
import { roadmap } from "../data/siteContent";

function RoadmapSection() {
  return (
    <section id="roadmap" className="content-section">
      <SectionHeader
        eyebrow="Execution Plan"
        title="Roadmap and Delivery Sequence"
        subtitle="Development is sequenced around production hardening, launch reliability, and institutional integration readiness."
      />

      <div className="roadmap-grid">
        {roadmap.map((item) => (
          <article className="roadmap-card" key={item.phase}>
            <p>{item.phase}</p>
            <h3>{item.title}</h3>
            <span>{item.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default RoadmapSection;
