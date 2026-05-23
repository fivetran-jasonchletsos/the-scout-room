{{ config(materialized = 'table') }}

-- MLB franchise ballpark locations — used by Cortex to infer the user's
-- likely team from their hometown coords. v1 is loaded from the static
-- src/data/team_locations.json (via a dbt seed). Mirrors the TS engine's
-- inferFranchise() in src/lib/scoutEngine.ts.

select
    franchID    as franch_id,
    name        as franchise_name,
    city,
    state,
    lat,
    lng
from {{ ref('team_locations') }}
