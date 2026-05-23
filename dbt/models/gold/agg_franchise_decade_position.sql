{{ config(materialized = 'table') }}

-- Per-franchise stacked timeline: for each franchise, for each decade that
-- one of the inner-30 alumni was active, count how many were active that
-- decade by primary position. Powers the StackedBars chart in the Prospect
-- Persona section of the Scout Report.
--
-- Mirrors src/lib/scoutEngine.ts buildTimeline() — keep both in sync.
--
-- One franchise's "inner-30" is the top 30 alumni in dim_player_career
-- ranked by career_value within the franchise. A player active in a span
-- D..F contributes one tally to every decade between floor(D/10)*10 and
-- floor(F/10)*10 inclusive.

with team_franchise_map as (
    select distinct teamID, franchID
    from {{ source('lahman', 'teams') }}
),

player_franchise_seasons as (
    select
        b.playerID as player_id,
        tfm.franchID
    from {{ source('lahman', 'batting') }} b
    join team_franchise_map tfm using (teamID)
    union
    select
        p.playerID as player_id,
        tfm.franchID
    from {{ source('lahman', 'pitching') }} p
    join team_franchise_map tfm using (teamID)
),

career_with_franchs as (
    select
        dpc.player_id,
        dpc.primary_pos,
        dpc.debut_year,
        coalesce(dpc.final_year, dpc.debut_year) as final_year,
        dpc.career_value,
        pfs.franchID
    from {{ ref('dim_player_career') }} dpc
    join player_franchise_seasons pfs using (player_id)
),

inner_30 as (
    -- Top 30 by career_value per franchise (the inner circle the Persona
    -- donut already uses).
    select *
    from (
        select
            *,
            row_number() over (partition by franchID order by career_value desc) as rk
        from career_with_franchs
    )
    where rk <= 30
),

decades as (
    -- Synthetic 1870..2020 decade dimension. Limit to non-empty cells via
    -- the join below.
    select decade_start
    from (
        select 1870 + (seq4() * 10) as decade_start
        from table(generator(rowcount => 16))
    )
),

exploded as (
    -- One row per (player × decade active). A decade is "active" if the
    -- player's debut..final span overlaps it at the floor-of-decade level.
    select
        i.franchID,
        i.player_id,
        i.primary_pos,
        d.decade_start
    from inner_30 i
    cross join decades d
    where floor(i.debut_year / 10) * 10 <= d.decade_start
      and floor(i.final_year / 10) * 10 >= d.decade_start
)

select
    franchID,
    decade_start,
    primary_pos,
    count(distinct player_id) as active_players
from exploded
group by 1, 2, 3
order by franchID, decade_start, primary_pos
