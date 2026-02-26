import React from "react";

import SectionHeader from "../../components/SectionHeader";
import { portfolioBlocks } from "../../data/platformContent";

function PortfolioOperationsSection() {
  return (
    <section id="portfolio-ops" className="content-section">
      <SectionHeader
        eyebrow="Portfolio"
        title="Portfolio and Control Operations"
        subtitle="Operational views designed for risk committees, strategy teams, and protocol governance participants."
      />

      <div className="control-grid">
        {portfolioBlocks.map((block) => (
          <article className="panel-card" key={block.title}>
            <h3>{block.title}</h3>
            <ul>
              {block.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PortfolioOperationsSection;
