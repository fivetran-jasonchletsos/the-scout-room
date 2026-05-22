# The Scout Room — Claude Code skill

You're inside the Scout Room demo repo. This is a Fivetran ODI + Snowflake Cortex demo built on 150 years of MLB data (Sean Lahman's Baseball Database). The hook: a fan enters their favorite team + the state they grew up in, and gets a personalized multi-section Scout Report that no two are alike.

## Architecture

```
Lahman / Statcast / MLB Stats API
        │  (Fivetran custom + HTTP connectors)
        ▼
   Bronze (Iceberg on S3)
        │  (dbt models in dbt/models/silver)
        ▼
   Silver (cleaned, typed, deduped)
        │  (dbt models in dbt/models/gold)
        ▼
   Gold (dim_player_career, agg_team_alumni, agg_state_alumni)
        │
        ├─→ Cortex EMBED_TEXT_768 → PLAYER_EMBEDDINGS (vector column)
        ├─→ Cortex SEARCH SERVICE → free-form "find me a player like X"
        ├─→ Cortex COMPLETE → SCOUT_NARRATIVE function
        └─→ Cortex ANALYST → scout_analyst.yaml semantic model
                │
                ▼
       Next.js viewer (this repo)
```

## Ground rules

- **dbt + Fivetran (lowercase) only.** Never write "dbT", "SLT", or "NetWeaver".
- **No marketing copy.** SE / fan audience — facts, source names, real stats.
- **Iceberg-first.** Bronze + silver + gold are Iceberg; Snowflake federates via external volumes.
- **Cortex SQL is the source of truth in production.** The static JSON in `src/data/` is a development fixture that mirrors what `dim_player_career` and the agg tables would produce. The TypeScript scout engine in `src/lib/scoutEngine.ts` mirrors the SQL in `cortex/sql/`. When you change one, change the other.
- **No bbref.com scraping.** Sports Reference's TOS prohibits redistribution. Stick to Lahman + Statcast + the MLB Stats API.

## Repo layout

- `src/` — Next.js viewer. Reads from `src/data/*.json` at build time.
- `src/lib/scoutEngine.ts` — the deterministic scout logic (mirrors Cortex SQL).
- `data-raw/etl.py` — one-shot ETL that reads Lahman CSVs → compact JSON for the viewer.
- `dbt/` — dbt project. Bronze sources, silver staging, gold aggregates.
- `cortex/sql/` — Cortex setup + UDFs. Run after dbt has populated gold.
- `fivetran/` — connector wiring + terraform (TODO).

## When the SE asks: "make the Cortex side real"

Workflow:
1. Provision Snowflake account, dbt connection, Fivetran account (see `fivetran/README.md`).
2. `cd dbt && dbt deps && dbt build` — populates GOLD.
3. `snowsql -f cortex/sql/00_setup.sql` (then 01, 02, 03 in order).
4. Update `src/lib/scoutEngine.ts` to call the production endpoints via an API route (currently runs entirely client-side against the JSON fixture).

## When the SE asks: "swap to a different fan/team angle"

The scout engine in `src/lib/scoutEngine.ts` is the algorithm. Add a new section by:
1. Writing the gold table SQL in `dbt/models/gold/`.
2. Mirroring it as a TypeScript function in `scoutEngine.ts` (working against the bundled JSON).
3. Adding the corresponding card in `src/components/ScoutRoom.tsx`.

## Data license

Lahman dataset is CC BY-SA 3.0. Attribution required (already in the Footer). If you redistribute the bundled JSON, propagate the license.
