# The Scout Room

Personalized baseball analytics on 150 years of MLB data. Pick your team. Pick where you grew up. Get a Scout Report no one else has seen.

Live: https://fivetran-jasonchletsos.github.io/the-scout-room/

## What it does

Five sections, every report:

1. **Hometown Heroes** — top 5 careers from your state, ranked by career value.
2. **Prospect Persona** — what kind of player has historically worked for your franchise (position-archetype histogram of the inner-circle 30).
3. **Hidden Comp** — given your team's biggest legend, find a non-Hall-of-Famer whose career profile mirrors theirs (cosine similarity on career H/HR/G or W/SO/G).
4. **Did You Know** — three facts that blend franchise + state + leaderboard data.
5. **The Closing** — narrative paragraph synthesizing the findings. In production this is `SNOWFLAKE.CORTEX.COMPLETE`; in the static demo it's a deterministic template.

## Architecture (ODI)

- **Sources**: Lahman (CC BY-SA 3.0) + Statcast (pybaseball) + MLB Stats API
- **Movement**: Fivetran custom + HTTP source connectors → Iceberg on S3
- **Transform**: dbt → bronze / silver / gold Iceberg
- **AI**: Snowflake Cortex — `EMBED_TEXT_768` for player vectors, `SEARCH SERVICE` for free-form lookup, `COMPLETE` for narrative, `ANALYST` for natural-language SQL
- **Viewer**: Next.js static export

## Local dev

```bash
npm install
npm run dev    # http://localhost:3200
```

The viewer is fully static — all data lives in `src/data/*.json` (bundled at build). No Snowflake account required to run the demo.

To regenerate the JSON from the raw Lahman CSVs:
```bash
cd data-raw
# downloads chadwickbureau/baseballdatabank zip if not present
python3 etl.py
```

## Production path

When pointing this at a real Snowflake + Fivetran account:
1. Run `dbt build` (see `dbt/`) — populates SCOUT_ROOM.GOLD
2. Run `cortex/sql/00_setup.sql` through `03_scout_analyst.sql` in order
3. Swap the client-side scout engine for an API route hitting Snowflake (the call sites are clearly marked in `src/lib/scoutEngine.ts`)

## Data

Sean Lahman's Baseball Database, through 2019, via [chadwickbureau/baseballdatabank](https://github.com/chadwickbureau/baseballdatabank). Licensed CC BY-SA 3.0.
