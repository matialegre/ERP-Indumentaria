// Simple CSS-based chart components — recharts replacement for Vite 8 compatibility

/** Vertical bar chart. data: [{label, value, color?}] */
export function CssBarChart({ data = [], height = 200, color = "#7c3aed", labelKey = "name", valueKey = "value", formatValue }) {
  if (!data.length) return <div className="flex items-center justify-center h-full text-sm text-gray-400">Sin datos</div>;
  const max = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1);
  const fmt = formatValue || (v => v?.toLocaleString?.() ?? v);
  return (
    <div className="flex items-end gap-1 w-full" style={{ height }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const pct = Math.max(4, (val / max) * 100);
        const bg = d.color || color;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${d[labelKey]}: ${fmt(val)}`}>
            <span className="text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{fmt(val)}</span>
            <div className="w-full rounded-t transition-all" style={{ height: `${pct}%`, background: bg }} />
            <span className="text-[9px] text-gray-400 truncate max-w-full px-0.5">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal bar chart. data: [{label, value, color?}] */
export function CssHBarChart({ data = [], color = "#7c3aed", valueKey = "value", labelKey = "name", formatValue }) {
  if (!data.length) return <div className="text-sm text-gray-400">Sin datos</div>;
  const max = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1);
  const fmt = formatValue || (v => v?.toLocaleString?.() ?? v);
  return (
    <div className="flex flex-col gap-2 w-full">
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const pct = Math.max(2, (val / max) * 100);
        const bg = d.color || color;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-28 shrink-0 truncate text-right">{d[labelKey]}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div className="h-full rounded-full flex items-center pl-2" style={{ width: `${pct}%`, background: bg }}>
                <span className="text-[10px] text-white font-medium whitespace-nowrap">{fmt(val)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Simple line/area chart using SVG polyline */
export function CssLineChart({ data = [], height = 160, color = "#3b82f6", fill = "rgba(59,130,246,0.15)", valueKey = "value", labelKey = "name" }) {
  if (data.length < 2) return <div className="flex items-center justify-center h-full text-sm text-gray-400">Sin datos</div>;
  const vals = data.map(d => Number(d[valueKey] || 0));
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const W = 600; const H = height;
  const pad = { t: 10, b: 24, l: 8, r: 8 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const pts = vals.map((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * iW;
    const y = pad.t + (1 - (v - min) / range) * iH;
    return [x, y];
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${pts[0][0]},${H - pad.b} ` + pts.map(([x,y]) => `${x},${y}`).join(' ') + ` ${pts[pts.length-1][0]},${H - pad.b}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <polygon points={area} fill={fill} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3} fill={color} />
          <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{data[i][labelKey]}</text>
        </g>
      ))}
    </svg>
  );
}

/** Simple donut/pie chart as colored segments using conic-gradient */
export function CssPieChart({ data = [], size = 160 }) {
  if (!data.length) return <div className="text-sm text-gray-400">Sin datos</div>;
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  let acc = 0;
  const segments = data.map((d, i) => {
    const pct = (Number(d.value) || 0) / total * 100;
    const start = acc;
    acc += pct;
    return { ...d, pct, start };
  });
  const gradient = segments.map(s => `${s.fill || s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');
  return (
    <div className="flex items-center gap-6">
      <div
        className="rounded-full shrink-0"
        style={{
          width: size, height: size,
          background: `conic-gradient(${gradient})`,
          WebkitMask: `radial-gradient(circle at 50%, transparent 36%, white 37%)`,
          mask: `radial-gradient(circle at 50%, transparent 36%, white 37%)`
        }}
      />
      <div className="flex flex-col gap-1.5 text-xs">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.fill || s.color }} />
            <span className="text-gray-600">{s.name}</span>
            <span className="font-semibold ml-auto">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
