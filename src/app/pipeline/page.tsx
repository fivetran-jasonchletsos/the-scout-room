import PageHero from "@/components/PageHero";

export const metadata = { title: "Pipeline — The Scout Room" };

const CONNECTORS = [
  {
    name: "Sean Lahman's Baseball DB",
    type: "Custom (file)",
    cadence: "Weekly",
    rows: "~20K players · ~600K player-seasons",
    dest: "bronze.lahman_*",
    detail: "Polls chadwickbureau/baseballdatabank for upstream refresh, unpacks 27 CSVs, lands as Iceberg.",
  },
  {
    name: "MLB Statcast (Baseball Savant)",
    type: "Custom (HTTP)",
    cadence: "Daily, post-game",
    rows: "~750K pitches/year · ~120K batted balls/year",
    dest: "bronze.statcast_*",
    detail: "Pulls the previous day's pitch-level + batted-ball CSV exports. Includes release point, velo, spin, xwOBA.",
  },
  {
    name: "MLB Stats API",
    type: "HTTP source",
    cadence: "4× daily in-season",
    rows: "1K player snapshots/day",
    dest: "bronze.mlb_*",
    detail: "Public statsapi.mlb.com endpoints: /people, /teams/{id}/roster, /transactions, /standings.",
  },
];

const DBT_MODELS = [
  { layer: "silver", name: "stg_players",           grain: "1 / player",           depends: "lahman.people · appearances" },
  { layer: "silver", name: "stg_batting_year",      grain: "1 / player-season",    depends: "lahman.batting" },
  { layer: "silver", name: "stg_pitching_year",     grain: "1 / player-season",    depends: "lahman.pitching" },
  { layer: "silver", name: "stg_statcast_player",   grain: "1 / player-day",       depends: "statcast.pitches · batted_balls" },
  { layer: "gold",   name: "dim_player_career",     grain: "1 / player",           depends: "stg_players · _year tables · awards · hof" },
  { layer: "gold",   name: "agg_team_alumni",       grain: "1 / franchise-player", depends: "dim_player_career · teams" },
  { layer: "gold",   name: "agg_state_alumni",      grain: "1 / state-player",     depends: "dim_player_career" },
  { layer: "gold",   name: "player_embeddings",     grain: "1 / player",           depends: "dim_player_career + CORTEX.EMBED_TEXT_768" },
];

const FRESHNESS = [
  { table: "bronze.lahman_*",      ok_within: "7 days" },
  { table: "bronze.statcast_*",    ok_within: "24 hours (in-season)" },
  { table: "bronze.mlb_rosters",   ok_within: "6 hours (in-season)" },
  { table: "gold.dim_player_career", ok_within: "24 hours" },
  { table: "gold.player_embeddings", ok_within: "7 days (re-embed on schema change)" },
];

export default function PipelinePage() {
  return (
    <main>
      <PageHero
        eyebrow="Pipeline · Fivetran + dbt"
        title={<>Three connectors. Ten models. Forever fresh<span className="text-gold">.</span></>}
        lede={
          <>
            Every byte the Scout Room serves came through this pipeline. Bronze is what Fivetran wrote;
            silver is what dbt typed and cleaned; gold is what Cortex embeds and what the viewer reads.
          </>
        }
      />

      <section className="bg-abyss">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 md:px-10 py-10 sm:py-12">
          {/* Connectors */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-1">
              Fivetran connectors
            </h2>
            <p className="text-chalk/55 text-sm mb-5">All landing as Iceberg on S3.</p>
            <div className="space-y-3">
              {CONNECTORS.map((c) => (
                <div key={c.name} className="card-deep p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="font-display font-bold text-chalk text-lg">{c.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/85">
                      {c.type} · {c.cadence}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-chalk/70 leading-relaxed">{c.detail}</p>
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-6 gap-y-1.5">
                    <Pair label="Volume"      value={c.rows} />
                    <Pair label="Destination" value={c.dest} mono />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* dbt model table */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-1">
              dbt models
            </h2>
            <p className="text-chalk/55 text-sm mb-5">Bronze passthrough → silver staging → gold aggregates.</p>
            <div className="card-deep overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-chalk/65">
                  <tr>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2.5">Layer</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2.5">Model</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2.5">Grain</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2.5">Depends on</th>
                  </tr>
                </thead>
                <tbody>
                  {DBT_MODELS.map((m, i) => (
                    <tr key={m.name} className={i % 2 === 0 ? "bg-white/[0.01]" : ""}>
                      <td className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em]"
                          style={{ color: m.layer === "silver" ? "#cfd6e0" : "#d4a93f" }}>
                        {m.layer}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-chalk">{m.name}</td>
                      <td className="px-3 py-2 text-chalk/65 text-[13px]">{m.grain}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-chalk/55">{m.depends}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Freshness contract */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-1">
              Freshness contract
            </h2>
            <p className="text-chalk/55 text-sm mb-5">
              Mission Control alerts if any table breaches the threshold.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FRESHNESS.map((f) => (
                <div key={f.table} className="card-deep p-3 sm:p-4">
                  <p className="font-mono text-[12px] text-chalk">{f.table}</p>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-gold/85">
                    ≤ {f.ok_within}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Mini cmd reference */}
          <section className="chalk-panel p-5 sm:p-6">
            <p className="eyebrow">Re-running the pipeline</p>
            <pre className="mt-3 font-mono text-[12px] text-chalk/80 leading-relaxed overflow-x-auto">
{`# Refresh bronze from Fivetran (or local dev)
fivetran-cli sync --connector lahman --connector statcast --connector mlb_stats

# Rebuild silver + gold
cd dbt && dbt build --select state:modified+

# Re-embed any player whose career changed
snowsql -f cortex/sql/00_setup.sql

# Re-bake the static JSON fixture (dev only)
cd ../data-raw && python3 etl.py && python3 fetch_photos.py`}
            </pre>
          </section>
        </div>
      </section>
    </main>
  );
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-chalk/45">{label}</span>
      <span className={"text-[13px] text-chalk " + (mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}
