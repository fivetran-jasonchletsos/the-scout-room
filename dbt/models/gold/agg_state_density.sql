{{ config(materialized = 'table') }}

-- State-of-origin density across all of MLB history.
--
-- For every birth state we count the number of "top-100-state" players —
-- the top 100 by career_value born in that state. The result powers the
-- StateTileMap choropleth in the Did You Know section. Quintile is computed
-- across non-zero states so empty states don't compress the color scale.
--
-- Mirrors src/lib/scoutEngine.ts buildStateDensity() — keep both in sync.

with players_per_state as (
    select
        birth_state,
        player_id,
        career_value,
        row_number() over (partition by birth_state order by career_value desc) as state_rk
    from {{ ref('dim_player_career') }}
    where birth_state is not null
      and birth_country = 'USA'
),

top_100_per_state as (
    select birth_state, count(*) as top100_count
    from players_per_state
    where state_rk <= 100
    group by 1
),

ranked as (
    select
        s.birth_state                                    as state_code,
        coalesce(t.top100_count, 0)                      as top100_count,
        row_number() over (order by coalesce(t.top100_count, 0) desc) as density_rank
    from (
        -- Every state we know about, even if zero qualifying players
        select distinct birth_state from {{ ref('dim_player_career') }}
        where birth_state is not null
    ) s
    left join top_100_per_state t on s.birth_state = t.birth_state
),

with_quintiles as (
    select
        state_code,
        top100_count,
        density_rank,
        case
            when top100_count = 0 then 0
            else width_bucket(
                top100_count,
                (select min(top100_count) from top_100_per_state),
                (select max(top100_count) from top_100_per_state) + 1,
                5
            ) - 1
        end as quintile
    from ranked
)

select * from with_quintiles
order by density_rank
