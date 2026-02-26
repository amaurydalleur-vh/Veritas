import React from "react";

function Ticker({ markets }) {
  const line = markets
    .map(
      (m) =>
        `${m.question.slice(0, 40)}...  ${(m.yes * 100).toFixed(0)}c YES  ${(m.no * 100).toFixed(0)}c NO`
    )
    .join("   ·   ");
  const text = `${line}   ·   ${line}`;

  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        <span>{text}</span>
      </div>
    </div>
  );
}

export default Ticker;
