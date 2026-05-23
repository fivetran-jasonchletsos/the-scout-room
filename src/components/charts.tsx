// Hand-rolled SVG chart kit for the Scout Report. Zero dependencies.
// All charts assume the data is already sorted / normalized by the caller.

// ─────────────────────────────────────────────────────────────────────
// CareerTimeline — horizontal era bar showing when a player's career was
// ─────────────────────────────────────────────────────────────────────

const ERA_BAND: { name: string; start: number; end: number; color: string }[] = [
  { name: "19c",          start: 1871, end: 1899, color: "#3a4a5e" },
  { name: "Dead Ball",    start: 1900, end: 1919, color: "#5a3a30" },
  { name: "Live Ball",    start: 1920, end: 1941, color: "#7a5532" },
  { name: "Integration",  start: 1942, end: 1960, color: "#3f6b3a" },
  { name: "Expansion",    start: 1961, end: 1976, color: "#3b7a8e" },
  { name: "Free Agency",  start: 1977, end: 1993, color: "#4f5a7a" },
  { name: "Steroid",      start: 1994, end: 2005, color: "#7a3a5e" },
  { name: "Post-Steroid", start: 2006, end: 2014, color: "#5e6e3a" },
  { name: "Statcast",     start: 2015, end: 2024, color: "#d4a93f" },
];

export function CareerTimeline({
  debutYear, finalYear, minYear = 1871, maxYear = 2024,
}: {
  debutYear: number; finalYear: number; minYear?: number; maxYear?: number;
}) {
  const span = maxYear - minYear;
  const pctOf = (y: number) => ((y - minYear) / span) * 100;
  const start = Math.max(minYear, debutYear);
  const end   = Math.max(start, Math.min(maxYear, finalYear || debutYear));
  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-sm overflow-hidden border border-white/[0.06]">
        {/* Era bands */}
        {ERA_BAND.map((e) => {
          const a = pctOf(Math.max(e.start, minYear));
          const b = pctOf(Math.min(e.end,   maxYear));
          return (
            <div key={e.name}
                 className="absolute inset-y-0"
                 style={{ left: `${a}%`, width: `${b - a}%`, background: e.color, opacity: 0.32 }} />
          );
        })}
        {/* Player's career — gold bar on top */}
        <div className="absolute inset-y-0 rounded-sm"
             style={{
               left: `${pctOf(start)}%`,
               width: `${Math.max(pctOf(end) - pctOf(start), 0.6)}%`,
               background: "linear-gradient(180deg, #f0d27f 0%, #d4a93f 100%)",
               boxShadow: "0 0 8px rgba(212,169,63,0.5)",
             }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] tabular-nums text-chalk/40">
        <span>{minYear}</span>
        <span>{start}–{end}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StatBar — single horizontal comparison bar (used in Hidden Comp)
// ─────────────────────────────────────────────────────────────────────

export function StatBar({
  label, a, b, formatA, formatB, accentA = "#d4a93f", accentB = "#3b9eff",
}: {
  label: string;
  a: number; b: number;
  formatA?: (v: number) => string;
  formatB?: (v: number) => string;
  accentA?: string;
  accentB?: string;
}) {
  const max = Math.max(a, b, 1);
  const pctA = (a / max) * 100;
  const pctB = (b / max) * 100;
  const fa = formatA ? formatA(a) : a.toLocaleString();
  const fb = formatB ? formatB(b) : b.toLocaleString();
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-sm bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${pctA}%`, background: accentA }} />
          </div>
          <span className="font-display font-bold text-chalk text-sm tabular-nums w-16 text-right">{fa}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-sm bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${pctB}%`, background: accentB }} />
          </div>
          <span className="font-display font-bold text-chalk text-sm tabular-nums w-16 text-right">{fb}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Donut — Persona archetype breakdown
// ─────────────────────────────────────────────────────────────────────

export function Donut({
  slices, size = 180, thickness = 22,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r}
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {slices.map((s) => {
          const len  = (s.value / total) * circumference;
          const off  = circumference - acc;
          acc += len;
          return (
            <circle key={s.label}
                    cx={cx} cy={cy} r={r}
                    fill="none" stroke={s.color} strokeWidth={thickness}
                    strokeDasharray={`${len} ${circumference - len}`}
                    strokeDashoffset={off}
                    transform={`rotate(-90 ${cx} ${cy})`} />
          );
        })}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle"
              className="font-display font-black"
              fill="#e9edf2" style={{ fontSize: "28px" }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
              fill="#cfd6e0" style={{ fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase" }}>
          inner 30
        </text>
      </svg>
      <ul className="space-y-1.5 flex-1 min-w-0">
        {slices.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <li key={s.label} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="font-mono text-[11px] tabular-nums text-chalk/80 w-7">{s.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-chalk/55 w-7 text-right">{s.value}</span>
              <span className="font-mono text-[10px] tabular-nums text-chalk/40 w-9 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Position color palette — used by Donut + chip backgrounds
// ─────────────────────────────────────────────────────────────────────

export const POS_COLOR: Record<string, string> = {
  P:  "#d4a93f",
  C:  "#b45c3a",
  "1B": "#3b9eff",
  "2B": "#10b981",
  "3B": "#a855f7",
  SS: "#f59e0b",
  LF: "#84cc16",
  CF: "#06b6d4",
  RF: "#ec4899",
  DH: "#8b5cf6",
  "—": "#6b7280",
};

// ─────────────────────────────────────────────────────────────────────
// Radar — overlaid polygons for the Hidden Comp section. Each player is
// reduced to a 6-axis era-adjusted percentile vector (see scoutEngine.ts)
// and drawn here so the eye can see exactly where they overlap and where
// they diverge. Pure SVG, zero deps.
// ─────────────────────────────────────────────────────────────────────

type RadarSeries = {
  label: string;
  color: string;         // stroke / fill base color
  values: number[];      // 0..100 per axis, length must equal axes.length
};

export function Radar({
  axes, series, size = 320, rings = 4,
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
  rings?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = (size / 2) - 44;   // padding for axis labels
  const n  = axes.length;

  // Anchor each axis at -90° (top) then go clockwise.
  const angleOf = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, pct: number) => {
    const a = angleOf(i);
    const rad = (Math.max(0, Math.min(100, pct)) / 100) * r;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as const;
  };

  const polygonFor = (vals: number[]) =>
    vals.map((v, i) => pointAt(i, v).join(",")).join(" ");

  return (
    <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Era-adjusted profile radar">
      {/* Concentric rings (percentile guides) */}
      {Array.from({ length: rings }, (_, i) => {
        const ringPct = ((i + 1) / rings) * 100;
        const pts = Array.from({ length: n }, (_, j) => pointAt(j, ringPct).join(","));
        return (
          <polygon key={i}
                   points={pts.join(" ")}
                   fill="none"
                   stroke="rgba(255,255,255,0.07)"
                   strokeWidth={1} />
        );
      })}
      {/* Axis spokes */}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, 100);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        );
      })}
      {/* Series polygons */}
      {series.map((s, idx) => (
        <g key={s.label}>
          <polygon points={polygonFor(s.values)}
                   fill={s.color}
                   fillOpacity={idx === 0 ? 0.18 : 0.14}
                   stroke={s.color}
                   strokeWidth={1.5}
                   strokeOpacity={0.85} />
          {s.values.map((v, i) => {
            const [x, y] = pointAt(i, v);
            return (
              <circle key={i} cx={x} cy={y} r={2.5}
                      fill={s.color} fillOpacity={0.95} />
            );
          })}
        </g>
      ))}
      {/* Axis labels */}
      {axes.map((label, i) => {
        const a = angleOf(i);
        const lx = cx + Math.cos(a) * (r + 18);
        const ly = cy + Math.sin(a) * (r + 18);
        // Anchor text based on quadrant so labels don't crowd the polygon
        const anchor =
          Math.abs(Math.cos(a)) < 0.2 ? "middle" :
          Math.cos(a) > 0 ? "start" : "end";
        return (
          <text key={label} x={lx} y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="rgba(207,214,224,0.7)"
                style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase",
                         fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StackedBars — decade × position stacked bar for the franchise timeline.
// Pure SVG, fixed-width, the x axis is decades and each bar stacks by
// position using POS_COLOR.
// ─────────────────────────────────────────────────────────────────────

export type StackedRow = {
  label: string;                        // x-axis label (e.g. "1950s")
  segments: { key: string; value: number; color: string }[];
};

export function StackedBars({
  rows, height = 220, peakLabel,
}: {
  rows: StackedRow[];
  height?: number;
  peakLabel?: string;                   // optional label to bold-mark on the x-axis
}) {
  const padTop = 14, padBottom = 26, padLeft = 28, padRight = 12;
  const innerH = height - padTop - padBottom;
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  const ticks = niceTicks(max, 4);

  const colW = 28;
  const gap  = 10;
  const innerW = rows.length * colW + (rows.length - 1) * gap;
  const totalW = innerW + padLeft + padRight;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${totalW} ${height}`}
         preserveAspectRatio="xMinYMid meet"
         role="img" aria-label="Franchise inner-30 careers by decade and position">
      {/* Y gridlines + tick labels */}
      {ticks.map((t) => {
        const y = padTop + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={padLeft} y1={y} x2={totalW - padRight} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={padLeft - 6} y={y + 3} textAnchor="end"
                  fill="rgba(207,214,224,0.5)"
                  style={{ fontSize: "9px",
                           fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
              {t}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {rows.map((row, i) => {
        const x = padLeft + i * (colW + gap);
        let yCursor = padTop + innerH;
        const isPeak = peakLabel === row.label;
        return (
          <g key={row.label}>
            {row.segments.map((seg) => {
              const h = (seg.value / max) * innerH;
              yCursor -= h;
              return (
                <rect key={seg.key}
                      x={x} y={yCursor} width={colW} height={h}
                      fill={seg.color}
                      fillOpacity={0.85}
                      stroke="rgba(0,0,0,0.25)"
                      strokeWidth={0.5} />
              );
            })}
            <text x={x + colW / 2} y={padTop + innerH + 14}
                  textAnchor="middle"
                  fill={isPeak ? "#f0d27f" : "rgba(207,214,224,0.6)"}
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    fontWeight: isPeak ? 700 : 400,
                  }}>
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function niceTicks(max: number, count: number): number[] {
  if (max <= count) return Array.from({ length: max + 1 }, (_, i) => i);
  const step = Math.ceil(max / count);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(max);
  return ticks;
}

// ─────────────────────────────────────────────────────────────────────
// StateTileMap — 7×11 grid of US states (+ DC, PR) colored by quintile.
// Tile-map layout (no real geographic projection) keeps it readable at
// any size and dependency-free.
// ─────────────────────────────────────────────────────────────────────

// row, col for each state in a fixed grid. Anchored to roughly approximate
// US shape so the eye recognizes regions.
const TILE_GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 10],
  VT: [1, 9],  NH: [1, 10],
  WA: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], WI: [2, 5], MI: [2, 6], NY: [2, 8], MA: [2, 10],
  OR: [3, 1], ID: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IL: [3, 6], IN: [3, 7], OH: [3, 8], PA: [3, 9], NJ: [3, 10], CT: [3, 11],
  NV: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5], KY: [4, 6], WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10], RI: [4, 11],
  CA: [5, 1], AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7], SC: [5, 8], DC: [5, 9],
  HI: [6, 0], TX: [6, 3], OK: [6, 4], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8], FL: [6, 9], PR: [6, 11],
};

const QUINTILE_FILL = [
  "rgba(255,255,255,0.04)",   // 0 — empty / sparse
  "rgba(212,169,63,0.16)",
  "rgba(212,169,63,0.32)",
  "rgba(212,169,63,0.55)",
  "rgba(240,210,127,0.85)",   // 4 — densest
];

export function StateTileMap({
  cells, userCode, cell = 28, gap = 3,
}: {
  cells: { code: string; count: number; quintile: 0 | 1 | 2 | 3 | 4 }[];
  userCode: string;
  cell?: number;
  gap?: number;
}) {
  // Grid dims — derived from TILE_GRID
  const positions = Object.entries(TILE_GRID);
  const rows = Math.max(...positions.map(([, p]) => p[0])) + 1;
  const cols = Math.max(...positions.map(([, p]) => p[1])) + 1;
  const w = cols * cell + (cols - 1) * gap;
  const h = rows * cell + (rows - 1) * gap;
  const byCode = new Map(cells.map((c) => [c.code, c]));

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}
         preserveAspectRatio="xMidYMid meet"
         role="img" aria-label="US state-of-origin density tile map">
      {positions.map(([code, [r, c]]) => {
        const x = c * (cell + gap);
        const y = r * (cell + gap);
        const data = byCode.get(code);
        const q = data?.quintile ?? 0;
        const isUser = code === userCode;
        return (
          <g key={code}>
            <rect x={x} y={y} width={cell} height={cell}
                  rx={4} ry={4}
                  fill={QUINTILE_FILL[q]}
                  stroke={isUser ? "#f0d27f" : "rgba(255,255,255,0.08)"}
                  strokeWidth={isUser ? 2 : 1} />
            <text x={x + cell / 2} y={y + cell / 2 + 3}
                  textAnchor="middle"
                  fill={isUser ? "#0b1320" : q >= 4 ? "#0b1320" : "rgba(207,214,224,0.75)"}
                  style={{
                    fontSize: "9.5px",
                    fontWeight: isUser || q >= 4 ? 700 : 500,
                    letterSpacing: "0.04em",
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  }}>
              {code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StateRow — small horizontal where-this-state-ranks bar
// ─────────────────────────────────────────────────────────────────────

export function StateRankBar({
  stateValue, allValues, label,
}: { stateValue: number; allValues: number[]; label: string }) {
  const sorted = [...allValues].sort((a, b) => b - a);
  const rank = sorted.indexOf(stateValue) + 1;
  const max = sorted[0] || 1;
  const pct = (stateValue / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-chalk/65">
          rank #{rank} / {sorted.length}
        </span>
      </div>
      <div className="h-1.5 rounded-sm bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: "#d4a93f" }} />
      </div>
    </div>
  );
}
