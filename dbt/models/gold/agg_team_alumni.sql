{{ config(materialized = 'table') }}

-- Top alumni per franchise, ranked by career_value. Used by the Scout
-- Report's "Prospect Persona" and "Hidden Comp" sections.

with exploded as (
    select
        c.player_id,
        c.full_name,
        c.primary_pos,
        c.career_value,
        c.is_hof,
        f.value::string as franch_id
    from {{ ref('dim_player_career') }} c,
         lateral flatten(input => c.franchises) f
)

select
    franch_id,
    player_id,
    full_name,
    primary_pos,
    career_value,
    is_hof,
    row_number() over (partition by franch_id order by career_value desc) as alumni_rank
from exploded
qualify alumni_rank <= 100
