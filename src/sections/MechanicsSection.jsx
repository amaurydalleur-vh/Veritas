import React from "react";

import SectionHeader from "../components/SectionHeader";
import { mechanicsCards } from "../data/siteContent";

function MechanicsSection() {
  return (
    <section id="mechanics" className="content-section">
      <SectionHeader
        eyebrow="Core Architecture"
        title="Mechanics Built for Capital Efficiency"
        subtitle="The protocol design aligns participation incentives while maintaining execution constraints suitable for institutional workflows."
      />
      <div className="card-grid">
        {mechanicsCards.map((card) => (
          <article className="panel-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MechanicsSection;
