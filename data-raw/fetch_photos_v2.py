#!/usr/bin/env python3
"""
Photo fetch v2 — focused on the players actually displayed in reports.

Changes from v1:
  - Smaller target set: top 10 per franchise + top 10 per state + all HOFers
    actually serialized + top players in each leaderboard. Total ~1500 vs 4000.
  - Base name FIRST in candidate order (most famous players match this).
  - Retry misses if cache already has empty entry (v1 locked them in).
  - Sequential w/ 0.12s sleep — under the rate limit, ~8 req/sec.
  - Save cache every 25.
"""
from __future__ import annotations
import json, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "src" / "data"
CACHE_PATH = HERE / "photos_cache.json"
UA = "the-scout-room/0.2 (+https://github.com/fivetran-jasonchletsos/the-scout-room)"

print("Loading lookups...")
players      = json.loads((DATA / "players.json").read_text())
team_alumni  = json.loads((DATA / "team_alumni.json").read_text())
state_alumni = json.loads((DATA / "players_by_state.json").read_text())
hof          = json.loads((DATA / "hof.json").read_text())
leaders      = json.loads((DATA / "leaders.json").read_text())

# Tighter target set — only what'd show in a report
targets: set[str] = set()
for lst in team_alumni.values():  targets.update(lst[:10])
for lst in state_alumni.values(): targets.update(lst[:10])
for lst in leaders.values():      targets.update(lst[:15])
targets.update(hof[:100])  # top-100 HOFers by career value
targets = {pid for pid in targets if pid in players}
print(f"  target set: {len(targets)} players")

cache: dict[str, dict] = {}
if CACHE_PATH.exists():
    cache = json.loads(CACHE_PATH.read_text())

def wiki(title: str) -> dict | None:
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Api-User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            if r.status != 200: return None
            return json.loads(r.read())
    except Exception:
        return None

def try_candidates(p: dict) -> dict | None:
    first, last = p["firstName"], p["lastName"]
    if not first or not last: return None
    full = f"{first} {last}".strip()
    titles = [full, f"{full} (baseball)"]
    if p.get("birthYear"):
        titles.append(f"{full} (born {p['birthYear']})")
    for t in titles:
        d = wiki(t)
        time.sleep(0.12)
        if not d or d.get("type") != "standard": continue
        thumb = d.get("thumbnail", {})
        if thumb.get("source") and thumb.get("width", 0) >= 100:
            return {
                "image": thumb["source"],
                "page":  d.get("content_urls", {}).get("desktop", {}).get("page"),
                "title": d.get("title"),
            }
    return None

# Targets to actually hit: target set, MINUS already-hit ones in cache
to_hit = []
for pid in sorted(targets):
    info = cache.get(pid)
    if info and info.get("image"): continue   # already have an image
    to_hit.append(pid)
print(f"  to fetch: {len(to_hit)} (skipping {len(targets) - len(to_hit)} already-cached hits)")

hits = 0
for i, pid in enumerate(to_hit):
    p = players.get(pid)
    if not p: continue
    info = try_candidates(p)
    if info:
        cache[pid] = info
        hits += 1
        print(f"  [{i+1:4d}/{len(to_hit)}] {pid:<12} HIT  {info['title']:.<50}")
    else:
        cache[pid] = {}
        if (i+1) % 20 == 0:
            print(f"  [{i+1:4d}/{len(to_hit)}] {pid:<12} miss")
    if (i+1) % 25 == 0:
        CACHE_PATH.write_text(json.dumps(cache, separators=(",", ":")))

CACHE_PATH.write_text(json.dumps(cache, separators=(",", ":")))
print(f"\nNew hits: {hits}")

# Merge wiki_image into players.json
merged = 0
for pid, info in cache.items():
    if info.get("image") and pid in players:
        players[pid]["wiki_image"] = info["image"]
        players[pid]["wiki_title"] = info.get("title")
        merged += 1

(DATA / "players.json").write_text(json.dumps(players, separators=(",", ":")))
size_mb = (DATA / "players.json").stat().st_size / (1024*1024)
print(f"  merged {merged} photos · players.json {size_mb:.2f} MB")
