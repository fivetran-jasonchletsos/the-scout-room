import PageHero from "@/components/PageHero";

export const metadata = { title: "ODI + Cortex — The Scout Room" };

const ODI_PRINCIPLES = [
  {
    name: "Open table formats",
    detail: "Bronze, silver, and gold all sit in Iceberg on S3. The same Parquet files are queried by Snowflake, Athena, Databricks, DuckDB. No copies. No exports. No drift.",
  },
  {
    name: "Managed Data Lake Service (MDLS)",
    detail: "Fivetran's Iceberg destination handles partitioning, compaction, snapshots, and schema evolution so the lake stays queryable without a data-engineering tax.",
  },
  {
    name: "750+ connectors",
    detail: "This demo uses three (Lahman custom file, Statcast HTTP, MLB Stats API HTTP). The same ingest plane covers SAP, Salesforce, Workday, Postgres CDC, 750+ more.",
  },
  {
    name: "Semantic layer in dbt",
    detail: "Silver staging + gold marts written in dbt SQL. Tests, docs, lineage. The same models that back the static demo back the live Snowflake account when wired.",
  },
];

const CORTEX_CALLS = [
  {
    title: "EMBED_TEXT_768 → player_embeddings",
    purpose: "Encode each career into a 768-dim vector so similarity becomes a SQL operation.",
    sql: `SELECT
  player_id,
  SNOWFLAKE.CORTEX.EMBED_TEXT_768(
    'snowflake-arctic-embed-m',
    profile_text
  ) AS profile_embedding
FROM career_profiles;`,
  },
  {
    title: "VECTOR_COSINE_SIMILARITY → Hidden Comp",
    purpose: "Given a Hall-of-Fame anchor, find the non-HOFer with the most similar career shape.",
    sql: `SELECT
  pe.full_name,
  VECTOR_COSINE_SIMILARITY(
    pe.profile_embedding,
    :anchor_vec
  ) AS similarity
FROM player_embeddings pe
JOIN dim_player_career dpc USING (player_id)
WHERE dpc.is_hof = 0
ORDER BY similarity DESC
LIMIT 5;`,
  },
  {
    title: "COMPLETE → The Closing narrative",
    purpose: "Synthesize the four structured findings into a tight four-sentence read.",
    sql: `SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'claude-3-5-sonnet',
  CONCAT(
    'Write a 4-sentence scout report combining these findings:',
    OBJECT_CONSTRUCT(
      'team',     :team_name,
      'state',    :state_name,
      'hometown', :hometown_top_five,
      'persona',  :archetype_breakdown,
      'comp',     :hidden_comp_pair
    )::STRING
  )
) AS narrative;`,
  },
  {
    title: "Cortex Search Service → PLAYER_SEARCH",
    purpose: "Free-form, fan-grade discovery: 'a lefty power-hitter who could steal a base, 1970s'.",
    sql: `SELECT *
FROM TABLE(
  PLAYER_SEARCH(
    'left-handed power hitter who could steal a base, 1970s',
    LIMIT => 10
  )
);`,
  },
  {
    title: "Cortex Analyst → scout_analyst.yaml",
    purpose: "Natural-language SQL surface for any analytics question over the gold layer.",
    sql: `# Sample question routed via Cortex Analyst:
"Which active franchise has produced the most Hall of Fame
 pitchers, and what's their combined career value?"`,
  },
];

export default function OdiPage() {
  return (
    <main>
      <PageHero
        eyebrow="ODI + Snowflake Cortex"
        title={<>One lake. Many engines. AI that doesn't move the data<span className="text-gold">.</span></>}
        lede={
          <>
            Open Data Infrastructure is what makes Scout Room sustainable beyond a demo. The same
            Iceberg files dbt writes are the ones Cortex embeds, the ones Snowflake serves to the
            viewer, and the ones any other engine (Athena, Databricks, DuckDB) can read tomorrow
            without a migration.
          </>
        }
      />

      <section className="bg-abyss">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 md:px-10 py-10 sm:py-12">

          {/* ODI principles */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-1">
              What ODI gives you here
            </h2>
            <p className="text-chalk/55 text-sm mb-5">Four principles, each visible in this demo.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ODI_PRINCIPLES.map((p) => (
                <div key={p.name} className="card-deep p-4 sm:p-5">
                  <p className="font-display font-bold text-spark text-base">{p.name}</p>
                  <p className="mt-2 text-[14px] text-chalk/70 leading-relaxed">{p.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Cortex calls */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-1">
              Cortex, line by line
            </h2>
            <p className="text-chalk/55 text-sm mb-5 max-w-3xl">
              Five Cortex paths back the Scout Report. The SQL below is what runs in a real
              Snowflake account; the static demo mirrors the same logic in TypeScript against
              bundled JSON so the page is shippable without a warehouse.
            </p>
            <div className="space-y-5">
              {CORTEX_CALLS.map((c) => (
                <div key={c.title} className="chalk-panel p-5 sm:p-6">
                  <p className="eyebrow">{c.title}</p>
                  <p className="mt-2 text-[14px] text-chalk/75 leading-relaxed">{c.purpose}</p>
                  <pre className="mt-3 font-mono text-[12px] text-chalk/85 leading-relaxed overflow-x-auto rounded-md border border-wire bg-abyss/60 p-3">
{c.sql}
                  </pre>
                </div>
              ))}
            </div>
          </section>

          {/* The pitch */}
          <section className="chalk-panel p-5 sm:p-6">
            <p className="eyebrow">Why this matters beyond baseball</p>
            <p className="mt-2 text-chalk/85 leading-relaxed">
              Swap Lahman for SAP. Swap Statcast for sensor data. Swap MLB Stats API for the
              transaction feed. The architecture is identical. ODI is what lets you build a
              personalized analytics product on top of a governed semantic layer without
              recopying the data three times — and Cortex is what lets you put a coherent
              narrative on top of it without leaving the warehouse.
            </p>
            <p className="mt-3 text-chalk/65 text-sm leading-relaxed">
              The Scout Room is one instance. The Crisis Room, Brief Room, and Build Room are
              three more, each in a different industry. The blueprint travels.
            </p>
            <a
              href="https://fivetran-jasonchletsos.github.io/Fivetran-Demo-Repository/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-spark hover:underline"
            >
              See the rest of the portfolio →
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}
