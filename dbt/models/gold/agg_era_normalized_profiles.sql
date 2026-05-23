{{ config(materialized = 'table') }}

-- Era-normalized career profiles.
--
-- For each player we compute a 6-axis "shape" vector, then z-score every axis
-- against the player's debut-era cohort. This is what the Scout Report's
-- Hidden Comp uses for similarity — 30 HR in 1925 and 30 HR in 2001 mean
-- different things, and counting-stat cosine treats them as identical, so we
-- pre-bake the era adjustment here.
--
-- Mirrors src/lib/scoutEngine.ts profileOf() — keep both in sync.
--
-- Axes (batter):  vol  pow  ctc  rbi  eye  lng
-- Axes (pitcher): vol  k9   ip   win  kbb  lng

with base as (
    select * from {{ ref('dim_player_career') }}
),

with_era as (
    select
        *,
        case
            when debut_year <  1900 then '19th century'
            when debut_year <  1920 then 'Dead Ball Era'
            when debut_year <  1942 then 'Live Ball Era'
            when debut_year <  1961 then 'Integration Era'
            when debut_year <  1977 then 'Expansion Era'
            when debut_year <  1994 then 'Free Agency Era'
            when debut_year <  2006 then 'Steroid Era'
            when debut_year <  2015 then 'Post-Steroid Era'
            else 'Statcast Era'
        end as era,
        case when primary_pos = 'P' then 'pit' else 'bat' end as role,
        greatest(1, coalesce(final_year, debut_year) - debut_year + 1) as career_years
    from base
),

-- Raw per-player axis values. Pitchers and batters live in the same table
-- but unused axes for the off-role are set to null so they don't pollute
-- the per-cohort moments. Each axis column carries a single semantic.
raw_axes as (
    select
        player_id, full_name, primary_pos, birth_state, debut_year, final_year,
        is_hof, era, role, career_years,
        -- Batter axes
        case when role = 'bat' then bat_g                                 end as bat_vol,
        case when role = 'bat' then bat_hr  / nullif(bat_ab, 0)::float    end as bat_pow,
        case when role = 'bat' then bat_h   / nullif(bat_ab, 0)::float    end as bat_ctc,
        case when role = 'bat' then bat_rbi / nullif(bat_g,  0)::float    end as bat_rbi_rate,
        case when role = 'bat' then bat_bb  / nullif(bat_bb + bat_so + 1, 0)::float end as bat_eye,
        case when role = 'bat' then career_years                          end as bat_lng,
        -- Pitcher axes
        case when role = 'pit' then pit_g                                 end as pit_vol,
        case when role = 'pit' then (pit_so * 9.0) / nullif(pit_ip, 0)    end as pit_k9,
        case when role = 'pit' then pit_ip                                end as pit_ip_axis,
        case when role = 'pit' then pit_w / nullif(pit_w + pit_l + 1, 0)::float end as pit_win,
        case when role = 'pit' then pit_so / nullif(pit_bb + 1, 0)::float end as pit_kbb,
        case when role = 'pit' then career_years                          end as pit_lng
    from with_era
    where (role = 'bat' and bat_g >= 50)
       or (role = 'pit' and pit_g >= 20)
),

-- Per-era moments. Computed via window functions so we don't have to
-- materialize a separate cohort table.
moments as (
    select
        r.*,
        avg(bat_vol)     over (partition by era) as m_bat_vol,
        stddev(bat_vol)  over (partition by era) as s_bat_vol,
        avg(bat_pow)     over (partition by era) as m_bat_pow,
        stddev(bat_pow)  over (partition by era) as s_bat_pow,
        avg(bat_ctc)     over (partition by era) as m_bat_ctc,
        stddev(bat_ctc)  over (partition by era) as s_bat_ctc,
        avg(bat_rbi_rate)     over (partition by era) as m_bat_rbi,
        stddev(bat_rbi_rate)  over (partition by era) as s_bat_rbi,
        avg(bat_eye)     over (partition by era) as m_bat_eye,
        stddev(bat_eye)  over (partition by era) as s_bat_eye,
        avg(bat_lng)     over (partition by era) as m_bat_lng,
        stddev(bat_lng)  over (partition by era) as s_bat_lng,
        avg(pit_vol)     over (partition by era) as m_pit_vol,
        stddev(pit_vol)  over (partition by era) as s_pit_vol,
        avg(pit_k9)      over (partition by era) as m_pit_k9,
        stddev(pit_k9)   over (partition by era) as s_pit_k9,
        avg(pit_ip_axis) over (partition by era) as m_pit_ip,
        stddev(pit_ip_axis) over (partition by era) as s_pit_ip,
        avg(pit_win)     over (partition by era) as m_pit_win,
        stddev(pit_win)  over (partition by era) as s_pit_win,
        avg(pit_kbb)     over (partition by era) as m_pit_kbb,
        stddev(pit_kbb)  over (partition by era) as s_pit_kbb,
        avg(pit_lng)     over (partition by era) as m_pit_lng,
        stddev(pit_lng)  over (partition by era) as s_pit_lng
    from raw_axes r
)

select
    player_id, full_name, primary_pos, birth_state, debut_year, final_year,
    is_hof, era, role, career_years,
    -- Z-scored axes (null when off-role)
    (bat_vol      - m_bat_vol) / nullif(s_bat_vol, 0) as z_bat_vol,
    (bat_pow      - m_bat_pow) / nullif(s_bat_pow, 0) as z_bat_pow,
    (bat_ctc      - m_bat_ctc) / nullif(s_bat_ctc, 0) as z_bat_ctc,
    (bat_rbi_rate - m_bat_rbi) / nullif(s_bat_rbi, 0) as z_bat_rbi,
    (bat_eye      - m_bat_eye) / nullif(s_bat_eye, 0) as z_bat_eye,
    (bat_lng      - m_bat_lng) / nullif(s_bat_lng, 0) as z_bat_lng,
    (pit_vol      - m_pit_vol) / nullif(s_pit_vol, 0) as z_pit_vol,
    (pit_k9       - m_pit_k9)  / nullif(s_pit_k9,  0) as z_pit_k9,
    (pit_ip_axis  - m_pit_ip)  / nullif(s_pit_ip,  0) as z_pit_ip,
    (pit_win      - m_pit_win) / nullif(s_pit_win, 0) as z_pit_win,
    (pit_kbb      - m_pit_kbb) / nullif(s_pit_kbb, 0) as z_pit_kbb,
    (pit_lng      - m_pit_lng) / nullif(s_pit_lng, 0) as z_pit_lng,
    -- Single 6-vector column used by the comp UDF. Order is fixed:
    --   batters: [vol, pow, ctc, rbi, eye, lng]
    --   pitchers:[vol, k9,  ip,  win, kbb, lng]
    case when role = 'bat' then array_construct(
            coalesce((bat_vol - m_bat_vol) / nullif(s_bat_vol, 0), 0),
            coalesce((bat_pow - m_bat_pow) / nullif(s_bat_pow, 0), 0),
            coalesce((bat_ctc - m_bat_ctc) / nullif(s_bat_ctc, 0), 0),
            coalesce((bat_rbi_rate - m_bat_rbi) / nullif(s_bat_rbi, 0), 0),
            coalesce((bat_eye - m_bat_eye) / nullif(s_bat_eye, 0), 0),
            coalesce((bat_lng - m_bat_lng) / nullif(s_bat_lng, 0), 0)
         )
         else array_construct(
            coalesce((pit_vol - m_pit_vol) / nullif(s_pit_vol, 0), 0),
            coalesce((pit_k9  - m_pit_k9)  / nullif(s_pit_k9,  0), 0),
            coalesce((pit_ip_axis - m_pit_ip) / nullif(s_pit_ip, 0), 0),
            coalesce((pit_win - m_pit_win) / nullif(s_pit_win, 0), 0),
            coalesce((pit_kbb - m_pit_kbb) / nullif(s_pit_kbb, 0), 0),
            coalesce((pit_lng - m_pit_lng) / nullif(s_pit_lng, 0), 0)
         )
    end as z_vector
from moments
