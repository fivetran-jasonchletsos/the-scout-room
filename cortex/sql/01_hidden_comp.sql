-- Hidden Comp — given an anchor player (typically a HOFer / franchise legend),
-- find the most similar NON-HOFer with a meaningful career.
--
-- We score similarity over an era-adjusted 6-axis z-vector that's pre-baked
-- by dbt (see gold.agg_era_normalized_profiles). This is the same vector
-- the TypeScript scout engine uses in src/lib/scoutEngine.ts — keep them
-- in sync. Era adjustment matters: counting-stat cosine treats 30 HR in
-- 1925 and 30 HR in 2001 as identical, but a scout doesn't.
--
-- Axes (batter):  vol  pow  ctc  rbi  eye  lng
-- Axes (pitcher): vol  k9   ip   win  kbb  lng
--
-- Inputs : anchor_player_id  (string)
--          state_filter      (string, optional — restrict candidates to this birth state)
--          top_n             (int,    default 5)
-- Output : ranked candidates with cosine similarity to the anchor and the
--          per-axis percentile deltas the radar chart renders.

USE DATABASE SCOUT_ROOM;
USE SCHEMA GOLD;

CREATE OR REPLACE FUNCTION COSINE_SIM_ARR(a ARRAY, b ARRAY)
RETURNS FLOAT
LANGUAGE SQL
AS
$$
    -- Cosine over two equal-length numeric arrays. Returns 0 when either
    -- vector is degenerate so the caller never divides by zero downstream.
    WITH unrolled AS (
        SELECT
            a_val::float AS av,
            b_val::float AS bv
        FROM TABLE(FLATTEN(input => a)) za
        JOIN TABLE(FLATTEN(input => b)) zb
          ON za.index = zb.index
        CROSS JOIN LATERAL (SELECT za.value AS a_val) ax
        CROSS JOIN LATERAL (SELECT zb.value AS b_val) bx
    ),
    moments AS (
        SELECT
            SUM(av * bv) AS dot,
            SUM(av * av) AS na,
            SUM(bv * bv) AS nb
        FROM unrolled
    )
    SELECT
        CASE WHEN na = 0 OR nb = 0 THEN 0
             ELSE dot / (SQRT(na) * SQRT(nb))
        END
    FROM moments
$$;

CREATE OR REPLACE PROCEDURE FIND_HIDDEN_COMP(
    ANCHOR_PLAYER_ID STRING,
    STATE_FILTER STRING DEFAULT NULL,
    TOP_N NUMBER DEFAULT 5
)
RETURNS TABLE (
    player_id    STRING,
    full_name    STRING,
    primary_pos  STRING,
    era          STRING,
    similarity   FLOAT,
    z_vector     ARRAY,
    profile_text STRING
)
LANGUAGE SQL
AS
$$
DECLARE
    anchor_vec ARRAY;
    anchor_pos STRING;
    anchor_role STRING;
BEGIN
    SELECT z_vector, primary_pos, role
      INTO :anchor_vec, :anchor_pos, :anchor_role
      FROM AGG_ERA_NORMALIZED_PROFILES
     WHERE player_id = :ANCHOR_PLAYER_ID;

    LET rs RESULTSET := (
        SELECT
            enp.player_id,
            enp.full_name,
            enp.primary_pos,
            enp.era,
            COSINE_SIM_ARR(enp.z_vector, :anchor_vec) AS similarity,
            enp.z_vector,
            pe.profile_text
        FROM AGG_ERA_NORMALIZED_PROFILES enp
        LEFT JOIN PLAYER_EMBEDDINGS pe
          USING (player_id)
        WHERE enp.player_id != :ANCHOR_PLAYER_ID
          AND enp.is_hof = 0
          AND enp.role  = :anchor_role
          AND (:STATE_FILTER IS NULL OR enp.birth_state = :STATE_FILTER)
        ORDER BY similarity DESC
        LIMIT :TOP_N
    );
    RETURN TABLE(rs);
END;
$$;

-- Companion: per-axis percentile deltas for the top candidate (drives the
-- dynamic insight text on the front-end — "they're closest on K-rate, anchor
-- pulls ahead on volume" etc).
CREATE OR REPLACE FUNCTION COMP_AXIS_DELTAS(
    ANCHOR_PLAYER_ID STRING,
    CANDIDATE_PLAYER_ID STRING
)
RETURNS TABLE (axis_idx INT, axis_key STRING, anchor_z FLOAT, candidate_z FLOAT, delta FLOAT)
LANGUAGE SQL
AS
$$
    WITH labels AS (
        SELECT primary_pos FROM AGG_ERA_NORMALIZED_PROFILES WHERE player_id = ANCHOR_PLAYER_ID
    ),
    bat_keys AS (
        SELECT * FROM VALUES (0,'vol'),(1,'pow'),(2,'ctc'),(3,'rbi'),(4,'eye'),(5,'lng') AS t(axis_idx, axis_key)
    ),
    pit_keys AS (
        SELECT * FROM VALUES (0,'vol'),(1,'k9'), (2,'ip'), (3,'win'),(4,'kbb'),(5,'lng') AS t(axis_idx, axis_key)
    ),
    keys AS (
        SELECT * FROM bat_keys WHERE (SELECT primary_pos FROM labels) != 'P'
        UNION ALL
        SELECT * FROM pit_keys WHERE (SELECT primary_pos FROM labels)  = 'P'
    ),
    anchor_axes AS (
        SELECT k.axis_idx, k.axis_key, a.value::float AS z
        FROM (SELECT z_vector FROM AGG_ERA_NORMALIZED_PROFILES WHERE player_id = ANCHOR_PLAYER_ID),
             TABLE(FLATTEN(input => z_vector)) a
        JOIN keys k ON k.axis_idx = a.index
    ),
    cand_axes AS (
        SELECT k.axis_idx, k.axis_key, c.value::float AS z
        FROM (SELECT z_vector FROM AGG_ERA_NORMALIZED_PROFILES WHERE player_id = CANDIDATE_PLAYER_ID),
             TABLE(FLATTEN(input => z_vector)) c
        JOIN keys k ON k.axis_idx = c.index
    )
    SELECT a.axis_idx, a.axis_key, a.z AS anchor_z, c.z AS candidate_z, (a.z - c.z) AS delta
    FROM anchor_axes a
    JOIN cand_axes   c USING (axis_idx)
    ORDER BY axis_idx
$$;

-- Usage:
--   CALL FIND_HIDDEN_COMP('ruthba01', 'NY', 5);
--   SELECT * FROM TABLE(COMP_AXIS_DELTAS('ruthba01', 'gehrilo01'));
