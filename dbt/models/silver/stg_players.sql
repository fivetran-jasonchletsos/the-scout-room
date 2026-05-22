{{ config(materialized = 'table') }}

-- One clean row per player. Pulls birth city/state/country, debut + final year,
-- physical profile, primary position (computed from Appearances totals).

with people as (
    select * from {{ source('lahman', 'people') }}
),

appearances_rolled as (
    select
        playerID,
        sum(G_p)  as g_p,
        sum(G_c)  as g_c,
        sum(G_1b) as g_1b,
        sum(G_2b) as g_2b,
        sum(G_3b) as g_3b,
        sum(G_ss) as g_ss,
        sum(G_lf) as g_lf,
        sum(G_cf) as g_cf,
        sum(G_rf) as g_rf,
        sum(G_dh) as g_dh
    from {{ source('lahman', 'appearances') }}
    group by 1
),

with_primary_pos as (
    select
        a.*,
        case
            when g_p  >= greatest(g_c, g_1b, g_2b, g_3b, g_ss, g_lf, g_cf, g_rf, g_dh)  then 'P'
            when g_c  >= greatest(g_1b, g_2b, g_3b, g_ss, g_lf, g_cf, g_rf, g_dh)       then 'C'
            when g_1b >= greatest(g_2b, g_3b, g_ss, g_lf, g_cf, g_rf, g_dh)             then '1B'
            when g_2b >= greatest(g_3b, g_ss, g_lf, g_cf, g_rf, g_dh)                   then '2B'
            when g_3b >= greatest(g_ss, g_lf, g_cf, g_rf, g_dh)                          then '3B'
            when g_ss >= greatest(g_lf, g_cf, g_rf, g_dh)                                then 'SS'
            when g_lf >= greatest(g_cf, g_rf, g_dh)                                      then 'LF'
            when g_cf >= greatest(g_rf, g_dh)                                            then 'CF'
            when g_rf >= g_dh                                                            then 'RF'
            else 'DH'
        end as primary_pos
    from appearances_rolled a
)

select
    p.playerID                       as player_id,
    p.nameFirst                      as first_name,
    p.nameLast                       as last_name,
    trim(p.nameFirst || ' ' || p.nameLast) as full_name,
    cast(p.birthYear  as int)        as birth_year,
    p.birthState                     as birth_state,
    p.birthCity                      as birth_city,
    p.birthCountry                   as birth_country,
    cast(p.deathYear  as int)        as death_year,
    year(cast(p.debut     as date))  as debut_year,
    year(cast(p.finalGame as date))  as final_year,
    p.bats                           as bats,
    p.throws                         as throws,
    cast(p.height as int)            as height_inches,
    cast(p.weight as int)            as weight_lbs,
    p.bbrefID                        as bbref_id,
    coalesce(wp.primary_pos, 'P')    as primary_pos
from people p
left join with_primary_pos wp using (playerID)
where p.debut is not null
