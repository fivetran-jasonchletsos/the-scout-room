-- Hometown geo UDFs — used by the Scout Report to resolve a city + state
-- input to coords, search players within a radius, and infer the user's
-- favorite franchise from their hometown.
--
-- Mirrors src/lib/scoutEngine.ts geo helpers — keep both in sync.

USE DATABASE SCOUT_ROOM;
USE SCHEMA GOLD;

-- Haversine distance in miles between two (lat, lng) pairs.
CREATE OR REPLACE FUNCTION HAVERSINE_MI(
    LAT_A FLOAT, LNG_A FLOAT, LAT_B FLOAT, LNG_B FLOAT
)
RETURNS FLOAT
LANGUAGE SQL
AS
$$
    WITH params AS (
        SELECT
            RADIANS(LAT_B - LAT_A) AS d_lat,
            RADIANS(LNG_B - LNG_A) AS d_lng,
            RADIANS(LAT_A) AS lat_a_r,
            RADIANS(LAT_B) AS lat_b_r
    ),
    h AS (
        SELECT
            POWER(SIN(d_lat / 2), 2)
            + COS(lat_a_r) * COS(lat_b_r) * POWER(SIN(d_lng / 2), 2) AS a
        FROM params
    )
    SELECT 2 * 3958.8 * ASIN(SQRT(a)) FROM h
$$;

-- Resolve a (city, state) input to coords. Returns null if not in the
-- centroid table — the caller is expected to fall back to state-level
-- behavior in that case.
CREATE OR REPLACE FUNCTION GEOCODE_CITY(CITY STRING, STATE STRING)
RETURNS TABLE (lat FLOAT, lng FLOAT)
LANGUAGE SQL
AS
$$
    SELECT lat, lng
    FROM DIM_CITY_CENTROID
    WHERE city_norm  = LOWER(TRIM(CITY))
      AND state_code = UPPER(TRIM(STATE))
$$;

-- Hometown radius search: return every player born within radius_mi of
-- the user's hometown, ranked by career_value. Drives the Hometown Heroes
-- section.
CREATE OR REPLACE PROCEDURE FIND_HOMETOWN_HEROES(
    USER_CITY STRING,
    USER_STATE STRING,
    RADIUS_MI FLOAT DEFAULT 75.0,
    TOP_N NUMBER DEFAULT 5
)
RETURNS TABLE (
    player_id STRING,
    full_name STRING,
    primary_pos STRING,
    birth_city STRING,
    birth_state STRING,
    distance_mi FLOAT,
    career_value FLOAT
)
LANGUAGE SQL
AS
$$
DECLARE
    home_lat FLOAT;
    home_lng FLOAT;
BEGIN
    SELECT lat, lng INTO :home_lat, :home_lng
    FROM TABLE(GEOCODE_CITY(:USER_CITY, :USER_STATE));

    -- If we couldn't geocode the city, return everyone in the state
    -- (state-fallback path). Distance comes back null in that case.
    LET rs RESULTSET := (
        SELECT
            dpc.player_id,
            dpc.full_name,
            dpc.primary_pos,
            dpc.birth_city,
            dpc.birth_state,
            CASE WHEN :home_lat IS NULL THEN NULL
                 ELSE HAVERSINE_MI(:home_lat, :home_lng, cc.lat, cc.lng)
            END AS distance_mi,
            dpc.career_value
        FROM DIM_PLAYER_CAREER dpc
        LEFT JOIN DIM_CITY_CENTROID cc
          ON cc.city_norm  = LOWER(TRIM(dpc.birth_city))
         AND cc.state_code = UPPER(TRIM(dpc.birth_state))
        WHERE
            (:home_lat IS NOT NULL
                AND HAVERSINE_MI(:home_lat, :home_lng, cc.lat, cc.lng) <= :RADIUS_MI)
         OR (:home_lat IS NULL
                AND dpc.birth_state = UPPER(TRIM(:USER_STATE)))
        ORDER BY dpc.career_value DESC
        LIMIT :TOP_N
    );
    RETURN TABLE(rs);
END;
$$;

-- Infer the user's team from their hometown. Returns the nearest franchise
-- plus the next three runners-up so the caller can offer overrides for
-- markets with multiple MLB teams (NY, LA, Bay Area, Chicago, Texas, FL).
CREATE OR REPLACE FUNCTION INFER_FRANCHISE(
    HOME_LAT FLOAT, HOME_LNG FLOAT
)
RETURNS TABLE (franch_id STRING, franchise_name STRING, distance_mi FLOAT, rank INT)
LANGUAGE SQL
AS
$$
    SELECT
        franch_id,
        franchise_name,
        HAVERSINE_MI(HOME_LAT, HOME_LNG, lat, lng) AS distance_mi,
        ROW_NUMBER() OVER (ORDER BY HAVERSINE_MI(HOME_LAT, HOME_LNG, lat, lng)) AS rank
    FROM DIM_FRANCHISE_LOCATION
    ORDER BY distance_mi
    LIMIT 4
$$;

-- Usage:
--   CALL FIND_HOMETOWN_HEROES('Tampa', 'FL', 75, 5);
--   SELECT * FROM TABLE(INFER_FRANCHISE(27.95, -82.46));
