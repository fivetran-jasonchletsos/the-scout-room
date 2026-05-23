{{ config(materialized = 'table') }}

-- City centroid lookup table.
--
-- Source of truth for hometown geocoding. v1 is loaded from the static
-- src/data/cities.json that scripts/build_geo.py emits — see that script
-- for the gazetteer ingestion path. In production this table can be
-- populated either:
--   1. From the bundled cities.json via a seed (cleanest for the demo)
--   2. From a geonames cities1000 seed via dbt seeds (full coverage)
--
-- The TypeScript scout engine and this table must agree on (city_norm,
-- state_code) keys, so we normalize both sides identically: trimmed,
-- lowercase city; uppercase state code.

with raw as (
    -- For v1, point this at a dbt seed `seeds/cities.csv` that mirrors
    -- src/data/cities.json. The seed must have columns:
    --   city (string), state (string), lat (float), lng (float)
    select
        city,
        state as state_code,
        lat,
        lng
    from {{ ref('cities') }}
)

select
    lower(trim(city))      as city_norm,
    upper(trim(state_code)) as state_code,
    city                    as city_display,
    lat,
    lng
from raw
