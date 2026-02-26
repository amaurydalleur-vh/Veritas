import React, { useMemo, useState } from "react";
import HeroSection from "./sections/HeroSection";
import MechanicsSection from "./sections/MechanicsSection";
import DifferentiationSection from "./sections/DifferentiationSection";
import ControlsSection from "./sections/ControlsSection";
import IgnitionSection from "./sections/IgnitionSection";
import RoadmapSection from "./sections/RoadmapSection";
import FooterSection from "./sections/FooterSection";
import PlatformPage from "./sections/platform/PlatformPage";

const overviewLinks = [
  { id: "mechanics", label: "Mechanics" },
  { id: "differentiation", label: "Differentiation" },
  { id: "controls", label: "Controls" },
  { id: "ignition", label: "Ignition" },
  { id: "roadmap", label: "Roadmap" }
];

const platformLinks = [
  { id: "live-markets", label: "Markets" },
  { id: "launch-funnel", label: "Launch Funnel" },
  { id: "portfolio-ops", label: "Portfolio Ops" }
];

function App() {
  const [page, setPage] = useState("overview");
  const navLinks = useMemo(
    () => (page === "overview" ? overviewLinks : platformLinks),
    [page]
  );

  return (
    <div id="top" className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#top" className="brand">
            VERITAS
          </a>
          <div className="page-switch">
            <button
              className={`page-chip ${page === "overview" ? "active" : ""}`}
              onClick={() => setPage("overview")}
              type="button"
            >
              Overview
            </button>
            <button
              className={`page-chip ${page === "platform" ? "active" : ""}`}
              onClick={() => setPage("platform")}
              type="button"
            >
              Platform
            </button>
          </div>
          <nav>
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`}>
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href={page === "overview" ? "#roadmap" : "#portfolio-ops"}
            className="btn btn-primary compact"
          >
            {page === "overview" ? "Litepaper View" : "Operations View"}
          </a>
        </div>
      </header>

      <main>
        {page === "overview" ? (
          <>
            <HeroSection />
            <MechanicsSection />
            <DifferentiationSection />
            <ControlsSection />
            <IgnitionSection />
            <RoadmapSection />
          </>
        ) : (
          <PlatformPage />
        )}
      </main>

      <FooterSection />
    </div>
  );
}

export default App;
