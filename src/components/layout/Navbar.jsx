import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NAV_PAGES } from "../../data/appData";
import FaucetButton from "../FaucetButton";

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
        <div className="nav-actions">
          <FaucetButton />
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
