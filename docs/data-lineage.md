# Scout Room — Data Lineage

For the questioner who wants to know exactly where a number on the screen
came from. One table per UI panel. Read left to right.

## Spine

The architecture under every panel is identical. Sources land in Iceberg
via Fivetran, dbt promotes them through staged tables on Snowflake, Cortex
sits on top of the gold layer. The viewer reads bundled JSON that mirrors
gold so the demo runs offline, but every value is reproducible from the
warehouse.

```
Lahman / Statcast / MLB Stats API
        │  (Fivetran custom + HTTP connectors)
        ▼
   Bronze (Iceberg on S3)
        │  (dbt models in dbt/models/bronze, _sources.yml)
        ▼
   Silver (cleaned, typed, deduped — dbt/models/silver/stg_players.sql)
        │
        ▼
   Gold (dim_player_career, agg_team_alumni, agg_state_alumni,
         agg_era_normalized_profiles, agg_franchise_decade_position,
         agg_state_density, dim_city_centroid, dim_franchise_location)
        │
        └─→ Cortex
            • EMBED_TEXT_768  → PLAYER_EMBEDDINGS
            • SEARCH SERVICE   → PLAYER_SEARCH
            • COSINE_SIM_ARR   → FIND_HIDDEN_COMP, COMP_AXIS_DELTAS
            • HAVERSINE_MI     → FIND_HOMETOWN_HEROES, INFER_FRANCHISE
            • COMPLETE         → SCOUT_NARRATIVE
            • ANALYST          → scout_analyst.yaml
```

## Panel-by-panel lineage

### Section 01 — Hometown Heroes

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| Player list | `dim_player_career` filtered through `FIND_HOMETOWN_HEROES` | Lahman `People.*`, `Batting.*`, `Pitching.*` |
| Distance value | `HAVERSINE_MI(home_lat, home_lng, city_lat, city_lng)` | `dim_city_centroid` (city, state, lat, lng) |
| Career value sort | `dim_player_career.career_value` proxy | Batting + pitching + all-star + HOF + major awards rollup |
| Era timeline band | Client-side `eraOf(debut_year)` | `dim_player_career.debut_year`, `.final_year` |
| HOF chip | `dim_player_career.is_hof` | Lahman `HallOfFame.inducted = 'Y'` |
| All-Star count | `dim_player_career.all_star_selections` | Lahman `AllstarFull` aggregated |

TS mirror: `buildHometown()` in `src/lib/scoutEngine.ts`.

### Section 02 — Prospect Persona

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| Position donut | `agg_team_alumni` (legacy) plus `archetypes.json` rollup | `dim_player_career.primary_pos` |
| Position cards | Top 5 positions in the franchise's inner-30 | Same |
| Decade stacked bars | `agg_franchise_decade_position` | `dim_player_career.debut_year`, `.final_year`, `.primary_pos`, `franchID` mapping via `Teams` |
| Peak decade callout | Computed in `buildTimeline()` | `agg_franchise_decade_position.active_players` |

TS mirror: `buildPersona()` + `buildTimeline()` in `src/lib/scoutEngine.ts`.

### Section 03 — Hidden Comp

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| Anchor player | First HOFer in `agg_team_alumni[franchID]` | `dim_player_career.is_hof = 1` joined to franchise alumni |
| Candidate pool | Radius-resolved `dim_player_career` join `dim_city_centroid` | `birth_city`, `birth_state` |
| Six-axis vector | `agg_era_normalized_profiles.z_vector` | All counting and rate stats from `dim_player_career`, era-cohort z-scored |
| Similarity score | `COSINE_SIM_ARR(anchor.z_vector, candidate.z_vector)` | Same |
| Radar percentile | `agg_era_normalized_profiles.z_*` per axis, percentile within era cohort | Same |
| Axis deltas | `COMP_AXIS_DELTAS(anchor_id, candidate_id)` | Same |
| Dynamic insight text | Generated in `buildCompInsight()` from the deltas | Reads the four axis-summary fields |

TS mirror: `findComp()` + `profileOf()` + `similarityProfiles()` in `src/lib/scoutEngine.ts`.

### Section 04 — Did You Know

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| WS titles + pennants | `teams.json` (legacy, mirrors `agg_team_franchise`) | Lahman `TeamsFranchises`, `SeriesPost` |
| Top-50 alumni overlap with state | `agg_team_alumni[franchID]` ∩ `players_by_state[stateCode]` | `dim_player_career.birth_state`, franchise alumni rollup |
| All-time leader rank | `LEADERS.careerValue` | Top-N over `dim_player_career.career_value` |
| State tile map | `agg_state_density` | `dim_player_career.birth_state`, `.career_value` (top-100 per state) |
| Quintile coloring | `agg_state_density.quintile` | Computed from `top100_count` via `width_bucket` |

TS mirror: `buildDidYouKnow()` + `buildStateDensity()` in `src/lib/scoutEngine.ts`.

### Section 05 — The Closing (narrative)

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| Narrative paragraph | `SCOUT_NARRATIVE(team_name, state_name, ...)` via `SNOWFLAKE.CORTEX.COMPLETE('claude-3-5-sonnet', prompt)` | Structured payload built from the four upstream sections |
| Prompt template | `cortex/sql/02_scout_narrative.sql` | Inputs are OBJECT_CONSTRUCT of upstream values |

TS mirror: `buildNarrative()` in `src/lib/scoutEngine.ts`. The TS path
templates the paragraph deterministically; production swaps to the Cortex
call via an API route.

### Header — Inferred team

| Element | Gold table / Cortex artifact | Source columns |
| --- | --- | --- |
| User coords | `GEOCODE_CITY(user_city, user_state)` | `dim_city_centroid` |
| Nearest franchise | `INFER_FRANCHISE(home_lat, home_lng)` | `dim_franchise_location` joined via `HAVERSINE_MI` |
| Runners-up | Same UDF, `ROW_NUMBER` over distance | Same |
| Override path | Manual `franchID` injection; coords recomputed | Same |

TS mirror: `geocodeCity()` + `inferFranchise()` in `src/lib/scoutEngine.ts`.

## Refresh cadence

| Layer | Cadence | Trigger |
| --- | --- | --- |
| Lahman bronze | Annual | New Lahman release (manual Fivetran sync) |
| Statcast bronze | Daily | Fivetran HTTP connector, midnight Pacific |
| MLB Stats API bronze | In-season hourly | Fivetran HTTP connector |
| Silver + gold | Daily after Statcast | Snowflake task chained to bronze refresh |
| `PLAYER_EMBEDDINGS` | TARGET_LAG = 1 day | Cortex SEARCH service auto-refresh |
| `agg_era_normalized_profiles` | Daily | Same dbt task chain |
| `dim_city_centroid` | Manual | Regenerated only when `scripts/build_geo.py` runs |
| `dim_franchise_location` | Manual | Same — only when a franchise moves |

## Where to look first when a number looks wrong

1. **A player is missing from Hometown Heroes** — check
   `dim_city_centroid` for that birth city. If absent, the player has no
   coords and won't survive the radius filter. State-fallback mode picks
   them up; radius mode does not.
2. **Career value looks off** — open `dim_player_career.sql`. The proxy
   formula is documented inline. It is intentionally not WAR; we don't
   have WAR in Lahman.
3. **Comp similarity feels too high or low** — check the era cohort. The
   z-scores are cohort-relative; a sparse cohort (19th century) produces
   noisier scores than a dense one (Statcast era).
4. **Narrative says something wrong** — the LLM only writes prose from
   the structured payload. If the prose is factually wrong, the payload is
   wrong. Open the upstream section's lineage row and trace from there.
