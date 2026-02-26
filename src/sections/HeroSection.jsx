import React from "react";

import StatStrip from "../components/StatStrip";
import { heroStats } from "../data/siteContent";

function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-panel">
        <p className="eyebrow">Institutional Prediction Infrastructure</p>
        <h1>VERITAS</h1>
        <p className="hero-subtitle">
          A yield-bearing prediction market framework designed for disciplined
          capital, transparent market launch mechanics, and auditable risk
          controls.
        </p>
        <div className="hero-actions">
          <a href="#mechanics" className="btn btn-primary">
            Review Mechanics
          </a>
          <a href="#controls" className="btn btn-secondary">
            Review Controls
          </a>
        </div>
      </div>
      <StatStrip items={heroStats} />
    </section>
  );
}

export default HeroSection;
