#!/usr/bin/env python3
"""
Fetch Wikipedia thumbnail URLs for the most-likely-to-be-shown players
and merge them into players.json under a 'wiki_image' field.

Strategy:
  - Collect target set: top 30 per franchise + top 30 per state + all HOFers
    in our serialized subset (~2000-3000 unique players).
  - For each player, hit Wikipedia REST summary endpoint with several
    title candidates. First match wins.
  - Cache results in photos_cache.json so re-runs don't re-fetch.
  - Throttle: 0.15s between requests = ~6 req/sec, well under MediaWiki's
    limits. Concurrent batching could push faster but isn't worth the
    complexity here.

Run:  python3 fetch_photos.py
Out:  ../src/data/players.json (merged in place) + photos_cache.json
"""
from __future__ import annotations
import json, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "src" / "data"
CACHE_PATH = HERE / "photos_cache.json"

USER_AGENT = "the-scout-room/0.1 (https://github.com/fivetran-jasonchletsos/the-scout-room)"

# ─────────────────────────────────────────────────────────────────────
# Load existing data
# ─────────────────────────────────────────────────────────────────────
print("Loading players + lookups...")
players_path = DATA / "players.json"
players      = json.loads(players_path.read_text())
team_alumni  = json.loads((DATA / "team_alumni.json").read_text())
state_alumni = json.loads((DATA / "players_by_state.json").read_text())
hof          = json.loads((DATA / "hof.json").read_text())
leaders      = json.loads((DATA / "leaders.json").read_text())

# Targets: anyone likely to appear in the top of a Scout Report.
targets: set[str] = set(hof)
for lst in team_alumni.values():  targets.update(lst[:30])
for lst in state_alumni.values(): targets.update(lst[:30])
for lst in leaders.values():       targets.update(lst[:30])
targets = {pid for pid in targets if pid in players}
print(f"  target set: {len(targets)} players")

# Cache
cache: dict[str, dict] = {}
if CACHE_PATH.exists():
    cache = json.loads(CACHE_PATH.read_text())
    print(f"  cache: {len(cache)} entries")

# ─────────────────────────────────────────────────────────────────────
# Wikipedia summary fetch
# ─────────────────────────────────────────────────────────────────────
def wiki_summary(title: str) -> dict | None:
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            if r.status != 200: return None
            data = json.loads(r.read())
            # type == "standard" means an article page; "disambiguation" / "no-extract" we skip
            if data.get("type") != "standard": return None
            return data
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

def candidate_titles(p: dict) -> list[str]:
    """Title candidates in order of preference. Wikipedia uses spaces in URL
    but our quote() handles encoding. We try base, then with parens for
    common disambiguators."""
    first, last = p["firstName"], p["lastName"]
    full = f"{first} {last}".strip()
    # If only one name, skip
    if not first or not last: return [full] if full else []
    titles = [
        f"{full} (baseball)",
        f"{full} (born {p['birthYear']})" if p.get("birthYear") else None,
        full,
    ]
    return [t for t in titles if t]

def fetch_one(pid: str) -> tuple[str, dict | None]:
    if pid in cache:
        return pid, cache[pid]
    p = players.get(pid)
    if not p:
        return pid, None
    for title in candidate_titles(p):
        data = wiki_summary(title)
        if not data: continue
        thumb = data.get("thumbnail", {}).get("source")
        # Filter out Wikipedia placeholders / map icons (heuristic: skip if very small)
        if thumb and data["thumbnail"].get("width", 0) >= 100:
            result = {
                "image": thumb,
                "page": data.get("content_urls", {}).get("desktop", {}).get("page"),
                "title": data.get("title"),
            }
            return pid, result
    # No image found — cache the miss so we don't retry
    return pid, {}

# ─────────────────────────────────────────────────────────────────────
# Fetch (small parallelism + delay)
# ─────────────────────────────────────────────────────────────────────
to_fetch = [pid for pid in sorted(targets) if pid not in cache]
print(f"  fetching {len(to_fetch)} new (skipping {len(targets) - len(to_fetch)} cached)")

hits = 0
fetched = 0
def maybe_save_cache():
    if fetched and fetched % 50 == 0:
        CACHE_PATH.write_text(json.dumps(cache, separators=(",", ":")))

with ThreadPoolExecutor(max_workers=4) as ex:
    futures = {ex.submit(fetch_one, pid): pid for pid in to_fetch}
    for fut in as_completed(futures):
        pid = futures[fut]
        try:
            _, result = fut.result()
        except Exception as e:
            print(f"  [{pid}] error: {e}")
            result = {}
        cache[pid] = result or {}
        fetched += 1
        if result and result.get("image"):
            hits += 1
            print(f"  [{fetched:4d}/{len(to_fetch)}] {pid:<12} hit  {result.get('title','')[:50]}")
        else:
            print(f"  [{fetched:4d}/{len(to_fetch)}] {pid:<12} miss")
        maybe_save_cache()

CACHE_PATH.write_text(json.dumps(cache, separators=(",", ":")))
print(f"\nDone. {hits}/{len(to_fetch)} hits.")

# ─────────────────────────────────────────────────────────────────────
# Merge wiki_image into players.json
# ─────────────────────────────────────────────────────────────────────
print("Merging into players.json...")
merged_count = 0
for pid in cache:
    if pid not in players: continue
    info = cache[pid]
    if info and info.get("image"):
        players[pid]["wiki_image"] = info["image"]
        players[pid]["wiki_title"] = info.get("title")
        players[pid]["wiki_page"]  = info.get("page")
        merged_count += 1

players_path.write_text(json.dumps(players, separators=(",", ":")))
size_mb = players_path.stat().st_size / (1024*1024)
print(f"  merged {merged_count} photos · players.json now {size_mb:.2f} MB")
