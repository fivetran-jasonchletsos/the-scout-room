import PageHero from "@/components/PageHero";
import { ArchitectureFlow, IcebergStack, CortexHub } from "@/components/ArchitectureVisuals";

export const metadata = { title: "Architecture — The Scout Room" };

const SOURCES = [
  { name: "Lahman DB",      desc: "1871–2019 · 27 tables · ~20K players" },
  { name: "MLB Statcast",   desc: "2015+ · pitch-level + batted-ball" },
  { name: "MLB Stats API",  desc: "live roster + transactions" },
];

const STORY_BEATS = [
  {
    eyebrow: "1 · The data",
    title: "Three sources, one open lake",
    body:
      "Lahman covers 150 years. Statcast covers every pitch since 2015. The MLB Stats API covers the current season in flight. Fivetran lands all three in Apache Iceberg on S3 — open table format, ACID, time travel, no compute lock-in.",
  },
  {
    eyebrow: "2 · The transform",
    title: "dbt promotes through three layers",
    body:
      "Bronze is raw passthrough. Silver is typed and deduped. Gold is the dimensional + aggregate marts that back every panel in the Scout Report. Tests run on every promotion. The same model definitions can be rebuilt by anyone with the repo.",
  },
  {
    eyebrow: "3 · The compute",
    title: "Snowflake federates Iceberg directly",
    body:
      "Snowflake reads Iceberg via external volumes. Same bytes as dbt wrote. Cortex sits on top: vectors for similarity, SEARCH for free-form retrieval, COMPLETE for narratives, ANALYST for the prospect's own questions.",
  },
  {
    eyebrow: "4 · The viewer",
    title: "Static Next.js, bundled fixture",
    body:
      "This app is statically exported. The bundled JSON in src/data mirrors the gold tables so the demo never depends on network for the live story. In production the viewer hits a thin API route that proxies Cortex.",
  },
];

export default function ArchitecturePage() {
  return (
    <main>
      <PageHero
        eyebrow="ODI Reference Architecture · The Scout Room"
        title={<>One Iceberg lake. Three sources. Five Cortex paths<span className="text-gold">.</span></>}
        lede={
          <>
            The same files dbt writes are the ones Snowflake reads, the ones Cortex embeds, and the
            ones our Next.js viewer queries. No copies. No exports. No drift.
          </>
        }
      />

      <section className="bg-abyss">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 md:px-10 py-10 sm:py-12">

          {/* Hero flow */}
          <div className="chalk-panel p-5 sm:p-7 mb-12 relative overflow-hidden">
            <div className="relative">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
                <p className="eyebrow">End-to-end pipeline</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                  hover any stage to inspect
                </p>
              </div>
              <ArchitectureFlow />
              <div className="hairline-deep mt-7 mb-5" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <Stat big="150 yrs" small="of Lahman history in bronze" />
                <Stat big="10+"     small="dbt models · bronze → silver → gold" />
                <Stat big="5"       small="Cortex paths back every report" />
              </div>
            </div>
          </div>

          {/* Story beats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-12">
            {STORY_BEATS.map((b) => (
              <div key={b.eyebrow} className="card-deep p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85">
                  {b.eyebrow}
                </p>
                <h3 className="mt-2 font-display font-black text-chalk text-xl sm:text-2xl tracking-tight">
                  {b.title}
                </h3>
                <p className="mt-3 text-chalk/75 text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>

          {/* Iceberg core */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
              <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl tracking-tight">
                The Iceberg core
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                bronze → silver → gold
              </p>
            </div>
            <p className="text-chalk/65 text-sm leading-relaxed mb-5 max-w-3xl">
              Every layer is Iceberg. Bronze is Fivetran-managed; silver and gold are dbt-managed
              under Snowflake&apos;s external volume so the same bytes are queryable from Snowflake,
              Athena, Databricks, DuckDB — whoever shows up.
            </p>
            <IcebergStack />
          </section>

          {/* Cortex hub */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
              <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl tracking-tight">
                Cortex surface
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                vectors · search · comp · narrative · analyst
              </p>
            </div>
            <p className="text-chalk/65 text-sm leading-relaxed mb-5 max-w-3xl">
              Five Cortex paths back the report. The Scout Report on the home page is one opinionated
              combination of them; the same primitives also expose a free-form Analyst surface for
              SE-led exploration.
            </p>
            <CortexHub />
          </section>

          {/* Source list */}
          <section className="mb-4">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-4 tracking-tight">
              Sources
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SOURCES.map((s) => (
                <div key={s.name} className="card-deep p-4">
                  <p className="font-display font-bold text-chalk text-base">{s.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-chalk/55">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </section>
    </main>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <p className="font-display font-black text-gold text-3xl sm:text-4xl tracking-tight">{big}</p>
      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-chalk/55 leading-snug">
        {small}
      </p>
    </div>
  );
}
