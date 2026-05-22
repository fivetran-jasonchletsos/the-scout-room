-- Hidden Comp — given an anchor player (typically a HOFer / franchise legend),
-- find the most similar NON-HOFer with a meaningful career.
--
-- Inputs : anchor_player_id  (string)
--          state_filter      (string, optional — restrict candidates to this birth state)
-- Output : ranked candidates with cosine similarity to the anchor

CREATE OR REPLACE PROCEDURE FIND_HIDDEN_COMP(
    ANCHOR_PLAYER_ID STRING,
    STATE_FILTER STRING DEFAULT NULL,
    TOP_N NUMBER DEFAULT 5
)
RETURNS TABLE (player_id STRING, full_name STRING, primary_pos STRING,
               similarity FLOAT, profile_text STRING)
LANGUAGE SQL
AS
$$
DECLARE
    anchor_vec VECTOR(FLOAT, 768);
    anchor_pos STRING;
BEGIN
    SELECT profile_embedding, primary_pos
      INTO :anchor_vec, :anchor_pos
      FROM PLAYER_EMBEDDINGS WHERE player_id = :ANCHOR_PLAYER_ID;

    LET rs RESULTSET := (
        SELECT
            pe.player_id,
            pe.full_name,
            pe.primary_pos,
            VECTOR_COSINE_SIMILARITY(pe.profile_embedding, :anchor_vec) AS similarity,
            pe.profile_text
        FROM PLAYER_EMBEDDINGS pe
        JOIN DIM_PLAYER_CAREER dpc USING (player_id)
        WHERE pe.player_id != :ANCHOR_PLAYER_ID
          AND dpc.is_hof = 0
          AND (pe.primary_pos = :anchor_pos
               OR (:anchor_pos = 'P') = (pe.primary_pos = 'P'))
          AND (:STATE_FILTER IS NULL OR dpc.birth_state = :STATE_FILTER)
          AND (dpc.bat_g + dpc.pit_g) >= 200
        ORDER BY similarity DESC
        LIMIT :TOP_N
    );
    RETURN TABLE(rs);
END;
$$;

-- Usage example:
--   CALL FIND_HIDDEN_COMP('ruthba01', 'NY', 5);
