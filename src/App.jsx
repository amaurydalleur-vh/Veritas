import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/layout/Navbar";
import Ticker from "./components/ui/Ticker";
import { MARKETS } from "./data/appData";
import LandingPage from "./pages/LandingPage";
import MarketsPage from "./pages/MarketsPage";
import MarketDetailPage from "./pages/MarketDetailPage";
import IgnitionPage from "./pages/IgnitionPage";
import IgnitionDetailPage from "./pages/IgnitionDetailPage";
import YieldDeskPage from "./pages/YieldDeskPage";
import PortfolioPage from "./pages/PortfolioPage";
import DocsPage from "./pages/DocsPage";
import AdminPage from "./pages/AdminPage";

const PAGE_TO_PATH = {
  landing: "/",
  markets: "/markets",
  ignition: "/ignition",
  ignitionDetail: "/ignition",
  yieldDesk: "/yield-desk",
  portfolio: "/portfolio",
  docs: "/docs",
  admin: "/admin",
  market: "/markets"
};

function pathToPage(pathname) {
  const path = pathname.toLowerCase();
  if (/^\/ignition\/\d+$/.test(path)) return "ignitionDetail";
  if (path === "/admin") return "admin";
  if (path === "/markets") return "markets";
  if (path === "/ignition") return "ignition";
  if (path === "/yield-desk") return "yieldDesk";
  if (path === "/portfolio") return "portfolio";
  if (path === "/docs") return "docs";
  return "landing";
}

function parseIgnitionId(pathname) {
  const m = pathname.toLowerCase().match(/^\/ignition\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function App() {
  const [page, setPage] = useState(() => pathToPage(window.location.pathname));
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedLaunchId, setSelectedLaunchId] = useState(() => parseIgnitionId(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setPage(pathToPage(window.location.pathname));
      setSelectedLaunchId(parseIgnitionId(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPage, { replace = false, pathOverride = null } = {}) => {
    setPage(nextPage);
    const targetPath = pathOverride || PAGE_TO_PATH[nextPage] || "/";
    if (window.location.pathname !== targetPath) {
      if (replace) window.history.replaceState({}, "", targetPath);
      else window.history.pushState({}, "", targetPath);
    }
  };

  const content = useMemo(() => {
    if (page === "landing") {
      return (
        <LandingPage
          onNavigate={navigate}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            navigate("market");
          }}
        />
      );
    }
    if (page === "markets") {
      return (
        <MarketsPage
          onNavigate={navigate}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            navigate("market");
          }}
        />
      );
    }
    if (page === "market") {
      return selectedMarket ? (
        <MarketDetailPage market={selectedMarket} onBack={() => navigate("markets")} />
      ) : (
        <MarketsPage
          onNavigate={navigate}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            navigate("market");
          }}
        />
      );
    }
    if (page === "ignition") {
      return (
        <IgnitionPage
          onOpenLaunch={(launchId) => {
            setSelectedLaunchId(launchId);
            navigate("ignitionDetail", { pathOverride: `/ignition/${launchId}` });
          }}
        />
      );
    }
    if (page === "ignitionDetail") {
      return selectedLaunchId !== null ? (
        <IgnitionDetailPage
          launchId={selectedLaunchId}
          onBack={() => navigate("ignition")}
          onOpenLiveMarket={(market) => {
            setSelectedMarket(market);
            navigate("market");
          }}
        />
      ) : (
        <IgnitionPage
          onOpenLaunch={(launchId) => {
            setSelectedLaunchId(launchId);
            navigate("ignitionDetail", { pathOverride: `/ignition/${launchId}` });
          }}
        />
      );
    }
    if (page === "yieldDesk") return <YieldDeskPage />;
    if (page === "portfolio") return <PortfolioPage />;
    if (page === "docs") return <DocsPage />;
    if (page === "admin") return <AdminPage />;
    return (
      <LandingPage
        onNavigate={navigate}
        onOpenMarket={(market) => {
          setSelectedMarket(market);
          navigate("market");
        }}
      />
    );
  }, [page, selectedMarket]);

  return (
    <div>
      <Navbar page={page === "ignitionDetail" ? "ignition" : page} onNavigate={navigate} />
      {page !== "landing" && MARKETS.length > 0 ? <Ticker markets={MARKETS} /> : null}
      {content}
    </div>
  );
}

export default App;
