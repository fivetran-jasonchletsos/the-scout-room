# Scout Room — Demo Runbook

How to drive the Scout Room demo confidently. Two scripts (5-minute and
15-minute), inputs that produce strong reports, FAQs for the moments a
prospect veers off-script, and what to do if something breaks live.

## Before you walk in

- Have the demo open in a browser tab at `localhost:3200` or wherever it's
  hosted. Hard-refresh once so the first interaction isn't a cold load.
- Have the architecture page (`/architecture`) and the pipeline page
  (`/pipeline`) open in adjacent tabs. You will not navigate to them unless
  asked, but they cut down on the panic of fumbling through the URL bar.
- Pick a primary input ahead of time. Tampa, FL is the recommended default
  for a first-time audience — it produces a clean report with a clear team
  inference, a strong hometown hero list, and a satisfying comp.

## The 5-minute version

Use this for a casual demo, a booth, or any audience where the architecture
discussion will happen separately.

1. **Frame in one sentence.** "This is a Fivetran ODI demo. A fan types
   their hometown, we build a one-of-one scout report from 150 years of
   MLB data sitting in Iceberg on S3."
2. **Take the input.** Ask the audience for a city + state. If they hesitate,
   use Tampa, FL.
3. **Click Generate.** While it runs, narrate: "We're not pulling cached
   results — every section is computed from the gold tables Fivetran and dbt
   built. The narrative at the bottom is Cortex COMPLETE."
4. **Walk down the report.** Two beats per section:
   - Hometown Heroes: "These are real players born within 75 miles of the
     city they gave us. Distance is computed in SQL, ranking is by our
     career-value proxy."
   - Inferred team: "We inferred the team from nearest ballpark. They can
     override if we got it wrong, and the report rebuilds instantly."
   - Prospect Persona: "Donut shows what positions worked historically for
     this franchise. The stacked bars below show when those careers were
     actually active."
   - Hidden Comp: "This radar is the analytics story. We z-score career
     stats inside an era cohort, then run cosine similarity. The candidate
     is a real player whose era-adjusted shape mirrors a Hall of Famer's."
   - Did You Know: "Three things the data wrote, plus a tile-map showing
     how their state stacks up against every other for player production."
   - Narrative: "The closing paragraph is generated. We never wrote that
     sentence for that input."
5. **Close.** "Everything you just watched came out of one warehouse, one
   open table format underneath, and Cortex on top. That's ODI."

## The 15-minute version

For an SE-to-SE conversation or a prospect who wants to see the layers.

1. **Architecture in 60 seconds.** Open `/architecture` if you need it.
   "Sources are Lahman, Statcast, MLB Stats. Fivetran lands them in Iceberg
   on S3. dbt promotes through bronze, silver, gold on Snowflake. Cortex
   does the vector, search, and LLM work on the gold tables."
2. **Run the report exactly as in the 5-minute version.**
3. **Pause on the Hidden Comp.** This is where the analytical depth shows.
   "The naive version of this would be cosine over raw counting stats —
   home runs, hits, games. Thirty home runs in 1925 and thirty home runs
   in 2001 are not the same signal. We z-score against the player's debut
   era so the radar reflects shape, not era. The dbt model that does that
   is `agg_era_normalized_profiles`. The Snowflake UDF is `COSINE_SIM_ARR`
   over a z-vector column."
4. **Open the data-lineage doc** (or just describe it). Pick one panel and
   trace it back: Hometown Heroes is `dim_player_career` joined to
   `dim_city_centroid`, filtered by `HAVERSINE_MI` in a Snowflake procedure.
5. **Cortex SEARCH.** "We're not using it in the current viewer, but the
   `PLAYER_SEARCH` service is live. A prospect could type 'left-handed
   power hitter who could steal a base, 1970s' and get a ranked list. Same
   data, different access pattern. That's the multi-tool story ODI sells."
6. **Close on the value prop.** "What you just saw — embeddings, search,
   completions, all on Iceberg, all governed by Snowflake — would have been
   a multi-quarter platform project a year ago. With ODI it's a Friday."

## Recommended inputs

Each of these has been hand-verified to produce a strong report. When in
doubt, default to the top entry.

| Input | Why it demos well |
| --- | --- |
| Tampa, FL | Clean Rays inference, strong hometown heroes, Florida-born comp candidates |
| Los Angeles, CA | Dodgers vs Angels override moment lands every time; deep hometown list |
| Brooklyn, NY | Mets and Yankees both surface as runners-up, great state-density visual |
| Cincinnati, OH | Reds inference, the inner-30 timeline clusters dramatically in the 70s |
| Pittsburgh, PA | Pirates, Honus Wagner anchor, era-adjustment story is sharp |
| Baltimore, MD | Orioles, lots of Cal-era HOFers, geo overlap with team alumni is high |
| Las Vegas, NV | Sparse state but strong city — shows the radius search doing real work |

Inputs to avoid for first-time audiences:

- States with no franchise nearby (Montana, North Dakota, Wyoming) — the
  team inference falls back to a distant franchise and the story gets less
  clean. Use these only if you want to walk through the fallback behavior
  on purpose.
- Cities not in our coord table — the report still runs in state-fallback
  mode but the Hometown Heroes radius framing is replaced with state-level
  text, and audiences who don't know that may think something broke.

## FAQ for the prospect's hard questions

**"Is this hitting Snowflake right now?"**
The bundled JSON fixture mirrors the gold tables, so the viewer runs
client-side for demo reliability. The Cortex SQL in `cortex/sql/` is the
production path. Show them `00_setup.sql` if they want to see real code.

**"Why Iceberg and not Snowflake-native tables?"**
ODI's claim is system-of-record portability. Iceberg means the prospect's
data does not get locked into any single compute. Snowflake is one of N
engines that can query it; dbt-on-Snowflake is the transform engine we
chose for this demo, but Spark or Trino on the same Iceberg tables would
work identically.

**"How fresh is the data?"**
Lahman ships once a year. Statcast lands daily via Fivetran HTTP connector.
The MLB Stats API path is a stream for in-season game-day. The dbt build
runs on a Snowflake task; Cortex embeddings refresh on a TARGET_LAG of
1 day for the search service.

**"What's the Cortex COMPLETE prompt look like?"**
Open `cortex/sql/02_scout_narrative.sql`. The template is right there, with
the input fields it expects. The model is `claude-3-5-sonnet`. We pass
structured findings via OBJECT_CONSTRUCT so the LLM only writes the prose,
not the numbers.

**"How is the comp similarity computed?"**
Era cohort z-score over six axes per role (batters and pitchers have
different axis sets). The dbt model is `agg_era_normalized_profiles`. The
Snowflake UDF is `COSINE_SIM_ARR`. Both are mirrored in
`src/lib/scoutEngine.ts` so the viewer can demo offline.

**"Could we use our own embedding model?"**
Yes. The `00_setup.sql` script calls `SNOWFLAKE.CORTEX.EMBED_TEXT_768` with
`snowflake-arctic-embed-m`. Swap the model name; nothing else changes. Same
applies for the COMPLETE call.

**"What about governance?"**
Snowflake's RBAC + Iceberg's catalog provides table-level access. The
Cortex calls inherit the warehouse's role. Nothing leaves Snowflake unless
the viewer explicitly fetches it via an API route, and that route doesn't
exist in the demo.

## Failure modes and recovery

**Wifi dies mid-demo.**
The viewer is statically exported and runs client-side. Reports will keep
generating from the bundled JSON. Don't navigate; just keep going.

**A report comes back with no Hometown Heroes.**
Either the city isn't in our coord table and the state-level fallback
hit zero matches, or the radius is too tight for a sparse state. Bump the
radius slider to 150 mi, or pick a recommended input from the table above.

**The wrong team got inferred and the prospect is from a multi-team market.**
Click "wrong team?" — the override dropdown is right there, the runners-up
are shown with their distances. The report rebuilds without the spinner.
This is a feature; sometimes it lands better than the initial inference.

**Cortex SEARCH service is rate-limited or offline.**
The viewer doesn't call it. If you're demoing the SEARCH path live in
Snowflake, fall back to the `PLAYER_EMBEDDINGS` table and run cosine in
SQL directly. The data is identical; only the access pattern differs.

## After the demo

- Log the questions the prospect asked. Patterns become next iterations.
- Drop the recording link in the demo-family Slack so the next SE has a
  reference run.
- If a question forced you to dig into the lineage, capture which panel
  it was for. That's a signal to either strengthen `data-lineage.md` or
  add an explainer card to the UI.
