-- The Scout Room — Cortex setup
--
-- Run this once against the SCOUT_ROOM database (after dbt has populated
-- the GOLD schema). Builds the embedding column + search service used by
-- the comp engine + narrative generator.

USE DATABASE SCOUT_ROOM;
USE SCHEMA GOLD;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Player embeddings — a single vector per player encoding their
--    career shape. Used for cosine-similarity comps.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE TABLE PLAYER_EMBEDDINGS AS
WITH career_profiles AS (
    SELECT
        player_id,
        full_name,
        primary_pos,
        -- Build a natural-language summary of each career — this is what
        -- gets embedded. The model picks up similarity in role + shape +
        -- era that pure numeric vectors miss.
        CONCAT(
            full_name, ' was a ', primary_pos, ' who debuted in ', debut_year::string,
            ' and played through ', COALESCE(final_year::string, debut_year::string), '. ',
            CASE WHEN primary_pos = 'P'
                 THEN 'Career: ' || pit_w::string || ' wins, '
                      || pit_so::string || ' strikeouts, '
                      || pit_ip::int::string || ' innings pitched. '
                 ELSE 'Career: ' || bat_h::string || ' hits, '
                      || bat_hr::string || ' home runs, '
                      || bat_rbi::string || ' RBIs, '
                      || bat_sb::string || ' stolen bases. '
            END,
            CASE WHEN is_hof = 1 THEN 'Hall of Fame inductee. ' ELSE '' END,
            CASE WHEN all_star_selections > 0
                 THEN all_star_selections::string || '-time All-Star. ' ELSE '' END
        ) AS profile_text
    FROM {{ ref('dim_player_career') }}
)
SELECT
    player_id,
    full_name,
    primary_pos,
    profile_text,
    SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', profile_text) AS profile_embedding
FROM career_profiles;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Cortex Search Service — for the "find me a player who feels like X"
--    free-form query. SEs can ask things like
--      "left-handed power hitter who could steal a base, 1970s"
--    and get ranked results.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE CORTEX SEARCH SERVICE PLAYER_SEARCH
  ON profile_text
  ATTRIBUTES player_id, full_name, primary_pos
  WAREHOUSE = TRANSFORM_WH
  TARGET_LAG = '1 day'
  AS (
    SELECT player_id, full_name, primary_pos, profile_text
    FROM PLAYER_EMBEDDINGS
  );
