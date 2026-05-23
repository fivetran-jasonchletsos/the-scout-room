// Architecture page hero visuals. Zero-dep SVG + CSS, matches the existing
// chalk/gold/spark/mint palette in globals.css. The three exported components
// are the "wow" surface for the architecture page:
//
//   ArchitectureFlow — six-stage horizontal pipeline with animated particles
//                      moving between stages, vendor-coded color accents.
//   IcebergStack     — physical lake visualization showing bronze/silver/gold
//                      as stacked layers under one Iceberg footprint.
//   CortexHub        — five-spoke wheel showing each Cortex capability and
//                      what it backs in the demo.

import React from "react";

// ─────────────────────────────────────────────────────────────────────────
// Shared color tokens (sourced from globals.css palette).
// ─────────────────────────────────────────────────────────────────────────

const C = {
  gold:    "#d4a93f",
  spark:   "#3b9eff",
  mint:    "#10b981",
  bronze:  "#b45c3a",
  silver:  "#cfd6e0",
  chalk:   "#e9edf2",
  surface: "rgba(255,255,255,0.04)",
};

// ─────────────────────────────────────────────────────────────────────────
// ArchitectureFlow — the hero pipeline. Six stages with vendor coloring,
// animated gold particles flowing through the connectors.
// ─────────────────────────────────────────────────────────────────────────

type Stage = {
  key: string;
  title: string;
  vendor: string;
  stat: string;
  color: string;
  icon: string;       // single-letter monogram
};

const STAGES: Stage[] = [
  { key: "src",     title: "Sources",    vendor: "Lahman · Statcast · MLB API", stat: "150 years · pitch-level",     color: C.silver, icon: "S" },
  { key: "ftran",   title: "Ingestion",  vendor: "Fivetran",                    stat: "750+ connectors · Iceberg",   color: C.spark,  icon: "F" },
  { key: "iceberg", title: "Lake",       vendor: "Apache Iceberg on S3",        stat: "bronze · silver · gold",      color: C.gold,   icon: "I" },
  { key: "dbt",     title: "Transform",  vendor: "dbt",                          stat: "10+ models · tests · docs",  color: C.bronze, icon: "d" },
  { key: "cortex",  title: "AI compute", vendor: "Snowflake Cortex",            stat: "EMBED · COSINE · COMPLETE",   color: C.gold,   icon: "C" },
  { key: "viewer",  title: "Viewer",     vendor: "Next.js · static export",     stat: "this app",                     color: C.mint,   icon: "N" },
];

export function ArchitectureFlow() {
  return (
    <div className="arch-flow relative">
      {/* Subtle dot grid underneath */}
      <div className="absolute inset-0 grid-overlay opacity-20 pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 md:gap-2 items-stretch">
          {STAGES.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <StageCard stage={stage} />
              {i < STAGES.length - 1 ? <Connector idx={i} /> : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  return (
    <div className="md:col-span-1 group">
      <div
        className="card-deep arch-stage h-full p-3 sm:p-3.5 flex flex-col gap-2"
        style={{ borderColor: `${stage.color}33`, ["--accent" as string]: stage.color }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center font-display font-black text-base shrink-0"
            style={{
              background: `${stage.color}22`,
              border: `1px solid ${stage.color}55`,
              color: stage.color,
            }}
          >
            {stage.icon}
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-chalk/55">{stage.title}</div>
            <div className="font-display font-bold text-chalk text-[13px] leading-tight truncate" title={stage.vendor}>
              {stage.vendor}
            </div>
          </div>
        </div>
        <div className="font-mono text-[10px] text-chalk/60 leading-snug mt-auto">{stage.stat}</div>
      </div>
    </div>
  );
}

function Connector({ idx }: { idx: number }) {
  // Animation delay staggered per connector so the particles look like
  // they're traveling the whole pipeline, not all five firing in unison.
  const delay = `${idx * 0.4}s`;
  return (
    <div className="md:col-span-1 flex md:flex-col items-center justify-center" aria-hidden>
      {/* Desktop horizontal */}
      <div className="hidden md:flex relative w-full h-8 items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
             style={{ background: "linear-gradient(90deg, rgba(212,169,63,0.0), rgba(212,169,63,0.45), rgba(212,169,63,0.0))" }} />
        <span className="arch-particle absolute top-1/2 -translate-y-1/2" style={{ animationDelay: delay }} />
      </div>
      {/* Mobile vertical (chevron) */}
      <div className="md:hidden flex items-center justify-center w-full py-1">
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden>
          <path d="M7 1 L7 17 M1 11 L7 17 L13 11" stroke="rgba(212,169,63,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IcebergStack — the physical lake. Three stacked layers (bronze/silver/gold)
// with the Iceberg footprint underneath, showing that the same files are
// read by Snowflake, dbt, and any other engine that shows up.
// ─────────────────────────────────────────────────────────────────────────

export function IcebergStack() {
  const layers = [
    { name: "GOLD",   color: C.gold,   tables: ["dim_player_career", "agg_era_normalized_profiles", "agg_franchise_decade_position", "dim_city_centroid"] },
    { name: "SILVER", color: C.silver, tables: ["stg_players", "stg_batting_yr", "stg_pitching_yr"] },
    { name: "BRONZE", color: C.bronze, tables: ["lahman_*", "statcast_pitches", "mlb_rosters"] },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6 items-center">
      <div className="space-y-3">
        {layers.map((layer) => (
          <div key={layer.name} className="card-deep p-4 relative overflow-hidden"
               style={{ borderColor: `${layer.color}33` }}>
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: layer.color }} />
            <div className="pl-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="font-display font-black text-base tracking-[0.18em]" style={{ color: layer.color }}>
                  {layer.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                  {layer.tables.length} tables
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {layer.tables.map((t) => (
                  <span key={t} className="font-mono text-[10.5px] text-chalk/70 px-2 py-0.5 rounded"
                        style={{ background: `${layer.color}14`, border: `1px solid ${layer.color}33` }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/40 pl-1">
          ↑ promoted by dbt · materialized on Snowflake · stored as Iceberg on S3
        </div>
      </div>

      {/* The "iceberg" itself — a stylized side view */}
      <div className="card-deep p-5 relative overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-30 pointer-events-none" aria-hidden />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85 mb-3">
            One lake · many engines
          </p>
          <svg viewBox="0 0 280 200" className="w-full h-auto" role="img" aria-label="Iceberg lake federated by multiple compute engines">
            {/* Waterline */}
            <line x1="0" y1="80" x2="280" y2="80" stroke="rgba(207,214,224,0.35)" strokeWidth="0.5" strokeDasharray="3 3" />
            <text x="6" y="76" fill="rgba(207,214,224,0.55)" style={{ fontSize: "8px", letterSpacing: "0.2em" }}>WATERLINE</text>

            {/* Iceberg shape */}
            <polygon
              points="80,80 200,80 240,170 40,170"
              fill="url(#bergGrad)"
              stroke="rgba(212,169,63,0.45)"
              strokeWidth="1"
            />
            {/* Above-water tip */}
            <polygon
              points="120,80 160,80 140,40"
              fill="rgba(240,210,127,0.35)"
              stroke="rgba(212,169,63,0.6)"
              strokeWidth="0.8"
            />

            {/* Labels for layers inside */}
            <text x="140" y="106" textAnchor="middle" fill="#d4a93f" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em" }}>GOLD</text>
            <text x="140" y="132" textAnchor="middle" fill="#cfd6e0" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em" }}>SILVER</text>
            <text x="140" y="158" textAnchor="middle" fill="#b45c3a" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em" }}>BRONZE</text>

            {/* Compute engines pointing in */}
            <EngineDart x={20}  y={45} label="Snowflake" />
            <EngineDart x={130} y={20} label="Cortex"    />
            <EngineDart x={230} y={45} label="dbt"       />

            <defs>
              <linearGradient id="bergGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="rgba(212,169,63,0.20)" />
                <stop offset="60%" stopColor="rgba(180,92,58,0.18)" />
                <stop offset="100%" stopColor="rgba(180,92,58,0.10)" />
              </linearGradient>
            </defs>
          </svg>
          <p className="mt-2 font-mono text-[10px] text-chalk/55 leading-relaxed">
            Snowflake federates via external volumes. Same bytes are queryable from
            Athena, Databricks, DuckDB — whoever shows up.
          </p>
        </div>
      </div>
    </div>
  );
}

function EngineDart({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="2.5" fill="#d4a93f" />
      <text x={x} y={y - 6} textAnchor="middle" fill="rgba(207,214,224,0.85)" style={{ fontSize: "9px", fontWeight: 600 }}>
        {label}
      </text>
      <line x1={x} y1={y + 2} x2={140} y2={80} stroke="rgba(212,169,63,0.35)" strokeWidth="0.6" strokeDasharray="2 2" />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CortexHub — five Cortex capabilities radiating from a central node. Each
// spoke shows what the capability does and what UI surface it backs.
// ─────────────────────────────────────────────────────────────────────────

type Spoke = {
  fn: string;
  blurb: string;
  used: string;
  angle: number;   // degrees, 0 = east, clockwise
};

const SPOKES: Spoke[] = [
  { fn: "EMBED_TEXT_768",      blurb: "Career profile vectors", used: "PLAYER_EMBEDDINGS",  angle: -90 },
  { fn: "COSINE_SIM_ARR",      blurb: "Era-adjusted comp",       used: "FIND_HIDDEN_COMP",    angle: -30 },
  { fn: "Cortex SEARCH",       blurb: "Free-form similarity",    used: "PLAYER_SEARCH",       angle:  30 },
  { fn: "COMPLETE",            blurb: "Closing narrative",       used: "SCOUT_NARRATIVE",     angle:  90 },
  { fn: "Cortex ANALYST",      blurb: "NL Q+A on gold",          used: "scout_analyst.yaml",  angle: 150 },
];

export function CortexHub({ size = 520 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.34;
  return (
    <div className="card-deep p-5 relative">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85 mb-2">
        Cortex surface · five capabilities, one warehouse
      </p>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" role="img" aria-label="Snowflake Cortex capability wheel">
        {/* Background rings */}
        {[1, 0.7, 0.4].map((rel) => (
          <circle key={rel} cx={cx} cy={cy} r={r * rel}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1" />
        ))}
        {/* Spokes */}
        {SPOKES.map((s) => {
          const rad = (s.angle * Math.PI) / 180;
          const x = cx + Math.cos(rad) * r;
          const y = cy + Math.sin(rad) * r;
          return (
            <g key={s.fn}>
              <line x1={cx} y1={cy} x2={x} y2={y}
                    stroke="rgba(212,169,63,0.25)" strokeWidth="1" />
              <circle cx={x} cy={y} r="6" fill="#d4a93f" fillOpacity="0.18"
                      stroke="#d4a93f" strokeWidth="1.5" />
            </g>
          );
        })}
        {/* Center node */}
        <circle cx={cx} cy={cy} r="32"
                fill="rgba(212,169,63,0.18)"
                stroke="#d4a93f" strokeWidth="1.5" />
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#f0d27f"
              style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em" }}>
          CORTEX
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(207,214,224,0.6)"
              style={{ fontSize: "8px", letterSpacing: "0.22em" }}>
          on Snowflake
        </text>
        {/* Spoke labels */}
        {SPOKES.map((s) => {
          const rad = (s.angle * Math.PI) / 180;
          const lx = cx + Math.cos(rad) * (r + 30);
          const ly = cy + Math.sin(rad) * (r + 30);
          const anchor = Math.abs(Math.cos(rad)) < 0.2 ? "middle" :
                         Math.cos(rad) > 0 ? "start" : "end";
          return (
            <g key={s.fn}>
              <text x={lx} y={ly - 6} textAnchor={anchor}
                    fill="#f0d27f"
                    style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.12em" }}>
                {s.fn}
              </text>
              <text x={lx} y={ly + 7} textAnchor={anchor}
                    fill="rgba(207,214,224,0.85)"
                    style={{ fontSize: "10px" }}>
                {s.blurb}
              </text>
              <text x={lx} y={ly + 21} textAnchor={anchor}
                    fill="rgba(207,214,224,0.45)"
                    style={{ fontSize: "9px", letterSpacing: "0.12em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                used by · {s.used}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
