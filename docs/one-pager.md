# The Scout Room — One-Pager

A Fivetran Open Data Infrastructure demo built on 150 years of MLB history. A
fan types their hometown, the Snowflake side builds them a personalized scout
report from data Fivetran moved, dbt shaped, and Cortex narrated. The
architecture is the product story; the baseball is the wrapper.

## The hook

A fan picks a hometown. Out comes a one-of-one report:

- Five Hometown Heroes who were born within 75 miles of them
- A Prospect Persona for the franchise the nearest ballpark says is theirs
- A Hidden Comp: a real player whose era-adjusted career shape mirrors a Hall
  of Famer's, but who never made it to Cooperstown
- A handful of Did-You-Know facts tying the team and the geography together
- A closing narrative written by Snowflake Cortex

No two reports are the same. That is the demo. Every section is computed
from the warehouse, not curated by hand.

## What the architecture does for it

Sources (Lahman baseball database, Statcast, MLB Stats API) land in Iceberg
on S3 via Fivetran custom and HTTP connectors. dbt promotes them through
bronze, silver, and gold on Snowflake — the gold tables are what the report
queries. Snowflake Cortex layers on top: EMBED_TEXT_768 for vector
similarity, SEARCH for free-form "find a player like X" queries, COMPLETE for
the narrative, ANALYST for the semantic layer if a prospect wants to ask
their own questions live.

That is ODI in one demo. Open table format underneath, multi-tool access on
top, an LLM-narrated experience that would have taken a team a quarter to
build without the platform doing the heavy lifting.

## Audiences and what each one takes away

| Audience | What they care about | What this demo shows them |
| --- | --- | --- |
| Baseball fan | The report itself | Their hometown, their team, players they didn't know existed |
| Sales engineer | How to demo ODI without a slide deck | A working app that exercises every ODI layer in five minutes |
| Data platform buyer | Whether ODI replaces what they already have | Iceberg as system of record, Snowflake as one of N compute engines |
| Data engineer at the prospect | Whether they could build their version of this | Source code: dbt models, Cortex SQL, scout engine in TypeScript |
| Executive sponsor | Whether the team can ship it | One repo, a few hundred lines of dbt, a Next.js viewer |

## What's in the bag

| Layer | Tech | What it does here |
| --- | --- | --- |
| Sources | Lahman CSVs, Statcast, MLB Stats API | 150 years of player careers, modern Statcast metrics, daily-game context |
| Ingestion | Fivetran custom + HTTP connectors | Schedules, retries, schema drift, metadata |
| Storage | Apache Iceberg on S3 | ACID, time travel, open format, no Snowflake lock-in |
| Federation | Snowflake external volumes | Query Iceberg directly from Snowflake |
| Transform | dbt — bronze, silver, gold | One ref-chain per insight in the report |
| Vectors | Snowflake Cortex EMBED_TEXT_768 | Player career profiles as embeddings |
| Search | Snowflake Cortex SEARCH SERVICE | Free-form "left-handed power hitter who could steal" |
| Comp engine | Cortex COSINE_SIMILARITY over era-normalized profiles | Era-adjusted 6-axis cosine, not raw counting stats |
| Narrative | Snowflake Cortex COMPLETE | The closing paragraph, generated per fan |
| Semantic layer | Snowflake Cortex ANALYST | Optional natural-language Q+A for the prospect |
| Viewer | Next.js 14, static export | Bundled JSON fixture mirrors the gold tables for offline demos |

## What the report actually says

A real report for Tampa, FL would surface: Tony La Russa born in Tampa as the
top hometown career, the Tampa Bay Rays inferred as the closest franchise
(roughly 23 mi to Tropicana Field), a stacked decade chart showing how the
Rays' inner-30 cluster in the 2000s, a six-axis radar comparing a HOF
Rays-affiliated anchor to a same-shape Floridian who never got the plaque,
and a 4-sentence narrative tying the geography to the franchise. Every
sentence is generated; nothing was written for that specific input ahead of
time.

## Why this benefits the project

- **Faster demos.** Fan-friendly hook means the SE never has to start with a
  data diagram. The architecture shows up because the report shows up.
- **Reuses across verticals.** The demo's spine — input form to deterministic
  engine to multi-section report to LLM narrative — transfers cleanly to any
  domain where a prospect cares about personalized analytics over historical
  data. See `demo-template.md`.
- **Educates without overwhelming.** A fan understands a scout report. The
  data engineer reading the same UI sees Iceberg + dbt + Cortex doing real
  work. Same surface, two audiences, no separate decks.
- **Calibrates the ODI story to a real shape.** Every component in ODI has a
  visible job here. When a prospect asks "what part of this needs the open
  table format?" we point at the Iceberg layer and the federation story is
  concrete instead of abstract.

## Where to go next

- Demo it: `demo-runbook.md`
- Explain a number: `data-lineage.md`
- Build the next one: `demo-template.md`
