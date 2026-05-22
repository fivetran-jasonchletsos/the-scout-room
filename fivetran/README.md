# Fivetran connector config

Three connectors land bronze data into the SCOUT_ROOM database, Iceberg destination:

## 1. Lahman (custom connector)

One-shot custom connector. Pulls `chadwickbureau/baseballdatabank` (CC BY-SA 3.0) zip, unpacks into 27 tables, lands as Iceberg in the `bronze.lahman_*` namespace.

Trigger: weekly poll for upstream refresh.

## 2. Statcast (custom connector via pybaseball)

Polls Baseball Savant daily for the previous day's pitch-level data. Schema:
- `bronze.statcast_pitches` (~750K rows/year)
- `bronze.statcast_batted_balls` (~120K rows/year)

## 3. MLB Stats API (HTTP source connector)

The official MLB Stats API at `https://statsapi.mlb.com/api/v1`. Hits these endpoints:
- `/people` — current player rosters
- `/teams/{id}/roster` — team roster snapshots
- `/transactions` — daily transactions
- `/standings` — current standings

Schedule: 4x daily during the season.

## Destination

Iceberg via Fivetran's Iceberg destination, writing to S3 with Snowflake as the federated catalog. Bronze tables are external Iceberg; dbt builds silver + gold as managed Iceberg.

See `terraform/` (TODO) for the actual provider config.
