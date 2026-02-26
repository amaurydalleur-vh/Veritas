import React from "react";

function StatStrip({ items }) {
  return (
    <div className="stat-strip">
      {items.map((item) => (
        <article className="stat-card" key={item.label}>
          <p>{item.label}</p>
          <h3>{item.value}</h3>
        </article>
      ))}
    </div>
  );
}

export default StatStrip;
