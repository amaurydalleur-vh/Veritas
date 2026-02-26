import React from "react";
import { NAV_PAGES } from "../../data/appData";

function Navbar({ page, onNavigate }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <button className="nav-logo" onClick={() => onNavigate("landing")}>
          <span className="nav-gem" />
          <span>VERITAS</span>
        </button>
        <nav className="nav-links">
          {NAV_PAGES.map(([id, label]) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="nav-cta" onClick={() => onNavigate("portfolio")}>
          Connect Wallet
        </button>
      </div>
    </header>
  );
}

export default Navbar;
