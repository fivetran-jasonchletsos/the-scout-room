import PageHero from "@/components/PageHero";
import { META } from "@/lib/data";

export const metadata = { title: "About — The Scout Room" };

const WHATS_DIFFERENT: { tag: string; title: string; body: string }[] = [
  {
    tag: "Personalization",
    title: "Two inputs. Infinite combinations.",
    body: "Most baseball analytics show you league-wide leaderboards. The Scout Room asks two questions — your team and where you grew up — and produces a report that's never been seen before in that exact shape. 30 franchises × 51 states = 1,530 distinct reports, each blending franchise history with state geography.",
  },
  {
    tag: "Hidden Comp",
    title: "Vector similarity finds the player nobody talks about.",
    body: "Every Cooperstown plaque has a shadow. We embed each of 5,748 careers into a 768-dim vector via Snowflake Cortex EMBED_TEXT_768, then run VECTOR_COSINE_SIMILARITY to find the non-HOFer whose career shape mirrors a franchise legend. It's the comp that turns a SQL leaderboard into a 'wait, really?' moment.",
  },
  {
    tag: "Narrative",
    title: "The LLM writes the closing — the SQL is on the page.",
    body: "Section 5 of every report is a paragraph synthesizing the four findings into one read. In production that's CORTEX.COMPLETE on Claude 3.5 Sonnet. The actual SQL is displayed below the paragraph so the SE can show the path from data to language without leaving the demo.",
  },
  {
    tag: "Open Data",
    title: "Bronze is on Iceberg. So is silver. So is gold.",
    body: "Sean Lahman's database lands in S3 as Iceberg via Fivetran's Iceberg destination. dbt builds silver + gold as managed Iceberg tables under Snowflake's external volume. Same bytes, queryable by Snowflake, Athena, Databricks, DuckDB — whoever shows up.",
  },
];

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow={`Apex Demo · Snowflake Summit 2026`}
        title={<>About The Scout Room<span className="text-gold">.</span></>}
        lede={
          <>
            Most baseball analytics show you league leaderboards. This one shows you{" "}
            <strong className="text-chalk">your</strong> leaderboards — the players from your state,
            the prospect persona for your franchise, the hidden Hall-of-Fame comp from a player
            you've probably never heard of, and a closing paragraph the LLM wrote with the receipts.
          </>
        }
      />

      <section className="bg-abyss">
        <div className="mx-auto max-w-5xl px-4 sm:px-8 md:px-10 py-10 sm:py-12">
          {/* ODI Story canonical block — same pattern as the sibling apex demos */}
          <div className="chalk-panel p-5 sm:p-6 mb-10" style={{ borderLeft: "4px solid #3b9eff" }}>
            <p className="eyebrow" style={{ color: "#3b9eff" }}>The ODI Story</p>
            <h2 className="mt-2 font-display font-black text-chalk text-2xl sm:text-3xl tracking-tight">
              Data infrastructure for agents you trust.
            </h2>
            <p className="mt-3 text-chalk/75 leading-relaxed">
              <em>"MDS was optimized for humans. ODI is designed for a future with humans and
              production agents at scale."</em> This demo is one instance of that architecture:
              Fivetran's 750+ connectors and Managed Data Lake Service (MDLS) land data into open
              table formats; dbt transformations build the governed semantic layer; multiple
              compute engines and AI agents read the same gold tables.
            </p>
            <a
              href="https://fivetran-jasonchletsos.github.io/Fivetran-Demo-Repository/story/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-spark hover:underline"
            >
              Read the full ODI Story →
            </a>
          </div>

          {/* What's different */}
          <section className="space-y-4 mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-4">
              What's different about this one
            </h2>
            {WHATS_DIFFERENT.map((p) => (
              <div key={p.title} className="card-deep p-5 sm:p-6">
                <p className="eyebrow">{p.tag}</p>
                <h3 className="mt-1 font-display font-bold text-chalk text-lg sm:text-xl">{p.title}</h3>
                <p className="mt-2 text-chalk/70 leading-relaxed text-[14.5px]">{p.body}</p>
              </div>
            ))}
          </section>

          {/* By the numbers */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-4">
              By the numbers
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="Players in the lake" value={META.playerCount.toLocaleString()} />
              <StatBox label="Active franchises"  value={String(META.teamCount)} />
              <StatBox label="Hall of Famers"      value={String(META.hofCount)} />
              <StatBox label="Years of history"   value={String(META.lastSeason - META.firstSeason)} />
            </div>
          </section>

          {/* Built with */}
          <section className="mb-12">
            <h2 className="font-display font-black text-chalk text-2xl sm:text-3xl mb-4">
              Built with
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BuiltCard
                name="Fivetran"
                line="Custom connectors + HTTP source connector"
                detail="Lahman zip + Baseball Savant Statcast + MLB Stats API. Iceberg destination on S3."
              />
              <BuiltCard
                name="dbt"
                line="Bronze · silver · gold on Iceberg"
                detail="dim_player_career, agg_team_alumni, agg_state_alumni — see dbt/models/."
              />
              <BuiltCard
                name="Snowflake Cortex"
                line="Embeddings · Search · Complete · Analyst"
                detail="EMBED_TEXT_768 for player vectors, VECTOR_COSINE_SIMILARITY for hidden-comp, COMPLETE for narrative, Cortex Analyst for natural-language SQL."
              />
              <BuiltCard
                name="Next.js + Tailwind"
                line="Static export, GitHub Pages"
                detail="Bundled JSON fixtures so the demo runs without a Snowflake account. Live data via the API route when wired."
              />
            </div>
          </section>

          {/* Credits */}
          <section className="card-deep p-5 sm:p-6">
            <p className="eyebrow">Data + credits</p>
            <p className="mt-2 text-chalk/75 leading-relaxed text-[14.5px]">
              Player data: Sean Lahman's Baseball Database, distributed by the Chadwick Bureau under{" "}
              <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank"
                 rel="noreferrer" className="text-spark hover:underline">CC BY-SA 3.0</a>.
              Through 2019. Player photos via Wikipedia / Wikimedia Commons.
              Built by{" "}
              <a href="https://github.com/fivetran-jasonchletsos" target="_blank" rel="noreferrer"
                 className="text-spark hover:underline">Jason Chletsos</a>{" "}
              as part of the Fivetran ODI demo portfolio.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-deep p-3 sm:p-4">
      <div className="font-display font-black text-chalk text-2xl sm:text-3xl leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-chalk/55">{label}</div>
    </div>
  );
}

function BuiltCard({ name, line, detail }: { name: string; line: string; detail: string }) {
  return (
    <div className="card-deep p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display font-bold text-chalk text-base sm:text-lg">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/85">{line}</span>
      </div>
      <p className="mt-2 text-[13px] text-chalk/65 leading-relaxed">{detail}</p>
    </div>
  );
}
