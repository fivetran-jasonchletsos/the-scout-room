{{ config(materialized = 'table') }}

-- One row per player. Career totals + a Lahman-only "career value" proxy
-- (no WAR in Lahman, so we approximate). Plus rollups used by the Scout
-- Report: All-Star count, major awards, HOF flag, franchise list.

with players as (
    select * from {{ ref('stg_players') }}
),

career_batting as (
    select
        playerID as player_id,
        sum(G)   as bat_g,
        sum(AB)  as bat_ab,
        sum(R)   as bat_r,
        sum(H)   as bat_h,
        sum(HR)  as bat_hr,
        sum(RBI) as bat_rbi,
        sum(SB)  as bat_sb,
        sum(BB)  as bat_bb,
        sum(SO)  as bat_so,
        sum("2B") as bat_2b,
        sum("3B") as bat_3b
    from {{ source('lahman', 'batting') }}
    group by 1
),

career_pitching as (
    select
        playerID as player_id,
        sum(G)      as pit_g,
        sum(GS)     as pit_gs,
        sum(W)      as pit_w,
        sum(L)      as pit_l,
        sum(SV)     as pit_sv,
        sum(IPouts) as pit_ip_outs,
        sum(H)      as pit_h_allowed,
        sum(ER)     as pit_er,
        sum(HR)     as pit_hr_allowed,
        sum(BB)     as pit_bb,
        sum(SO)     as pit_so
    from {{ source('lahman', 'pitching') }}
    group by 1
),

all_stars as (
    select playerID as player_id, count(*) as all_star_selections
    from {{ source('lahman', 'allstar_full') }}
    group by 1
),

major_awards as (
    select
        playerID as player_id,
        count(*) as major_award_count
    from {{ source('lahman', 'awards_players') }}
    where awardID in (
        'Most Valuable Player', 'Cy Young Award', 'Rookie of the Year',
        'Gold Glove', 'Silver Slugger', 'World Series MVP',
        'Triple Crown', 'Pitching Triple Crown'
    )
    group by 1
),

hof as (
    select
        playerID as player_id,
        max(yearID) as hof_year,
        max(case when inducted = 'Y' then 1 else 0 end) as is_hof
    from {{ source('lahman', 'hall_of_fame') }}
    where category = 'Player'
    group by 1
),

franchise_rollup as (
    select
        b.playerID as player_id,
        array_agg(distinct t.franchID) as franchises
    from {{ source('lahman', 'batting') }} b
    join {{ source('lahman', 'teams') }} t
      on b.teamID = t.teamID and b.yearID = t.yearID
    group by 1
)

select
    p.player_id,
    p.full_name,
    p.first_name,
    p.last_name,
    p.birth_year,
    p.birth_state,
    p.birth_city,
    p.birth_country,
    p.debut_year,
    p.final_year,
    p.bats,
    p.throws,
    p.height_inches,
    p.weight_lbs,
    p.primary_pos,
    coalesce(b.bat_g,   0) as bat_g,
    coalesce(b.bat_ab,  0) as bat_ab,
    coalesce(b.bat_h,   0) as bat_h,
    coalesce(b.bat_hr,  0) as bat_hr,
    coalesce(b.bat_rbi, 0) as bat_rbi,
    coalesce(b.bat_sb,  0) as bat_sb,
    coalesce(b.bat_bb,  0) as bat_bb,
    coalesce(p2.pit_g,  0) as pit_g,
    coalesce(p2.pit_w,  0) as pit_w,
    coalesce(p2.pit_l,  0) as pit_l,
    coalesce(p2.pit_so, 0) as pit_so,
    coalesce(p2.pit_ip_outs, 0) / 3.0 as pit_ip,
    coalesce(a.all_star_selections, 0) as all_star_selections,
    coalesce(ma.major_award_count, 0)  as major_award_count,
    coalesce(h.is_hof, 0)              as is_hof,
    h.hof_year,
    fr.franchises,
    -- Career value proxy — see lib/scoutEngine.ts for the matching JS formula
    greatest(
      coalesce(b.bat_hr,  0) * 1.0 +
      coalesce(b.bat_rbi, 0) * 0.30 +
      coalesce(b.bat_h,   0) * 0.05 +
      coalesce(b.bat_sb,  0) * 0.30 +
      coalesce(b.bat_bb,  0) * 0.05,
      0
    )
    + greatest(
      coalesce(p2.pit_w, 0) * 2.0 +
      coalesce(p2.pit_so, 0) * 0.05 +
      (coalesce(p2.pit_ip_outs, 0) / 3.0) * 0.10 -
      coalesce(p2.pit_l, 0) * 1.0,
      0
    )
    + coalesce(a.all_star_selections, 0) * 25
    + coalesce(h.is_hof, 0) * 500
    + coalesce(ma.major_award_count, 0) * 15
    as career_value
from players p
left join career_batting     b   using (player_id)
left join career_pitching    p2  using (player_id)
left join all_stars          a   using (player_id)
left join major_awards       ma  using (player_id)
left join hof                h   using (player_id)
left join franchise_rollup   fr  using (player_id)
