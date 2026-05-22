{{ config(materialized = 'table') }}

-- Top players per birth_state, ranked by career_value. Backs the
-- "Hometown Heroes" section of the Scout Report.

select
    birth_state,
    player_id,
    full_name,
    primary_pos,
    debut_year,
    final_year,
    birth_city,
    is_hof,
    all_star_selections,
    career_value,
    row_number() over (partition by birth_state order by career_value desc) as state_rank
from {{ ref('dim_player_career') }}
where birth_state is not null
qualify state_rank <= 100
