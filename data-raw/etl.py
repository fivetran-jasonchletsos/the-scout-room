#!/usr/bin/env python3
"""
ETL: Lahman CSV → compact JSON for the Scout Room static viewer.

Output files (written to ../src/data/):
  - players.json            : core player meta + career value score + team affiliations
  - players_by_state.json   : { state -> [playerID, ...] sorted by career value desc }
  - teams.json              : franchise summary + championships
  - team_alumni.json        : { franchID -> [{playerID, primaryPos, careerValue, peakYearStart, peakYearEnd}] }
  - hof.json                : Hall of Fame inductees
  - awards.json             : major awards (MVP, Cy Young, Rookie, Gold Glove, Silver Slugger)
  - archetypes.json         : per-franchise position-archetype histograms
  - leaders.json            : all-time leaderboards by stat
  - meta.json               : counts + freshness

Career value (proxy for WAR — Lahman doesn't include WAR):
  Hitters:   HR*1.0 + RBI*0.3 + H*0.05 + SB*0.3 + BB*0.05
             + AllStarSelections*25 + HOF_bonus + AwardsBonus
  Pitchers:  W*2.0 + SO*0.05 + IP*0.10
             - L*1.0 - (ERA*5)   [ERA only counted if >=300 IP]
             + AllStarSelections*25 + HOF_bonus + AwardsBonus
"""
from __future__ import annotations
import csv, json, os, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "baseballdatabank-master" / "core"
OUT  = Path(__file__).resolve().parent.parent / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)

def read_csv(name):
    with open(ROOT / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def num(v, kind=int, default=0):
    if v in ("", None): return default
    try: return kind(v)
    except: return default

print("Loading raw CSVs...")
people     = read_csv("People.csv")
batting    = read_csv("Batting.csv")
pitching   = read_csv("Pitching.csv")
teams      = read_csv("Teams.csv")
franchises = read_csv("TeamsFranchises.csv")
hof        = read_csv("HallOfFame.csv")
awards     = read_csv("AwardsPlayers.csv")
allstars   = read_csv("AllstarFull.csv")
appearances= read_csv("Appearances.csv")
print(f"  people={len(people)} batting={len(batting)} pitching={len(pitching)} teams={len(teams)}")

# ───────────────────────────────────────────────────────────────────
# 1) Players base
# ───────────────────────────────────────────────────────────────────
players = {}
for p in people:
    pid = p["playerID"]
    debut = p["debut"][:4] if p["debut"] else ""
    final = p["finalGame"][:4] if p["finalGame"] else ""
    players[pid] = {
        "id": pid,
        "firstName": p["nameFirst"],
        "lastName":  p["nameLast"],
        "fullName":  f"{p['nameFirst']} {p['nameLast']}".strip(),
        "birthYear": num(p["birthYear"]),
        "birthState": p["birthState"] or None,
        "birthCity":  p["birthCity"] or None,
        "birthCountry": p["birthCountry"] or None,
        "deathYear": num(p["deathYear"]) or None,
        "debutYear": num(debut),
        "finalYear": num(final),
        "bats":      p["bats"] or None,
        "throws":    p["throws"] or None,
        "height":    num(p["height"]),
        "weight":    num(p["weight"]),
        "bbrefID":   p["bbrefID"] or None,
        # filled in below
        "primaryPos": None,
        "battingTotals": {"G":0,"AB":0,"R":0,"H":0,"HR":0,"RBI":0,"SB":0,"BB":0,"SO":0,"2B":0,"3B":0},
        "pitchingTotals": {"G":0,"GS":0,"W":0,"L":0,"SV":0,"IPouts":0,"H":0,"ER":0,"HR":0,"BB":0,"SO":0},
        "teamsPlayed": set(),
        "allStarSelections": 0,
        "majorAwards": [],   # list of [awardID, yearID]
        "hof": False,
        "hofYear": None,
        "careerValue": 0.0,
    }

# ───────────────────────────────────────────────────────────────────
# 2) Career batting + pitching totals
# ───────────────────────────────────────────────────────────────────
print("Rolling up batting totals...")
for r in batting:
    pid = r["playerID"]
    if pid not in players: continue
    bt = players[pid]["battingTotals"]
    for k in ("G","AB","R","H","HR","RBI","SB","BB","SO","2B","3B"):
        bt[k] += num(r[k])
    if r["teamID"]:
        players[pid]["teamsPlayed"].add(r["teamID"])

print("Rolling up pitching totals...")
for r in pitching:
    pid = r["playerID"]
    if pid not in players: continue
    pt = players[pid]["pitchingTotals"]
    for k in ("G","GS","W","L","SV","IPouts","H","ER","HR","BB","SO"):
        pt[k] += num(r[k])
    if r["teamID"]:
        players[pid]["teamsPlayed"].add(r["teamID"])

# ───────────────────────────────────────────────────────────────────
# 3) All-star selections
# ───────────────────────────────────────────────────────────────────
print("All-star selections...")
for r in allstars:
    pid = r["playerID"]
    if pid in players:
        players[pid]["allStarSelections"] += 1

# ───────────────────────────────────────────────────────────────────
# 4) Hall of fame inductions (Player category only)
# ───────────────────────────────────────────────────────────────────
print("Hall of Fame...")
for r in hof:
    if r["inducted"] == "Y" and r["category"] == "Player":
        pid = r["playerID"]
        if pid in players:
            players[pid]["hof"] = True
            players[pid]["hofYear"] = num(r["yearID"]) or None

# ───────────────────────────────────────────────────────────────────
# 5) Major awards
# ───────────────────────────────────────────────────────────────────
MAJOR_AWARDS = {
    "Most Valuable Player",
    "Cy Young Award",
    "Rookie of the Year",
    "Gold Glove",
    "Silver Slugger",
    "World Series MVP",
    "Triple Crown",
    "Pitching Triple Crown",
}
print("Major awards...")
for r in awards:
    if r["awardID"] in MAJOR_AWARDS:
        pid = r["playerID"]
        if pid in players:
            players[pid]["majorAwards"].append([r["awardID"], num(r["yearID"])])

# ───────────────────────────────────────────────────────────────────
# 6) Primary position via Appearances totals
# ───────────────────────────────────────────────────────────────────
print("Primary positions from Appearances...")
pos_cols = ["G_p","G_c","G_1b","G_2b","G_3b","G_ss","G_lf","G_cf","G_rf","G_dh"]
pos_label = {
    "G_p":"P","G_c":"C","G_1b":"1B","G_2b":"2B","G_3b":"3B",
    "G_ss":"SS","G_lf":"LF","G_cf":"CF","G_rf":"RF","G_dh":"DH",
}
pos_acc = defaultdict(lambda: defaultdict(int))
for r in appearances:
    pid = r["playerID"]
    if pid not in players: continue
    for c in pos_cols:
        pos_acc[pid][c] += num(r[c])

for pid, counts in pos_acc.items():
    if not counts: continue
    best = max(counts.items(), key=lambda kv: kv[1])
    if best[1] > 0:
        players[pid]["primaryPos"] = pos_label[best[0]]

# ───────────────────────────────────────────────────────────────────
# 7) Career value score
# ───────────────────────────────────────────────────────────────────
def career_value(p):
    bt, pt = p["battingTotals"], p["pitchingTotals"]
    hit = (
        bt["HR"]  * 1.0  +
        bt["RBI"] * 0.30 +
        bt["H"]   * 0.05 +
        bt["SB"]  * 0.30 +
        bt["BB"]  * 0.05
    )
    ip = pt["IPouts"] / 3.0 if pt["IPouts"] else 0.0
    era = (pt["ER"] / max(ip,1)) * 9.0 if ip >= 300 else 4.5  # neutral if not enough innings
    pit = (
        pt["W"]   * 2.0  +
        pt["SO"]  * 0.05 +
        ip        * 0.10 -
        pt["L"]   * 1.0  -
        era       * 5.0
    )
    score = max(hit, 0) + max(pit, 0)
    score += p["allStarSelections"] * 25
    if p["hof"]: score += 500
    score += len(p["majorAwards"]) * 15
    return round(score, 1)

print("Career values...")
for p in players.values():
    p["careerValue"] = career_value(p)

# Drop players with no MLB activity (zero totals AND no debut year)
def is_real(p):
    bt, pt = p["battingTotals"], p["pitchingTotals"]
    return p["debutYear"] > 0 and (bt["G"] + pt["G"]) > 0

filtered_players = {pid: p for pid, p in players.items() if is_real(p)}
print(f"  kept {len(filtered_players)} of {len(players)} players")

# Convert teamsPlayed to list
for p in filtered_players.values():
    p["teamsPlayed"] = sorted(p["teamsPlayed"])

# ───────────────────────────────────────────────────────────────────
# 8) Teams + franchises
# ───────────────────────────────────────────────────────────────────
print("Teams + franchises...")
franchise_meta = {f["franchID"]: f for f in franchises}
# teamID -> franchID map
team_to_franch = {}
franch_to_teams = defaultdict(set)
ws_wins = defaultdict(int)
ws_app  = defaultdict(int)
years   = defaultdict(lambda: [9999, 0])
for r in teams:
    fid = r["franchID"]
    tid = r["teamID"]
    yr  = num(r["yearID"])
    team_to_franch[tid] = fid
    franch_to_teams[fid].add(tid)
    if r["WSWin"]  == "Y": ws_wins[fid] += 1
    if r["LgWin"]  == "Y": ws_app[fid]  += 1
    if yr:
        years[fid][0] = min(years[fid][0], yr)
        years[fid][1] = max(years[fid][1], yr)

# Player → franchises played for
player_franchs = defaultdict(set)
for pid, p in filtered_players.items():
    for tid in p["teamsPlayed"]:
        if tid in team_to_franch:
            player_franchs[pid].add(team_to_franch[tid])
# replace teamsPlayed with franchise list for portability
for pid, p in filtered_players.items():
    p["franchs"] = sorted(player_franchs[pid])
    del p["teamsPlayed"]

teams_out = []
for fid, meta in franchise_meta.items():
    if meta["active"] != "Y": continue
    teams_out.append({
        "franchID": fid,
        "name": meta["franchName"],
        "yearFirst": years[fid][0] if years[fid][0] != 9999 else None,
        "yearLast":  years[fid][1] or None,
        "wsTitles":  ws_wins.get(fid, 0),
        "leaguePennants": ws_app.get(fid, 0),
        "teamIDs": sorted(franch_to_teams[fid]),
    })
teams_out.sort(key=lambda t: t["name"])
print(f"  active franchises: {len(teams_out)}")

# ───────────────────────────────────────────────────────────────────
# 9) Team alumni (top N per franchise by career value)
# ───────────────────────────────────────────────────────────────────
print("Team alumni rankings...")
alumni = defaultdict(list)
for pid, p in filtered_players.items():
    for fid in p["franchs"]:
        alumni[fid].append((p["careerValue"], pid))
team_alumni = {}
for fid, lst in alumni.items():
    lst.sort(reverse=True)
    team_alumni[fid] = [pid for _, pid in lst[:50]]

# ───────────────────────────────────────────────────────────────────
# 10) Players by state
# ───────────────────────────────────────────────────────────────────
print("Players by state...")
by_state = defaultdict(list)
for pid, p in filtered_players.items():
    if p["birthState"]:
        by_state[p["birthState"]].append((p["careerValue"], pid))
players_by_state = {}
for st, lst in by_state.items():
    lst.sort(reverse=True)
    players_by_state[st] = [pid for _, pid in lst[:60]]

# ───────────────────────────────────────────────────────────────────
# 11) Archetype histogram per franchise (position counts of top-100 alumni)
# ───────────────────────────────────────────────────────────────────
print("Archetypes...")
archetypes = {}
for fid, top_pids in team_alumni.items():
    counts = defaultdict(int)
    examples = defaultdict(list)
    for pid in top_pids[:30]:
        p = filtered_players[pid]
        pos = p["primaryPos"] or "—"
        counts[pos] += 1
        if len(examples[pos]) < 3:
            examples[pos].append(pid)
    archetypes[fid] = {pos: {"count": c, "examples": examples[pos]} for pos, c in counts.items()}

# ───────────────────────────────────────────────────────────────────
# 12) All-time leaders (small leaderboard sets)
# ───────────────────────────────────────────────────────────────────
print("Leaderboards...")
def topn(stat_getter, n=25):
    lst = [(stat_getter(p), pid) for pid, p in filtered_players.items()]
    lst.sort(reverse=True)
    return [pid for _, pid in lst[:n]]
leaders = {
    "HR":      topn(lambda p: p["battingTotals"]["HR"]),
    "H":       topn(lambda p: p["battingTotals"]["H"]),
    "RBI":     topn(lambda p: p["battingTotals"]["RBI"]),
    "SB":      topn(lambda p: p["battingTotals"]["SB"]),
    "W":       topn(lambda p: p["pitchingTotals"]["W"]),
    "SO_pitch":topn(lambda p: p["pitchingTotals"]["SO"]),
    "SV":      topn(lambda p: p["pitchingTotals"]["SV"]),
    "careerValue": topn(lambda p: p["careerValue"], n=50),
}

# ───────────────────────────────────────────────────────────────────
# 13) HOF subset (richer)
# ───────────────────────────────────────────────────────────────────
hof_out = [pid for pid, p in filtered_players.items() if p["hof"]]
hof_out.sort(key=lambda pid: filtered_players[pid]["careerValue"], reverse=True)

# ───────────────────────────────────────────────────────────────────
# 14) Write outputs
# ───────────────────────────────────────────────────────────────────
def write_json(name, data):
    path = OUT / name
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = path.stat().st_size
    print(f"  wrote {name:<30} {size/1024:.1f} KB")

print("Writing outputs...")

# Restrict the serialized player set to the union of players referenced by
# any of the lookups — keeps payload small without losing the demo data.
relevant: set[str] = set()
for lst in team_alumni.values(): relevant.update(lst)
for lst in players_by_state.values(): relevant.update(lst)
for lst in leaders.values(): relevant.update(lst)
relevant.update(hof_out)
for arch in archetypes.values():
    for slot in arch.values():
        relevant.update(slot["examples"])
print(f"  serializing {len(relevant)} relevant players (of {len(filtered_players)})")

# Drop the heavy unused-stat block per primaryPos to shrink payload further.
def slim_player(p):
    out = dict(p)
    is_pitcher = (p["primaryPos"] == "P")
    if is_pitcher:
        # Pitchers' minimal batting (we still want HRs etc. in case someone like Ohtani)
        bt = p["battingTotals"]
        out["battingTotals"] = {"G": bt["G"], "AB": bt["AB"], "H": bt["H"], "HR": bt["HR"]}
    else:
        # Position players: keep batting, slim pitching
        pt = p["pitchingTotals"]
        out["pitchingTotals"] = {"G": pt["G"], "W": pt["W"], "SO": pt["SO"]} if pt["G"] else None
    return out

players_slim = {pid: slim_player(filtered_players[pid]) for pid in relevant}
write_json("players.json", players_slim)
write_json("teams.json", teams_out)
write_json("team_alumni.json", team_alumni)
write_json("players_by_state.json", players_by_state)
write_json("archetypes.json", archetypes)
write_json("leaders.json", leaders)
write_json("hof.json", hof_out)
write_json("meta.json", {
    "playerCount": len(filtered_players),
    "teamCount": len(teams_out),
    "hofCount": len(hof_out),
    "lastSeason": max(p["finalYear"] for p in filtered_players.values()),
    "firstSeason": min(p["debutYear"] for p in filtered_players.values() if p["debutYear"]),
    "source": "Sean Lahman's Baseball Database (chadwickbureau/baseballdatabank), through 2019",
    "license": "CC BY-SA 3.0",
})
print("Done.")
