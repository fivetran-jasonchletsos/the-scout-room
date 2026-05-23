# ODI Demo Template — Propagating the Scout Room Pattern

The Scout Room is the first of a family of ODI demos. The architecture
underneath is the product story and must not change between demos: Fivetran
to Iceberg to dbt to Cortex, with a Next.js viewer on top. This file
abstracts what's reusable so the next demo (whatever vertical) takes weeks
instead of months.

## The locked spine

Every demo in this family has the same five layers, in the same order, with
the same tools. This is the ODI product surface. Do not substitute, do not
collapse, do not add layers.

| Layer | Tech | Purpose |
| --- | --- | --- |
| Sources | Anything the domain has — APIs, CSVs, databases, streams | Land the domain's reality |
| Ingestion | Fivetran custom or HTTP connectors | Schedules, retries, schema drift |
| Storage | Apache Iceberg on S3 | System of record, ACID, time travel |
| Federation | Snowflake external volumes | Query Iceberg directly |
| Transform | dbt — bronze, silver, gold | Reproducible promotion |
| Vectors | Snowflake Cortex EMBED_TEXT_768 | Semantic similarity on domain entities |
| Search | Snowflake Cortex SEARCH SERVICE | Free-form ranked retrieval |
| Comp / scoring | Snowflake Cortex COSINE_SIMILARITY (and / or custom UDFs) | Domain-specific shape matching |
| Narrative | Snowflake Cortex COMPLETE | Per-input generated prose |
| Semantic layer | Snowflake Cortex ANALYST | Optional natural-language Q+A |
| Viewer | Next.js 14, static export | Bundled fixture mirrors gold for offline demos |

## The reusable UX spine

The Scout Room report is built from a pattern that propagates cleanly:

1. **Single input form.** One or two fields, with autocomplete bound to a
   curated dimension table. Inference fills in the rest (the Scout Room
   infers the team from the city). The user is never asked for more than
   they would type into a search box.
2. **Deterministic engine.** A function that takes the input and returns a
   structured report. Mirrors a SQL pipeline that runs in production.
3. **Multi-section report.** Four to six panels. Each panel has a
   chart, a number callout, and a sentence of dynamic insight tied to the
   chart's values — not a template.
4. **One section is the analytical proof point.** In the Scout Room it's
   the era-adjusted Hidden Comp radar. Every demo needs one panel where the
   analytics depth is undeniable. That's the panel the data engineers
   stare at.
5. **LLM narrative close.** Cortex COMPLETE writes a 3-to-5-sentence
   summary from the structured findings. The model does not invent
   numbers; it phrases the findings the SQL produced.

## What changes between demos (the swap surface)

| Surface | Scout Room | Sales pipeline demo (hypothetical) | Support deflection demo (hypothetical) |
| --- | --- | --- | --- |
| Domain | MLB careers | Won-and-lost opportunities | Ticket histories |
| Input | Hometown city + state | Account name or industry vertical | Ticket queue or product line |
| Inferred entity | MLB franchise from nearest ballpark | Likely competitor from recent losses | Closest knowledge-base article cluster |
| Section 1 | Hometown Heroes | Hometown wins | Recent resolutions |
| Section 2 | Prospect Persona | Buyer persona breakdown | Resolver persona breakdown |
| Analytical proof point | Era-adjusted comp radar | Stage-velocity z-score radar | Resolution-time z-score radar |
| Section 4 | Did You Know geographic | Did You Know about adjacent accounts | Did You Know about adjacent tickets |
| Narrative | Scout report close | Account brief | Triage brief |

The pattern is preserved; the domain swaps. The architecture is identical.

## What stays the same (the locked surface)

- All five ODI layers, in the same order, with the same tools.
- The dbt bronze → silver → gold promotion pattern.
- The Cortex layer's role: vectors + search + comp + narrative + analyst.
- The viewer's static-export-with-bundled-fixture trick for offline-safe
  demos.
- The TS-mirrors-SQL convention so the viewer and the warehouse compute the
  same thing.
- The "dynamic insight text" pattern: every chart description reads off
  actual computed values, never a fixed template.

## Skeleton repo layout

```
the-{domain}-{demo}/
├── CLAUDE.md                    # Repo-specific Claude conventions; copy from Scout Room and rewrite the domain paragraph
├── README.md                    # Public-facing summary; cribs from docs/one-pager.md
├── docs/                        # Operator docs — copy structure from Scout Room
│   ├── README.md
│   ├── one-pager.md
│   ├── demo-runbook.md
│   ├── data-lineage.md
│   └── demo-template.md         # Optional — only if this demo itself spawns more
├── data-raw/                    # Source extracts and ETL scripts
│   └── etl.py                   # One-shot loader that produces the bundled JSON fixture
├── scripts/
│   ├── build_geo.py             # If the demo has a geo component
│   └── build_{domain}_meta.py   # Whatever auxiliary baked data the viewer needs
├── dbt/
│   ├── dbt_project.yml
│   └── models/
│       ├── bronze/
│       │   └── _sources.yml
│       ├── silver/
│       │   └── stg_{entity}.sql
│       └── gold/
│           ├── dim_{entity}_full.sql
│           ├── agg_{rollup}.sql
│           └── dim_{lookup}.sql
├── cortex/
│   └── sql/
│       ├── 00_setup.sql         # PLAYER_EMBEDDINGS-equivalent + SEARCH SERVICE
│       ├── 01_{domain_comp}.sql # The proof-point similarity engine
│       ├── 02_{domain}_narrative.sql  # COMPLETE call template
│       ├── 03_{domain}_analyst.sql    # ANALYST semantic model
│       └── 04_{domain}_geo.sql        # Optional geo UDFs
├── fivetran/                    # Connector specs (terraform or HCL templates)
├── src/
│   ├── app/                     # Next.js routes
│   │   ├── page.tsx             # The demo itself
│   │   ├── about/
│   │   ├── architecture/
│   │   ├── pipeline/
│   │   └── odi/
│   ├── components/
│   │   ├── {Domain}Room.tsx     # The interactive panel; copy structure from ScoutRoom.tsx
│   │   ├── charts.tsx           # Reusable SVG chart kit (zero-dep)
│   │   └── ...
│   ├── lib/
│   │   ├── {domain}Engine.ts    # The deterministic engine; mirrors the dbt + Cortex layer
│   │   ├── types.ts
│   │   └── data.ts              # Static loaders for the bundled fixture
│   └── data/                    # Bundled JSON fixture — mirrors gold tables
└── package.json
```

## Build checklist for a new ODI demo

Phase 1 — pick the domain.

- [ ] Identify the audience (who watches the demo).
- [ ] Identify the one-sentence hook.
- [ ] Pick the single input the user provides.
- [ ] Identify the entity that gets inferred from that input.
- [ ] Identify the four-to-six report sections.
- [ ] Identify the one section that is the analytical proof point.

Phase 2 — model the data.

- [ ] List the sources. Make sure at least one needs a Fivetran custom
      connector (the demo's job is to show ODI handling messy real
      sources).
- [ ] Write the bronze `_sources.yml`.
- [ ] Write silver staging models.
- [ ] Write gold dim/agg models. Each report section gets at least one
      gold model.
- [ ] Mirror gold in `src/lib/{domain}Engine.ts` so the viewer can run
      offline.

Phase 3 — wire up Cortex.

- [ ] Write `00_setup.sql` with embeddings + SEARCH SERVICE.
- [ ] Write the comp UDF. For a domain with categorical similarity, use
      cosine over z-scored profiles like the Scout Room. For domains where
      embeddings are more natural, use vector cosine.
- [ ] Write the COMPLETE narrative template.
- [ ] Write the ANALYST semantic model.

Phase 4 — build the viewer.

- [ ] Static loaders in `src/lib/data.ts`.
- [ ] Engine in `src/lib/{domain}Engine.ts` (deterministic, mirrors SQL).
- [ ] Report sections in `src/components/{Domain}Room.tsx`. Each section
      gets dynamic insight text that reads off the values, not a template.
- [ ] At least one chart per section. Reuse `charts.tsx` from the Scout
      Room; add new chart types only when the kit doesn't cover it.

Phase 5 — operator docs.

- [ ] Copy `docs/README.md` and rewrite for the new demo.
- [ ] Write `docs/one-pager.md`.
- [ ] Write `docs/demo-runbook.md` with recommended inputs and FAQ.
- [ ] Write `docs/data-lineage.md`. This is the highest-value doc — it's
      what lets a prospect's data engineer trust the demo.

Phase 6 — propagate.

- [ ] Record a five-minute demo video. Link it from `docs/README.md`.
- [ ] Add the demo to the family index in the Fivetran demo Slack.
- [ ] If you discovered a new shared pattern, lift it into the Scout Room
      template so the next demo gets it for free.

## Anti-patterns to avoid

- **Substituting an ODI layer.** No replacing dbt with something else, no
  dropping the Iceberg layer for "speed", no skipping Cortex because the
  domain doesn't feel like it needs an LLM. The architecture is the story.
- **Static narrative paragraphs.** If the closing prose reads identically
  across inputs, you've defeated the demo. The narrative has to surface
  the specifics of the user's input.
- **Charts without dynamic insight text.** A chart with a generic caption
  is worse than no chart. Every panel needs a sentence that mentions an
  actual number from the panel.
- **Demos that require the SE to be an expert in the domain.** The Scout
  Room works on someone who knows baseball or someone who doesn't. The
  next demo has to read the same way.
- **Real-time bias.** Demos break in real-time. Always ship a bundled
  fixture that mirrors the production gold tables so the viewer is
  offline-safe.
- **Branching architecture between demos.** If the next demo discovers
  that the Cortex SEARCH service needs to behave differently, change the
  Cortex SEARCH service. Don't fork the architecture for a single demo.

## Where the Scout Room maps to this template

| Template element | Scout Room file |
| --- | --- |
| Single input | `src/components/ScoutRoom.tsx`, hometown city + state |
| Inferred entity | `inferFranchise()` in `src/lib/scoutEngine.ts` |
| Engine | `src/lib/scoutEngine.ts` |
| Report sections | `SectionHometown`, `SectionPersona`, `SectionComp`, `SectionDidYouKnow`, `SectionNarrative` |
| Proof-point section | `SectionComp` — era-adjusted radar |
| dbt gold marts | `dbt/models/gold/*.sql` |
| Cortex setup | `cortex/sql/00_setup.sql` |
| Comp UDF | `cortex/sql/01_hidden_comp.sql` |
| Narrative | `cortex/sql/02_scout_narrative.sql` |
| Operator docs | This folder |
