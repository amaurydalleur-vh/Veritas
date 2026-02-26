import React from "react";

import StatStrip from "../../components/StatStrip";
import { platformStats } from "../../data/platformContent";

function PlatformHeroSection() {
  return (
    <section className="hero">
      <div className="hero-panel">
        <p className="eyebrow">Product View</p>
        <h1>Institutional Market Operations Console</h1>
        <p className="hero-subtitle">
          A structured view of live markets, launch funnel progression, and
          portfolio control surfaces, aligned with the Veritas litepaper
          mechanics.
        </p>
      </div>
      <StatStrip items={platformStats} />
    </section>
  );
}

export default PlatformHeroSection;
