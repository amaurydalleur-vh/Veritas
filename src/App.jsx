import React, { useMemo, useState } from "react";
import Navbar from "./components/layout/Navbar";
import Ticker from "./components/ui/Ticker";
import { MARKETS } from "./data/appData";
import LandingPage from "./pages/LandingPage";
import MarketsPage from "./pages/MarketsPage";
import MarketDetailPage from "./pages/MarketDetailPage";
import IgnitionPage from "./pages/IgnitionPage";
import PortfolioPage from "./pages/PortfolioPage";
import DocsPage from "./pages/DocsPage";

function App() {
  const [page, setPage] = useState("landing");
  const [selectedMarket, setSelectedMarket] = useState(null);

  const content = useMemo(() => {
    if (page === "landing") {
      return (
        <LandingPage
          onNavigate={setPage}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            setPage("market");
          }}
        />
      );
    }
    if (page === "markets") {
      return (
        <MarketsPage
          onNavigate={setPage}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            setPage("market");
          }}
        />
      );
    }
    if (page === "market") {
      return selectedMarket ? (
        <MarketDetailPage market={selectedMarket} onBack={() => setPage("markets")} />
      ) : (
        <MarketsPage
          onNavigate={setPage}
          onOpenMarket={(market) => {
            setSelectedMarket(market);
            setPage("market");
          }}
        />
      );
    }
    if (page === "ignition") return <IgnitionPage />;
    if (page === "portfolio") return <PortfolioPage />;
    if (page === "docs") return <DocsPage />;
    return (
      <LandingPage
        onNavigate={setPage}
        onOpenMarket={(market) => {
          setSelectedMarket(market);
          setPage("market");
        }}
      />
    );
  }, [page, selectedMarket]);

  return (
    <div>
      <Navbar page={page} onNavigate={setPage} />
      {page !== "landing" ? <Ticker markets={MARKETS} /> : null}
      {content}
    </div>
  );
}

export default App;
