"""
Build the static geographic lookup tables consumed by the Scout Room app.

Produces:
  src/data/cities.json          - city/state/lat/lng centroids for high-traffic US cities
                                  used both for user "hometown" input and for matching
                                  player birth cities to coords during radius search
  src/data/team_locations.json  - per-MLB-franchise ballpark coords used to infer
                                  the user's likely team from their hometown

Coords are hand-curated for v1. To expand coverage:
  1. Drop a geonames cities1000.txt (or US Census 2020 places gazetteer) at
     data-raw/cities1000.txt
  2. Re-run this script — it will merge gazetteer coords on top of the hand-baked
     set for every (city, state) that appears in src/data/players.json. Cities not
     in the gazetteer keep their hand-baked values; cities not in either fall back
     to state-level matching in scoutEngine.ts.
"""

from __future__ import annotations
import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR  = ROOT / "src" / "data"
GAZ_FILE  = ROOT / "data-raw" / "cities1000.txt"   # optional geonames extract

# ---------------------------------------------------------------------------
# Hand-baked city centroids. Coverage targets the top US MLB birth cities
# (see the etl notebook for the frequency ranking). Coords are city
# centroids, not ballparks. Accuracy is good enough for radius queries.
# ---------------------------------------------------------------------------

HAND_CITIES: list[dict] = [
    # Top player-producing cities
    {"city": "Philadelphia", "state": "PA", "lat": 39.9526, "lng": -75.1652},
    {"city": "Brooklyn",     "state": "NY", "lat": 40.6782, "lng": -73.9442},
    {"city": "New York",     "state": "NY", "lat": 40.7128, "lng": -74.0060},
    {"city": "Washington",   "state": "DC", "lat": 38.9072, "lng": -77.0369},
    {"city": "St. Louis",    "state": "MO", "lat": 38.6270, "lng": -90.1994},
    {"city": "Chicago",      "state": "IL", "lat": 41.8781, "lng": -87.6298},
    {"city": "Baltimore",    "state": "MD", "lat": 39.2904, "lng": -76.6122},
    {"city": "Cincinnati",   "state": "OH", "lat": 39.1031, "lng": -84.5120},
    {"city": "Pittsburgh",   "state": "PA", "lat": 40.4406, "lng": -79.9959},
    {"city": "Las Vegas",    "state": "NV", "lat": 36.1716, "lng": -115.1391},
    {"city": "Boston",       "state": "MA", "lat": 42.3601, "lng": -71.0589},
    {"city": "Denver",       "state": "CO", "lat": 39.7392, "lng": -104.9903},
    {"city": "Honolulu",     "state": "HI", "lat": 21.3069, "lng": -157.8583},
    {"city": "Detroit",      "state": "MI", "lat": 42.3314, "lng": -83.0458},
    {"city": "Milwaukee",    "state": "WI", "lat": 43.0389, "lng": -87.9065},
    {"city": "Portland",     "state": "OR", "lat": 45.5152, "lng": -122.6784},
    {"city": "Louisville",   "state": "KY", "lat": 38.2527, "lng": -85.7585},
    {"city": "Cleveland",    "state": "OH", "lat": 41.4993, "lng": -81.6944},
    {"city": "Providence",   "state": "RI", "lat": 41.8240, "lng": -71.4128},
    {"city": "Omaha",        "state": "NE", "lat": 41.2565, "lng": -95.9345},
    {"city": "Seattle",      "state": "WA", "lat": 47.6062, "lng": -122.3321},
    {"city": "New Orleans",  "state": "LA", "lat": 29.9511, "lng": -90.0715},
    {"city": "Atlanta",      "state": "GA", "lat": 33.7490, "lng": -84.3880},
    {"city": "Los Angeles",  "state": "CA", "lat": 34.0522, "lng": -118.2437},
    {"city": "St. Paul",     "state": "MN", "lat": 44.9537, "lng": -93.0900},
    {"city": "San Francisco","state": "CA", "lat": 37.7749, "lng": -122.4194},
    {"city": "Salt Lake City","state":"UT", "lat": 40.7608, "lng": -111.8910},
    {"city": "Tucson",       "state": "AZ", "lat": 32.2226, "lng": -110.9747},
    {"city": "Phoenix",      "state": "AZ", "lat": 33.4484, "lng": -112.0740},
    {"city": "Tampa",        "state": "FL", "lat": 27.9506, "lng": -82.4572},
    {"city": "Newark",       "state": "NJ", "lat": 40.7357, "lng": -74.1724},
    {"city": "Richmond",     "state": "VA", "lat": 37.5407, "lng": -77.4360},
    {"city": "Buffalo",      "state": "NY", "lat": 42.8864, "lng": -78.8784},
    {"city": "Nashville",    "state": "TN", "lat": 36.1627, "lng": -86.7816},
    {"city": "Minneapolis",  "state": "MN", "lat": 44.9778, "lng": -93.2650},
    {"city": "Albuquerque",  "state": "NM", "lat": 35.0844, "lng": -106.6504},
    {"city": "Houston",      "state": "TX", "lat": 29.7604, "lng": -95.3698},
    {"city": "Dallas",       "state": "TX", "lat": 32.7767, "lng": -96.7970},
    {"city": "San Antonio",  "state": "TX", "lat": 29.4241, "lng": -98.4936},
    {"city": "Austin",       "state": "TX", "lat": 30.2672, "lng": -97.7431},
    {"city": "Fort Worth",   "state": "TX", "lat": 32.7555, "lng": -97.3308},
    {"city": "El Paso",      "state": "TX", "lat": 31.7619, "lng": -106.4850},
    {"city": "Arlington",    "state": "TX", "lat": 32.7357, "lng": -97.1081},
    {"city": "San Diego",    "state": "CA", "lat": 32.7157, "lng": -117.1611},
    {"city": "San Jose",     "state": "CA", "lat": 37.3382, "lng": -121.8863},
    {"city": "Long Beach",   "state": "CA", "lat": 33.7701, "lng": -118.1937},
    {"city": "Oakland",      "state": "CA", "lat": 37.8044, "lng": -122.2712},
    {"city": "Sacramento",   "state": "CA", "lat": 38.5816, "lng": -121.4944},
    {"city": "Fresno",       "state": "CA", "lat": 36.7378, "lng": -119.7871},
    {"city": "Bakersfield",  "state": "CA", "lat": 35.3733, "lng": -119.0187},
    {"city": "Anaheim",      "state": "CA", "lat": 33.8366, "lng": -117.9143},
    {"city": "Riverside",    "state": "CA", "lat": 33.9533, "lng": -117.3962},
    {"city": "Indianapolis", "state": "IN", "lat": 39.7684, "lng": -86.1581},
    {"city": "Columbus",     "state": "OH", "lat": 39.9612, "lng": -82.9988},
    {"city": "Charlotte",    "state": "NC", "lat": 35.2271, "lng": -80.8431},
    {"city": "Jacksonville", "state": "FL", "lat": 30.3322, "lng": -81.6557},
    {"city": "Miami",        "state": "FL", "lat": 25.7617, "lng": -80.1918},
    {"city": "Orlando",      "state": "FL", "lat": 28.5383, "lng": -81.3792},
    {"city": "Fort Lauderdale","state":"FL","lat": 26.1224, "lng": -80.1373},
    {"city": "St. Petersburg","state": "FL","lat": 27.7676, "lng": -82.6403},
    {"city": "Memphis",      "state": "TN", "lat": 35.1495, "lng": -90.0490},
    {"city": "Knoxville",    "state": "TN", "lat": 35.9606, "lng": -83.9207},
    {"city": "Oklahoma City","state": "OK", "lat": 35.4676, "lng": -97.5164},
    {"city": "Tulsa",        "state": "OK", "lat": 36.1540, "lng": -95.9928},
    {"city": "Kansas City",  "state": "MO", "lat": 39.0997, "lng": -94.5786},
    {"city": "Kansas City",  "state": "KS", "lat": 39.1142, "lng": -94.6275},
    {"city": "Wichita",      "state": "KS", "lat": 37.6872, "lng": -97.3301},
    {"city": "Birmingham",   "state": "AL", "lat": 33.5186, "lng": -86.8104},
    {"city": "Mobile",       "state": "AL", "lat": 30.6954, "lng": -88.0399},
    {"city": "Montgomery",   "state": "AL", "lat": 32.3792, "lng": -86.3077},
    {"city": "Jackson",      "state": "MS", "lat": 32.2988, "lng": -90.1848},
    {"city": "Little Rock",  "state": "AR", "lat": 34.7465, "lng": -92.2896},
    {"city": "Baton Rouge",  "state": "LA", "lat": 30.4515, "lng": -91.1871},
    {"city": "Shreveport",   "state": "LA", "lat": 32.5252, "lng": -93.7502},
    {"city": "Boise",        "state": "ID", "lat": 43.6150, "lng": -116.2023},
    {"city": "Reno",         "state": "NV", "lat": 39.5296, "lng": -119.8138},
    {"city": "Anchorage",    "state": "AK", "lat": 61.2181, "lng": -149.9003},
    {"city": "Wilmington",   "state": "DE", "lat": 39.7391, "lng": -75.5398},
    {"city": "Wheeling",     "state": "WV", "lat": 40.0640, "lng": -80.7209},
    {"city": "Troy",         "state": "NY", "lat": 42.7284, "lng": -73.6918},
    {"city": "Rochester",    "state": "NY", "lat": 43.1566, "lng": -77.6088},
    {"city": "Syracuse",     "state": "NY", "lat": 43.0481, "lng": -76.1474},
    {"city": "Yonkers",      "state": "NY", "lat": 40.9312, "lng": -73.8987},
    {"city": "Jersey City",  "state": "NJ", "lat": 40.7178, "lng": -74.0431},
    {"city": "Toledo",       "state": "OH", "lat": 41.6528, "lng": -83.5379},
    {"city": "Akron",        "state": "OH", "lat": 41.0814, "lng": -81.5190},
    {"city": "Dayton",       "state": "OH", "lat": 39.7589, "lng": -84.1916},
    {"city": "Madison",      "state": "WI", "lat": 43.0731, "lng": -89.4012},
    {"city": "Des Moines",   "state": "IA", "lat": 41.5868, "lng": -93.6250},
    {"city": "Sioux City",   "state": "IA", "lat": 42.4995, "lng": -96.4003},
    {"city": "Lincoln",      "state": "NE", "lat": 40.8136, "lng": -96.7026},
    {"city": "Worcester",    "state": "MA", "lat": 42.2626, "lng": -71.8023},
    {"city": "Springfield",  "state": "MA", "lat": 42.1015, "lng": -72.5898},
    {"city": "Hartford",     "state": "CT", "lat": 41.7658, "lng": -72.6734},
    {"city": "New Haven",    "state": "CT", "lat": 41.3083, "lng": -72.9279},
    {"city": "Spokane",      "state": "WA", "lat": 47.6588, "lng": -117.4260},
    {"city": "Tacoma",       "state": "WA", "lat": 47.2529, "lng": -122.4443},
    {"city": "Eugene",       "state": "OR", "lat": 44.0521, "lng": -123.0868},
    {"city": "Colorado Springs","state":"CO","lat": 38.8339, "lng": -104.8214},
    {"city": "Tallahassee",  "state": "FL", "lat": 30.4383, "lng": -84.2807},
    {"city": "Norfolk",      "state": "VA", "lat": 36.8508, "lng": -76.2859},
    {"city": "Virginia Beach","state":"VA", "lat": 36.8529, "lng": -75.9780},
    {"city": "Raleigh",      "state": "NC", "lat": 35.7796, "lng": -78.6382},
    {"city": "Greensboro",   "state": "NC", "lat": 36.0726, "lng": -79.7920},
    {"city": "Durham",       "state": "NC", "lat": 35.9940, "lng": -78.8986},
    {"city": "Charleston",   "state": "SC", "lat": 32.7765, "lng": -79.9311},
    {"city": "Columbia",     "state": "SC", "lat": 34.0007, "lng": -81.0348},
    {"city": "Savannah",     "state": "GA", "lat": 32.0809, "lng": -81.0912},
    {"city": "Augusta",      "state": "GA", "lat": 33.4735, "lng": -82.0105},
    {"city": "Lexington",    "state": "KY", "lat": 38.0406, "lng": -84.5037},
]

# ---------------------------------------------------------------------------
# MLB franchise locations — coords are stadium centroids for the current
# home park. franchID matches Lahman teams.json.
# ---------------------------------------------------------------------------

TEAM_LOCATIONS: list[dict] = [
    {"franchID": "ANA", "name": "Los Angeles Angels", "city": "Anaheim",      "state": "CA", "lat": 33.8003, "lng": -117.8827},
    {"franchID": "ARI", "name": "Arizona Diamondbacks","city": "Phoenix",      "state": "AZ", "lat": 33.4453, "lng": -112.0667},
    {"franchID": "ATL", "name": "Atlanta Braves",     "city": "Atlanta",       "state": "GA", "lat": 33.8907, "lng": -84.4677},
    {"franchID": "BAL", "name": "Baltimore Orioles",  "city": "Baltimore",     "state": "MD", "lat": 39.2839, "lng": -76.6217},
    {"franchID": "BOS", "name": "Boston Red Sox",     "city": "Boston",        "state": "MA", "lat": 42.3467, "lng": -71.0972},
    {"franchID": "CHC", "name": "Chicago Cubs",       "city": "Chicago",       "state": "IL", "lat": 41.9484, "lng": -87.6553},
    {"franchID": "CHW", "name": "Chicago White Sox",  "city": "Chicago",       "state": "IL", "lat": 41.8300, "lng": -87.6339},
    {"franchID": "CIN", "name": "Cincinnati Reds",    "city": "Cincinnati",    "state": "OH", "lat": 39.0975, "lng": -84.5069},
    {"franchID": "CLE", "name": "Cleveland Guardians","city": "Cleveland",     "state": "OH", "lat": 41.4962, "lng": -81.6852},
    {"franchID": "COL", "name": "Colorado Rockies",   "city": "Denver",        "state": "CO", "lat": 39.7559, "lng": -104.9942},
    {"franchID": "DET", "name": "Detroit Tigers",     "city": "Detroit",       "state": "MI", "lat": 42.3390, "lng": -83.0485},
    {"franchID": "FLA", "name": "Miami Marlins",      "city": "Miami",         "state": "FL", "lat": 25.7781, "lng": -80.2197},
    {"franchID": "HOU", "name": "Houston Astros",     "city": "Houston",       "state": "TX", "lat": 29.7572, "lng": -95.3553},
    {"franchID": "KCR", "name": "Kansas City Royals", "city": "Kansas City",   "state": "MO", "lat": 39.0517, "lng": -94.4803},
    {"franchID": "LAD", "name": "Los Angeles Dodgers","city": "Los Angeles",   "state": "CA", "lat": 34.0739, "lng": -118.2400},
    {"franchID": "MIL", "name": "Milwaukee Brewers",  "city": "Milwaukee",     "state": "WI", "lat": 43.0280, "lng": -87.9712},
    {"franchID": "MIN", "name": "Minnesota Twins",    "city": "Minneapolis",   "state": "MN", "lat": 44.9818, "lng": -93.2778},
    {"franchID": "NYM", "name": "New York Mets",      "city": "Queens",        "state": "NY", "lat": 40.7571, "lng": -73.8458},
    {"franchID": "NYY", "name": "New York Yankees",   "city": "Bronx",         "state": "NY", "lat": 40.8296, "lng": -73.9262},
    {"franchID": "OAK", "name": "Oakland Athletics",  "city": "Oakland",       "state": "CA", "lat": 37.7516, "lng": -122.2008},
    {"franchID": "PHI", "name": "Philadelphia Phillies","city":"Philadelphia", "state": "PA", "lat": 39.9061, "lng": -75.1665},
    {"franchID": "PIT", "name": "Pittsburgh Pirates", "city": "Pittsburgh",    "state": "PA", "lat": 40.4469, "lng": -80.0058},
    {"franchID": "SDP", "name": "San Diego Padres",   "city": "San Diego",     "state": "CA", "lat": 32.7073, "lng": -117.1566},
    {"franchID": "SEA", "name": "Seattle Mariners",   "city": "Seattle",       "state": "WA", "lat": 47.5914, "lng": -122.3325},
    {"franchID": "SFG", "name": "San Francisco Giants","city":"San Francisco", "state": "CA", "lat": 37.7786, "lng": -122.3893},
    {"franchID": "STL", "name": "St. Louis Cardinals","city": "St. Louis",     "state": "MO", "lat": 38.6226, "lng": -90.1928},
    {"franchID": "TBD", "name": "Tampa Bay Rays",     "city": "St. Petersburg","state": "FL", "lat": 27.7682, "lng": -82.6534},
    {"franchID": "TEX", "name": "Texas Rangers",      "city": "Arlington",     "state": "TX", "lat": 32.7473, "lng": -97.0945},
    {"franchID": "TOR", "name": "Toronto Blue Jays",  "city": "Toronto",       "state": "ON", "lat": 43.6414, "lng": -79.3894},
    {"franchID": "WSN", "name": "Washington Nationals","city":"Washington",    "state": "DC", "lat": 38.8730, "lng": -77.0074},
]


def load_gazetteer() -> dict[tuple[str, str], tuple[float, float]]:
    """Load coords from data-raw/cities1000.txt (geonames format) if present.

    Geonames cities1000 is tab-delimited; relevant columns are:
      [1]  name
      [4]  lat
      [5]  lng
      [10] admin1_code (state postal code for US)
      [8]  country_code

    Returns {(city_lower, state_upper): (lat, lng)}.
    """
    out: dict[tuple[str, str], tuple[float, float]] = {}
    if not GAZ_FILE.exists():
        return out
    with GAZ_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 11 or row[8] != "US":
                continue
            name = row[1].strip()
            state = row[10].strip().upper()
            try:
                lat = float(row[4]); lng = float(row[5])
            except ValueError:
                continue
            out[(name.lower(), state)] = (lat, lng)
    return out


def merge_with_gazetteer(hand: list[dict], gaz: dict) -> list[dict]:
    """For every player birth city in src/data/players.json, if we have a
    gazetteer coord and no hand-baked coord, add it."""
    if not gaz:
        return hand
    players = json.load(open(DATA_DIR / "players.json"))
    have = {(c["city"].lower(), c["state"]) for c in hand}
    added: list[dict] = []
    for p in players.values():
        city = (p.get("birthCity") or "").strip()
        state = (p.get("birthState") or "").strip()
        if not city or not state:
            continue
        key = (city.lower(), state)
        if key in have or key not in gaz:
            continue
        lat, lng = gaz[key]
        added.append({"city": city, "state": state, "lat": lat, "lng": lng})
        have.add(key)
    return hand + added


def main() -> None:
    gaz = load_gazetteer()
    cities = merge_with_gazetteer(HAND_CITIES, gaz)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "cities.json").write_text(json.dumps(cities, indent=2) + "\n")
    (DATA_DIR / "team_locations.json").write_text(json.dumps(TEAM_LOCATIONS, indent=2) + "\n")
    print(f"wrote {len(cities)} cities (hand={len(HAND_CITIES)}, gazetteer={len(cities) - len(HAND_CITIES)})")
    print(f"wrote {len(TEAM_LOCATIONS)} franchise locations")


if __name__ == "__main__":
    sys.exit(main())
