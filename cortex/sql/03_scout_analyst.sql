-- Scout Analyst — a Cortex Analyst semantic model that lets SEs (or fans!)
-- ask the Scout Room database in natural language.
--
-- Save as scout_analyst.yaml in Snowflake's stage @cortex_analyst.

/*
name: scout_analyst
description: |
  Natural-language query interface over The Scout Room gold schema.
  Lets users ask things like:
    "Who are the top 10 hitters born in Texas?"
    "Compare Bagwell and Pujols by career value"
    "Which franchise has produced the most Hall of Fame pitchers?"

tables:
  - name: dim_player_career
    description: One row per player. Career totals + biographical data.
    base_table:
      database: SCOUT_ROOM
      schema:   GOLD
      table:    DIM_PLAYER_CAREER
    primary_key:
      columns: [player_id]
    dimensions:
      - name: player_id
        synonyms: ["id"]
        expr: player_id
        data_type: VARCHAR
        unique: true
      - name: full_name
        synonyms: ["player name", "name"]
        expr: full_name
        data_type: VARCHAR
      - name: birth_state
        synonyms: ["state", "where they were born"]
        expr: birth_state
        data_type: VARCHAR
      - name: birth_city
        expr: birth_city
        data_type: VARCHAR
      - name: primary_pos
        synonyms: ["position", "role"]
        expr: primary_pos
        data_type: VARCHAR
      - name: debut_year
        expr: debut_year
        data_type: NUMBER
      - name: final_year
        expr: final_year
        data_type: NUMBER
      - name: is_hof
        synonyms: ["hall of fame", "cooperstown"]
        expr: is_hof
        data_type: NUMBER
    measures:
      - name: career_value
        synonyms: ["WAR proxy", "career score", "value"]
        expr: career_value
        data_type: FLOAT
        default_aggregation: avg
      - name: bat_hr
        synonyms: ["home runs", "homers"]
        expr: bat_hr
        data_type: NUMBER
        default_aggregation: sum
      - name: bat_h
        synonyms: ["hits"]
        expr: bat_h
        default_aggregation: sum
      - name: pit_w
        synonyms: ["wins"]
        expr: pit_w
        default_aggregation: sum
      - name: pit_so
        synonyms: ["strikeouts", "Ks"]
        expr: pit_so
        default_aggregation: sum

  - name: agg_team_alumni
    description: Top 100 alumni per active franchise.
    base_table:
      database: SCOUT_ROOM
      schema:   GOLD
      table:    AGG_TEAM_ALUMNI
    dimensions:
      - name: franch_id
        synonyms: ["franchise", "team"]
        expr: franch_id
      - name: player_id
        expr: player_id
      - name: alumni_rank
        expr: alumni_rank

  - name: agg_state_alumni
    description: Top players per birth state.
    base_table:
      database: SCOUT_ROOM
      schema:   GOLD
      table:    AGG_STATE_ALUMNI
    dimensions:
      - name: birth_state
        expr: birth_state
      - name: state_rank
        expr: state_rank
*/
