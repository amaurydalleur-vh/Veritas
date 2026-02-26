import React from "react";

function LiveDot({ variant = "jade" }) {
  const className = variant === "amber" ? "live-dot amber" : "live-dot";
  return <span className={className} />;
}

export default LiveDot;
