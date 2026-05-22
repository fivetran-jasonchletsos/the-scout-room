-- Scout Narrative — Cortex.COMPLETE call that produces the closing
-- paragraph for the report. Takes structured findings, returns a
-- 4-sentence narrative.

CREATE OR REPLACE FUNCTION SCOUT_NARRATIVE(
    TEAM_NAME STRING,
    STATE_NAME STRING,
    HOMETOWN_TOP_FIVE ARRAY,
    PERSONA_BREAKDOWN ARRAY,
    HIDDEN_COMP OBJECT
)
RETURNS STRING
LANGUAGE SQL
AS
$$
    SNOWFLAKE.CORTEX.COMPLETE(
        'claude-3-5-sonnet',
        CONCAT(
            'You are a baseball scout writing a closing paragraph for a personalized Scout Report. ',
            'Use the structured findings below to produce exactly 4 sentences. ',
            'Tone: confident, dense, factual. No marketing language. ',
            'Mention the team, the state, the top hometown hero, the franchise''s prospect persona, ',
            'and the hidden comp. End with a single sentence about how Open Data Infrastructure ',
            '(Iceberg + Cortex) makes this possible.',
            CHAR(10), CHAR(10),
            'TEAM: ',     TEAM_NAME,        CHAR(10),
            'STATE: ',    STATE_NAME,       CHAR(10),
            'HOMETOWN HEROES: ', HOMETOWN_TOP_FIVE::STRING, CHAR(10),
            'PERSONA: ',  PERSONA_BREAKDOWN::STRING, CHAR(10),
            'HIDDEN COMP: ', HIDDEN_COMP::STRING
        )
    )
$$;

-- Usage example (composed by the API layer):
--   SELECT SCOUT_NARRATIVE(
--     'Boston Red Sox',
--     'Massachusetts',
--     [{full_name: 'Tom Glavine', career_value: 870, primary_pos: 'P'}, ...],
--     [{position: 'P', count: 8, top: 'Roger Clemens'}, ...],
--     {anchor: 'Babe Ruth', candidate: 'Mark Teixeira', similarity: 0.87}
--   );
