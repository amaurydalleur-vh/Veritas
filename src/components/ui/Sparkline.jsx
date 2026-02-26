import React from "react";

function Sparkline({ data, stroke = "var(--accent)", fill = false }) {
  const width = 240;
  const height = 64;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return [x, y];
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spk">
      {fill ? <path d={area} fill={stroke} opacity="0.09" /> : null}
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export default Sparkline;
