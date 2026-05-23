// Scout Report Engine
//
// Takes (favoriteTeam, birthState) and produces a multi-section personalized
// report from the bundled Lahman dataset. Designed so each finding maps cleanly
// to a SQL pattern that would run on Snowflake Cortex in production — see
// ../cortex/sql/ for the equivalent UDFs.
//
// Every "narrative" line returned here is what a Cortex.COMPLETE call would
// look like in prod — deterministic templates here, LLM-generated there.

import {
  PLAYERS, TEAMS, TEAM_ALUMNI, PLAYERS_BY_STATE,
  ARCHETYPES, LEADERS, CITIES, TEAM_LOCATIONS, getPlayer, getTeam,
} from "./data";
import type { Player, CityCentroid, TeamLocation } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Section types
// ─────────────────────────────────────────────────────────────────────────

export type HometownHero = {
  player: Player;
  rank: number;
  // Distance from the user's hometown in miles. null when we don't have
  // coords for either side and the player was matched via state fallback.
  distanceMi: number | null;
  // Why does this player matter for someone from this state?
  insight: string;
};

export type TeamInference = {
  inferredFranchID: string;
  inferredTeam: TeamLocation;
  distanceMi: number;
  runnersUp: { team: TeamLocation; distanceMi: number }[];
  basis: "hometown" | "state-fallback" | "override";
};

export type HometownInput = {
  city: string;       // raw user input, e.g. "Tampa"
  state: string;      // state code
  lat: number | null;
  lng: number | null;
  matched: boolean;   // true if we resolved city+state to coords
};

export type ArchetypeFinding = {
  position: string;
  count: number;
  topExample: Player | null;
  insight: string;
};

// A single axis of the 6-dimensional career profile.
// `raw` is the original stat (HR, K/9, etc).
// `z` is z-scored against the player's era cohort (so 1920s and 2010s are comparable).
// `pct` is the percentile (0–100) within the era cohort — what we render on the radar.
export type ProfileAxis = {
  key: string;     // short identifier ("vol", "pow", ...)
  label: string;   // display label
  raw: number;
  z: number;
  pct: number;     // 0..100
};

export type PlayerProfile = {
  player: Player;
  role: "bat" | "pit";
  era: string;
  axes: ProfileAxis[];   // length 6, ordered consistently for the role
};

export type Comp = {
  anchor: Player;          // Hall of Famer / franchise legend
  candidate: Player;       // a player whose era-adjusted profile mirrors the anchor's
  anchorProfile: PlayerProfile;
  candidateProfile: PlayerProfile;
  similarity: number;      // 0..1 (cosine over z-scored era-cohort vector)
  tightestAxis: ProfileAxis;       // axis where the two are closest (smallest |Δpct|)
  widestAxis: ProfileAxis;         // axis where they diverge most (largest |Δpct|)
  anchorEdgeAxis: ProfileAxis;     // axis where anchor's percentile most exceeds candidate's
  candidateEdgeAxis: ProfileAxis;  // axis where candidate's percentile most exceeds anchor's
  insight: string;
};

export type DidYouKnow = {
  kind: "stat" | "history" | "geo";
  headline: string;
  detail: string;
};

// Franchise decade timeline — one row per decade, with per-position counts of
// inner-30 alumni active that decade. Drives the stacked-bar chart in the
// Prospect Persona section.
export type FranchiseDecadeRow = {
  decadeStart: number;          // e.g. 1990 = 1990s
  total: number;
  byPosition: Record<string, number>;
};

export type FranchiseTimeline = {
  rows: FranchiseDecadeRow[];   // ascending by decade, only decades with >0
  peakDecade: number | null;
  peakCount: number;
  dominantPositionByDecade: Record<number, string>;
  insight: string;
};

// State density — top-100 player counts per state, used for both the rank bar
// and the tile-map choropleth.
export type StateDensity = {
  code: string;
  name: string;
  count: number;
  quintile: 0 | 1 | 2 | 3 | 4;   // 4 = densest, 0 = sparsest (or zero)
};

export type StateDensityReport = {
  rows: StateDensity[];         // every state, sorted by count desc
  userRank: number;             // 1-based rank within rows
  userQuintile: 0 | 1 | 2 | 3 | 4;
  topState: StateDensity | null;
  insight: string;
};

export type ScoutReport = {
  team: ReturnType<typeof getTeam>;
  stateCode: string;
  stateName: string;
  hometownInput: HometownInput;
  teamInference: TeamInference;
  radiusMi: number;
  hometown: HometownHero[];
  persona: ArchetypeFinding[];
  timeline: FranchiseTimeline;
  stateDensity: StateDensityReport;
  comp: Comp | null;
  didYouKnow: DidYouKnow[];
  narrative: string;
  signature: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function eraOf(year: number): string {
  if (year < 1900) return "19th century";
  if (year < 1920) return "Dead Ball Era";
  if (year < 1942) return "Live Ball Era";
  if (year < 1961) return "Integration Era";
  if (year < 1977) return "Expansion Era";
  if (year < 1994) return "Free Agency Era";
  if (year < 2006) return "Steroid Era";
  if (year < 2015) return "Post-Steroid Era";
  return "Statcast Era";
}

function fmtCareer(p: Player): string {
  if (!p.debutYear) return "";
  if (!p.finalYear || p.finalYear === p.debutYear) return `${p.debutYear}`;
  return `${p.debutYear}–${p.finalYear}`;
}

function isPitcher(p: Player): boolean {
  return p.primaryPos === "P";
}

// ─────────────────────────────────────────────────────────────────────────
// Geo helpers — hometown radius search + team inference.
//
// User picks a city + state. We look it up in CITIES (centroid table) to
// get coords. For every candidate player, we look up their birth city in
// the same table. Both sides need to resolve for a radius match; otherwise
// we fall back to a state-level pool.
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_RADIUS_MI = 75;

// Build a normalized index of cities by "city|state" (case-insensitive).
const cityIndex: Map<string, CityCentroid> = (() => {
  const m = new Map<string, CityCentroid>();
  for (const c of CITIES) m.set(`${c.city.toLowerCase()}|${c.state.toUpperCase()}`, c);
  return m;
})();

export function geocodeCity(city: string, state: string): CityCentroid | null {
  if (!city || !state) return null;
  return cityIndex.get(`${city.trim().toLowerCase()}|${state.trim().toUpperCase()}`) ?? null;
}

// Haversine distance in miles.
const EARTH_RADIUS_MI = 3958.8;
export function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(s));
}

// Distance from one player to a center, using the player's birth city
// centroid if we have it. Returns null when we don't.
function distanceFromPlayer(p: Player, lat: number, lng: number): number | null {
  const c = p.birthCity && p.birthState ? geocodeCity(p.birthCity, p.birthState) : null;
  if (!c) return null;
  return haversineMi(lat, lng, c.lat, c.lng);
}

// Build a ranked-by-distance team list given a hometown centroid.
export function inferFranchise(lat: number, lng: number): TeamInference {
  const scored = TEAM_LOCATIONS.map((t) => ({ team: t, distanceMi: haversineMi(lat, lng, t.lat, t.lng) }))
    .sort((a, b) => a.distanceMi - b.distanceMi);
  const top = scored[0];
  return {
    inferredFranchID: top.team.franchID,
    inferredTeam: top.team,
    distanceMi: top.distanceMi,
    runnersUp: scored.slice(1, 4),
    basis: "hometown",
  };
}

// State-fallback team inference: pick the franchise whose state matches the
// user's, or the geographically closest if multiple. Uses team centroid
// rather than a true state-level pool, so it's still deterministic.
function inferFranchiseFromState(stateCode: string): TeamInference {
  const candidates = TEAM_LOCATIONS.filter((t) => t.state === stateCode);
  if (candidates.length > 0) {
    const team = candidates[0];
    return {
      inferredFranchID: team.franchID,
      inferredTeam: team,
      distanceMi: 0,
      runnersUp: candidates.slice(1).map((t) => ({ team: t, distanceMi: 0 })),
      basis: "state-fallback",
    };
  }
  // Sketch fallback: no franchise in user's state — pick the first whose
  // state borders or whatever; for simplicity, use the first franchise.
  // This branch is rare (states like AK, ND, MT, etc).
  const team = TEAM_LOCATIONS[0];
  return {
    inferredFranchID: team.franchID,
    inferredTeam: team,
    distanceMi: 0,
    runnersUp: TEAM_LOCATIONS.slice(1, 4).map((t) => ({ team: t, distanceMi: 0 })),
    basis: "state-fallback",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Era-adjusted 6-axis profiles
//
// Raw counting stats (HR, K, wins) are useless across eras: 30 HR in 1925 is
// a different signal than 30 HR in 2001. We bucket every player by debut
// era, compute per-era mean + std for each axis, then z-score. Players are
// compared on those z-vectors via cosine. This is the same idea used in the
// dbt model agg_era_normalized_profiles.sql.
// ─────────────────────────────────────────────────────────────────────────

// Per-role axis definitions. Each axis extracts a numeric value from a Player.
// Order matters — both anchor and candidate vectors must use the same axis order.
type AxisDef = { key: string; label: string; extract: (p: Player) => number };

const BAT_AXES: AxisDef[] = [
  { key: "vol", label: "Volume",     extract: (p) => p.battingTotals.G },
  { key: "pow", label: "Power",      extract: (p) => rate(p.battingTotals.HR, p.battingTotals.AB) },
  { key: "ctc", label: "Contact",    extract: (p) => rate(p.battingTotals.H, p.battingTotals.AB) },
  { key: "rbi", label: "Run prod.",  extract: (p) => rate(p.battingTotals.RBI ?? 0, p.battingTotals.G) },
  { key: "eye", label: "Plate eye",  extract: (p) => {
      const bb = p.battingTotals.BB ?? 0;
      const so = p.battingTotals.SO ?? 0;
      return bb / (bb + so + 1);
    } },
  { key: "lng", label: "Longevity",  extract: (p) => Math.max(1, (p.finalYear || p.debutYear) - p.debutYear + 1) },
];

const PIT_AXES: AxisDef[] = [
  { key: "vol", label: "Volume",     extract: (p) => p.pitchingTotals?.G ?? 0 },
  { key: "k9",  label: "K-rate",     extract: (p) => per9(p.pitchingTotals?.SO ?? 0, p.pitchingTotals?.IPouts ?? 0) },
  { key: "ip",  label: "Workload",   extract: (p) => (p.pitchingTotals?.IPouts ?? 0) / 3 },
  { key: "win", label: "Win rate",   extract: (p) => {
      const w = p.pitchingTotals?.W ?? 0;
      const l = p.pitchingTotals?.L ?? 0;
      return w / (w + l + 1);
    } },
  { key: "kbb", label: "K/BB",       extract: (p) => {
      const so = p.pitchingTotals?.SO ?? 0;
      const bb = p.pitchingTotals?.BB ?? 0;
      return so / (bb + 1);
    } },
  { key: "lng", label: "Longevity",  extract: (p) => Math.max(1, (p.finalYear || p.debutYear) - p.debutYear + 1) },
];

function rate(num: number, denom: number | undefined): number {
  if (!denom || denom <= 0) return 0;
  return num / denom;
}

function per9(events: number, ipOuts: number): number {
  if (!ipOuts || ipOuts <= 0) return 0;
  return (events * 27) / ipOuts;
}

// Per-era moments cached at module load. eraKey -> axisKey -> {mean, std}
type Moments = { mean: number; std: number };
type CohortStats = Record<string, Record<string, Moments>>;

// Per-era sorted-axis-values cache, for percentile lookups.
type CohortSorted = Record<string, Record<string, number[]>>;

let _cohortBat: CohortStats | null = null;
let _cohortPit: CohortStats | null = null;
let _sortedBat: CohortSorted | null = null;
let _sortedPit: CohortSorted | null = null;

function eligibleBatters(): Player[] {
  return Object.values(PLAYERS).filter((p) => !isPitcher(p) && p.battingTotals.G >= 50);
}
function eligiblePitchers(): Player[] {
  return Object.values(PLAYERS).filter((p) => isPitcher(p) && (p.pitchingTotals?.G ?? 0) >= 20);
}

function buildCohort(pool: Player[], axes: AxisDef[]): { stats: CohortStats; sorted: CohortSorted } {
  const buckets: Record<string, Record<string, number[]>> = {};
  for (const p of pool) {
    const era = eraOf(p.debutYear);
    buckets[era] ??= {};
    for (const ax of axes) {
      buckets[era][ax.key] ??= [];
      buckets[era][ax.key].push(ax.extract(p));
    }
  }
  const stats: CohortStats = {};
  const sorted: CohortSorted = {};
  for (const [era, byAxis] of Object.entries(buckets)) {
    stats[era] = {};
    sorted[era] = {};
    for (const [key, vals] of Object.entries(byAxis)) {
      const n = vals.length || 1;
      const mean = vals.reduce((s, x) => s + x, 0) / n;
      const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance) || 1;
      stats[era][key] = { mean, std };
      sorted[era][key] = [...vals].sort((a, b) => a - b);
    }
  }
  return { stats, sorted };
}

function cohortBat() {
  if (!_cohortBat) {
    const r = buildCohort(eligibleBatters(), BAT_AXES);
    _cohortBat = r.stats;
    _sortedBat = r.sorted;
  }
  return { stats: _cohortBat!, sorted: _sortedBat! };
}
function cohortPit() {
  if (!_cohortPit) {
    const r = buildCohort(eligiblePitchers(), PIT_AXES);
    _cohortPit = r.stats;
    _sortedPit = r.sorted;
  }
  return { stats: _cohortPit!, sorted: _sortedPit! };
}

// Percentile of `v` within a sorted ascending array (0..100).
function percentileOf(v: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

export function profileOf(p: Player): PlayerProfile {
  const role: "bat" | "pit" = isPitcher(p) ? "pit" : "bat";
  const axes = role === "pit" ? PIT_AXES : BAT_AXES;
  const { stats, sorted } = role === "pit" ? cohortPit() : cohortBat();
  const era = eraOf(p.debutYear);
  const cohortStats = stats[era] ?? {};
  const cohortSorted = sorted[era] ?? {};
  const out: ProfileAxis[] = axes.map((ax) => {
    const raw = ax.extract(p);
    const m = cohortStats[ax.key] ?? { mean: raw, std: 1 };
    const z = (raw - m.mean) / (m.std || 1);
    const pct = percentileOf(raw, cohortSorted[ax.key] ?? [raw]);
    return { key: ax.key, label: ax.label, raw, z, pct };
  });
  return { player: p, role, era, axes: out };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Cosine similarity over the era-adjusted z-vectors. Range is roughly
// −1..1; clamp to 0..1 for the UI (negative means "opposite shape",
// which is just as far away as "different shape" for our purposes).
function similarityProfiles(a: PlayerProfile, b: PlayerProfile): number {
  if (a.role !== b.role) return 0;
  const av = a.axes.map((x) => x.z);
  const bv = b.axes.map((x) => x.z);
  return Math.max(0, cosine(av, bv));
}

// Pick a deterministic "candidate" comp for a Hall of Famer anchor.
//
// Strategy:
//   1. Build the anchor's era-adjusted 6-axis profile.
//   2. Pull the candidate pool (anchor's birth state if available, else any).
//   3. Filter: not the anchor, not a HOFer, role-matched, meaningful career
//      (≥200 game-equivalents to filter out cup-of-coffee careers).
//   4. Score every candidate via cosine similarity over their z-vectors.
//   5. Accept the best if similarity ≥ 0.6.
//   6. Compute the axis-level deltas (tightest, widest, anchor edge, cand edge)
//      that the radar chart will show — these drive the dynamic insight.
function findComp(anchor: Player, home: HometownInput | null, radiusMi: number): Comp | null {
  const anchorProfile = profileOf(anchor);
  let pool: Player[];
  if (home && home.matched && home.lat !== null && home.lng !== null) {
    const lat = home.lat, lng = home.lng;
    pool = Object.values(PLAYERS).filter((p) => {
      const d = distanceFromPlayer(p, lat, lng);
      return d !== null && d <= radiusMi;
    });
  } else {
    pool = anchor.birthState
      ? (PLAYERS_BY_STATE[anchor.birthState] || []).map(getPlayer).filter(Boolean) as Player[]
      : Object.values(PLAYERS);
  }
  let best: { p: Player; prof: PlayerProfile; sim: number } | null = null;
  for (const cand of pool) {
    if (cand.id === anchor.id) continue;
    if (cand.hof) continue;                              // not another HOFer
    if (isPitcher(cand) !== isPitcher(anchor)) continue;
    if ((cand.battingTotals.G + (cand.pitchingTotals?.G ?? 0)) < 200) continue;
    const prof = profileOf(cand);
    const sim = similarityProfiles(anchorProfile, prof);
    if (!best || sim > best.sim) best = { p: cand, prof, sim };
  }
  if (!best || best.sim < 0.6) return null;

  const axisDeltas = anchorProfile.axes.map((a, i) => ({
    axis: a,
    candAxis: best!.prof.axes[i],
    delta: a.pct - best!.prof.axes[i].pct,   // positive = anchor higher
  }));
  const tightest = [...axisDeltas].sort((x, y) => Math.abs(x.delta) - Math.abs(y.delta))[0];
  const widest   = [...axisDeltas].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0];
  const anchorEdge = [...axisDeltas].sort((x, y) => y.delta - x.delta)[0];
  const candEdge   = [...axisDeltas].sort((x, y) => x.delta - y.delta)[0];

  return {
    anchor,
    candidate: best.p,
    anchorProfile,
    candidateProfile: best.prof,
    similarity: best.sim,
    tightestAxis: tightest.axis,
    widestAxis:   widest.axis,
    anchorEdgeAxis:    anchorEdge.axis,
    candidateEdgeAxis: candEdge.axis,
    insight: buildCompInsight(anchorProfile, best.prof, best.sim, {
      tightest, widest, anchorEdge, candEdge,
    }),
  };
}

type AxisDelta = { axis: ProfileAxis; candAxis: ProfileAxis; delta: number };

function buildCompInsight(
  anchor: PlayerProfile,
  cand: PlayerProfile,
  sim: number,
  d: { tightest: AxisDelta; widest: AxisDelta; anchorEdge: AxisDelta; candEdge: AxisDelta },
): string {
  const pct = Math.round(sim * 100);
  const anchorName = anchor.player.fullName;
  const candName   = cand.player.fullName;
  const tight = d.tightest;
  const wide  = d.widest;

  const tightLine = Math.abs(tight.delta) <= 5
    ? `Their era-adjusted ${tight.axis.label.toLowerCase()} percentiles sit within ${Math.abs(tight.delta)} points (${tight.axis.pct} vs ${tight.candAxis.pct}).`
    : `They're closest on ${tight.axis.label.toLowerCase()} — ${tight.axis.pct} vs ${tight.candAxis.pct} percentile.`;

  const wideLine = Math.abs(wide.delta) >= 15
    ? `Where ${anchorName.split(" ").slice(-1)[0]} pulls ahead: ${wide.axis.label.toLowerCase()} (${wide.axis.pct} vs ${wide.candAxis.pct}).`
    : `Even on their widest axis (${wide.axis.label.toLowerCase()}) the gap is only ${Math.abs(wide.delta)} percentile points.`;

  return `${candName}'s era-adjusted profile shares ${pct}% cosine similarity with ${anchorName}'s, ` +
         `measured against the ${anchor.era} cohort. ${tightLine} ${wideLine} ` +
         `${anchorName} is in Cooperstown. ${candName} isn't — but the shape of their work tells the same story.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Section: Hometown Heroes
// ─────────────────────────────────────────────────────────────────────────

// Build the hometown-heroes list.
//
// Primary mode (when we have hometown coords):
//   - Pull every US player; compute distance from their birth city to the
//     user's hometown via the city-centroid table.
//   - Filter to those within radiusMi.
//   - Score by careerValue (descending). Take top 5.
//
// Fallback mode (no hometown coords):
//   - Use the legacy PLAYERS_BY_STATE list (already sorted by careerValue).
//
// Either way, returns at most 5 heroes with their `distanceMi` (null in
// fallback mode).
function buildHometown(home: HometownInput, radiusMi: number): HometownHero[] {
  if (home.matched && home.lat !== null && home.lng !== null) {
    const lat = home.lat, lng = home.lng;
    const ranked = Object.values(PLAYERS)
      .map((p) => ({ p, d: distanceFromPlayer(p, lat, lng) }))
      .filter((x): x is { p: Player; d: number } => x.d !== null && x.d <= radiusMi)
      .sort((a, b) => b.p.careerValue - a.p.careerValue)
      .slice(0, 5);
    return ranked.map(({ p, d }, i) => ({
      player: p,
      rank: i + 1,
      distanceMi: d,
      insight: buildHometownInsight(p, i + 1, d, home.city),
    }));
  }
  // State fallback — preserves legacy behavior when we can't geocode
  const list = (PLAYERS_BY_STATE[home.state] || []).slice(0, 5);
  return list
    .map((pid, i) => {
      const p = getPlayer(pid);
      if (!p) return null;
      return { player: p, rank: i + 1, distanceMi: null, insight: buildHometownInsight(p, i + 1, null, home.city) };
    })
    .filter(Boolean) as HometownHero[];
}

function buildHometownInsight(p: Player, rank: number, distanceMi: number | null, userCity: string): string {
  const era = eraOf(p.debutYear);
  const bits: string[] = [];
  if (p.hof) bits.push(`Hall of Fame, class of ${p.hofYear}`);
  if (p.allStarSelections >= 3) bits.push(`${p.allStarSelections}-time All-Star`);
  if (p.majorAwards.length > 0) {
    const top = p.majorAwards.slice(0, 2).map(([a, y]) => `${a} (${y})`).join(", ");
    bits.push(top);
  }
  if (bits.length === 0) bits.push(`${era} ${p.primaryPos ?? "player"}`);
  const ord = rank === 1 ? "the top" : rank === 2 ? "second" : rank === 3 ? "third" : "a top-five";
  const where = distanceMi !== null && userCity
    ? `${p.birthCity ?? "nearby"} — ${Math.round(distanceMi)} mi from ${userCity}`
    : `${p.birthCity ?? "this state"}`;
  return `${ord} career produced by a ${era} player born in ${where}. ${bits.join(" · ")}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Section: Prospect Persona — what kind of player has historically worked
// ─────────────────────────────────────────────────────────────────────────

function buildPersona(franchID: string): ArchetypeFinding[] {
  const arch = ARCHETYPES[franchID];
  if (!arch) return [];
  const sorted = Object.entries(arch)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  return sorted.map(([pos, slot]) => {
    const examplePid = slot.examples[0];
    const top = examplePid ? getPlayer(examplePid) || null : null;
    return {
      position: pos,
      count: slot.count,
      topExample: top,
      insight: buildPersonaInsight(pos, slot.count, top),
    };
  });
}

function buildPersonaInsight(pos: string, count: number, top: Player | null): string {
  const posLong = POS_LONG[pos] ?? pos;
  const topBit = top
    ? `Headlined by ${top.fullName} (${fmtCareer(top)}${top.hof ? ", HOF" : ""}).`
    : "";
  return `${count} of this franchise's top-30 all-time alumni were primarily ${posLong}. ${topBit}`.trim();
}

const POS_LONG: Record<string, string> = {
  P:  "pitchers",
  C:  "catchers",
  "1B": "first basemen",
  "2B": "second basemen",
  "3B": "third basemen",
  SS: "shortstops",
  LF: "left fielders",
  CF: "center fielders",
  RF: "right fielders",
  DH: "designated hitters",
};

// ─────────────────────────────────────────────────────────────────────────
// Section: Hidden Comp — find a non-HOFer whose profile mirrors a franchise legend
// ─────────────────────────────────────────────────────────────────────────

function buildComp(franchID: string, home: HometownInput | null, radiusMi: number): Comp | null {
  // Anchor = franchise's top all-time HOFer if any, else top alumnus.
  const alumIDs = TEAM_ALUMNI[franchID] || [];
  let anchor: Player | null = null;
  for (const pid of alumIDs) {
    const p = getPlayer(pid);
    if (p?.hof) { anchor = p; break; }
  }
  if (!anchor) {
    for (const pid of alumIDs) {
      const p = getPlayer(pid);
      if (p) { anchor = p; break; }
    }
  }
  if (!anchor) return null;
  return findComp(anchor, home, radiusMi);
}

// ─────────────────────────────────────────────────────────────────────────
// Section: Did You Know — facts blended from team + state
// ─────────────────────────────────────────────────────────────────────────

function buildDidYouKnow(franchID: string, stateCode: string): DidYouKnow[] {
  const team = getTeam(franchID);
  const out: DidYouKnow[] = [];

  // Team historical fact
  if (team) {
    out.push({
      kind: "history",
      headline: `${team.wsTitles} World Series · ${team.leaguePennants} pennants`,
      detail:  `${team.name} have been in business since ${team.yearFirst}. ` +
               `That's ${(team.yearLast ?? 2019) - (team.yearFirst ?? 2019)} years of franchise history to learn from.`,
    });
  }

  // How many top-100 careers were born in this state vs. team's alumni overlap
  const stateAlumni = PLAYERS_BY_STATE[stateCode] || [];
  const teamAlumIDs = new Set(TEAM_ALUMNI[franchID] || []);
  const overlap = stateAlumni.filter((pid) => teamAlumIDs.has(pid));
  if (overlap.length > 0) {
    const sample = overlap.slice(0, 3).map((pid) => getPlayer(pid)?.fullName).filter(Boolean);
    out.push({
      kind: "geo",
      headline: `${overlap.length} of your team's top-50 alumni were born in your state`,
      detail: sample.length
        ? `Including ${sample.join(", ")}. The geography of a franchise rarely matches its fan map — but for you, it does.`
        : "",
    });
  } else if (stateAlumni.length > 0) {
    const first = getPlayer(stateAlumni[0]);
    if (first) {
      out.push({
        kind: "geo",
        headline: `Your state's top all-time MLB export: ${first.fullName}`,
        detail: `${fmtCareer(first)} · ${first.primaryPos ?? "—"}. None of your team's top-50 alumni were born in your state — yet.`,
      });
    }
  }

  // A leaderboard fact tied to the team
  const allTimeLeader = LEADERS.careerValue.map(getPlayer).filter(Boolean) as Player[];
  const teamLegend = allTimeLeader.find((p) => p.franchs.includes(franchID));
  if (teamLegend) {
    const rank = allTimeLeader.indexOf(teamLegend) + 1;
    out.push({
      kind: "stat",
      headline: `${teamLegend.fullName} ranks #${rank} in MLB history`,
      detail: `Of every player who's ever played, ${teamLegend.fullName} (${fmtCareer(teamLegend)}) ranks ${rank}` +
              ` by our career-value score. Worn your team's uniform.`,
    });
  }

  return out.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────
// Section: Franchise Decade Timeline — for each decade 1870s..2020s,
// count how many of the inner-30 alumni were active that decade by
// primary position. The viz lets the eye see when the franchise actually
// built its core (e.g. Dodgers cluster 1950s + 1990s).
// ─────────────────────────────────────────────────────────────────────────

const INNER_N = 30;

function buildTimeline(franchID: string): FranchiseTimeline {
  const alumIDs = (TEAM_ALUMNI[franchID] || []).slice(0, INNER_N);
  const players = alumIDs.map(getPlayer).filter(Boolean) as Player[];

  const counts = new Map<number, Map<string, number>>();
  for (const p of players) {
    const pos = p.primaryPos ?? "—";
    const start = Math.floor((p.debutYear ?? 0) / 10) * 10;
    const end   = Math.floor((p.finalYear || p.debutYear || 0) / 10) * 10;
    for (let d = start; d <= end; d += 10) {
      if (!counts.has(d)) counts.set(d, new Map());
      const inner = counts.get(d)!;
      inner.set(pos, (inner.get(pos) ?? 0) + 1);
    }
  }

  const rows: FranchiseDecadeRow[] = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, posMap]) => {
      const byPosition: Record<string, number> = {};
      let total = 0;
      for (const [pos, n] of posMap.entries()) { byPosition[pos] = n; total += n; }
      return { decadeStart: decade, total, byPosition };
    });

  let peakDecade: number | null = null;
  let peakCount = 0;
  const dominantPositionByDecade: Record<number, string> = {};
  for (const r of rows) {
    if (r.total > peakCount) { peakCount = r.total; peakDecade = r.decadeStart; }
    let bestPos = "—", bestN = 0;
    for (const [pos, n] of Object.entries(r.byPosition)) {
      if (n > bestN) { bestN = n; bestPos = pos; }
    }
    dominantPositionByDecade[r.decadeStart] = bestPos;
  }

  return { rows, peakDecade, peakCount, dominantPositionByDecade, insight: buildTimelineInsight(rows, peakDecade, peakCount, dominantPositionByDecade) };
}

function buildTimelineInsight(
  rows: FranchiseDecadeRow[],
  peakDecade: number | null,
  peakCount: number,
  dominant: Record<number, string>,
): string {
  if (rows.length === 0 || peakDecade === null) {
    return "Not enough alumni in the bundled set to plot a meaningful timeline.";
  }
  const span = rows[rows.length - 1].decadeStart - rows[0].decadeStart;
  const peakPos = dominant[peakDecade] ?? "—";
  const peakPosLong = POS_LONG[peakPos] ?? peakPos;
  return `The inner-30 spans ${span / 10 + 1} decades, peaking in the ${peakDecade}s ` +
         `with ${peakCount} active alumni — driven mostly by ${peakPosLong}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Section: State Density — top-100 player counts across every state, with
// the user's state highlighted and bucketed by quintile so the tile-map
// renders a clean choropleth.
// ─────────────────────────────────────────────────────────────────────────

function buildStateDensity(stateCode: string): StateDensityReport {
  const rows: Omit<StateDensity, "quintile">[] = STATES.map((s) => ({
    code: s.code,
    name: s.name,
    count: (PLAYERS_BY_STATE[s.code] || []).length,
  })).sort((a, b) => b.count - a.count);

  // Quintile by non-zero counts so empty states don't all sit in the bottom
  // bucket and skew the rest of the scale.
  const nonZero = rows.filter((r) => r.count > 0).map((r) => r.count);
  const quintileOf = (n: number): 0 | 1 | 2 | 3 | 4 => {
    if (n === 0 || nonZero.length === 0) return 0;
    const sorted = [...nonZero].sort((a, b) => a - b);
    const idx = sorted.findIndex((v) => v >= n);
    const pos = idx === -1 ? sorted.length - 1 : idx;
    const q = Math.floor((pos / sorted.length) * 5);
    return Math.min(4, q) as 0 | 1 | 2 | 3 | 4;
  };

  const decorated: StateDensity[] = rows.map((r) => ({ ...r, quintile: quintileOf(r.count) }));
  const userRow = decorated.find((r) => r.code === stateCode);
  const userRank = decorated.findIndex((r) => r.code === stateCode) + 1;
  const topState = decorated[0] ?? null;

  const stateName = userRow?.name ?? stateCode;
  const userQuintile = userRow?.quintile ?? 0;
  const insight = !userRow
    ? `No top-100 alumni records found for ${stateCode}.`
    : userRow.count === 0
      ? `${stateName} has produced none of the top-100-state player careers in the bundled set — but every legend started somewhere outside the leaderboard.`
      : `${stateName} ranks #${userRank} of ${decorated.length} with ${userRow.count} top-100 player careers, ` +
        `placing it in the ${["bottom", "fourth", "third", "second", "top"][userQuintile]} quintile by production.`;

  return { rows: decorated, userRank: userRank || decorated.length, userQuintile, topState, insight };
}

// ─────────────────────────────────────────────────────────────────────────
// Narrative — the closing paragraph (Cortex.COMPLETE in prod, template here)
// ─────────────────────────────────────────────────────────────────────────

function buildNarrative(
  team: ReturnType<typeof getTeam>,
  stateName: string,
  hometown: HometownHero[],
  persona: ArchetypeFinding[],
  comp: Comp | null,
): string {
  const parts: string[] = [];
  const topHero = hometown[0]?.player;
  const topArch = persona[0];

  if (team) {
    parts.push(
      `If you're scouting for the ${team.name}, the data argues for a specific kind of bet: ` +
      (topArch
        ? `roughly ${Math.round((topArch.count / 30) * 100)}% of their inner circle wore the ${POS_LONG[topArch.position] ?? topArch.position} label.`
        : `the franchise has been positionally agnostic across its history.`)
    );
  }

  if (topHero) {
    const era = eraOf(topHero.debutYear);
    parts.push(
      `${stateName} has produced major-league careers across nine decades. The headline ` +
      `belongs to ${topHero.fullName} — a ${era} ${topHero.primaryPos ?? "player"} ` +
      `whose career value puts them ahead of every other ${stateName}-born player on the books.`
    );
  }

  if (comp) {
    parts.push(
      `And here's the line a scout watches for: ${comp.candidate.fullName}'s shape rhymes with ` +
      `${comp.anchor.fullName}'s. Both born in ${comp.anchor.birthState}. ` +
      `${Math.round(comp.similarity * 100)}% cosine similarity across six era-adjusted axes — ` +
      `tightest on ${comp.tightestAxis.label.toLowerCase()}, widest on ${comp.widestAxis.label.toLowerCase()}. ` +
      `One went to Cooperstown. The other didn't. The point: ` +
      `the shape of greatness doesn't always wear a plaque.`
    );
  }

  parts.push(
    `This is what Open Data Infrastructure does for analytics like this: 150 years of Lahman, modern Statcast, ` +
    `team-history overlays — all in one Iceberg lake, queried by Snowflake Cortex, narrated by an LLM with the receipts.`
  );

  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────

import { STATES } from "./data";

export type ScoutReportArgs = {
  city: string;
  state: string;
  radiusMi?: number;
  // Optional override — if present, we use this franchise instead of the
  // hometown-inferred one. Used by the "switch team" UI.
  franchIDOverride?: string;
};

export function buildScoutReport(args: ScoutReportArgs): ScoutReport {
  const city = (args.city ?? "").trim();
  const state = (args.state ?? "").trim().toUpperCase();
  const radiusMi = args.radiusMi ?? DEFAULT_RADIUS_MI;

  // Resolve hometown coords (if known).
  const centroid = geocodeCity(city, state);
  const hometownInput: HometownInput = {
    city,
    state,
    lat: centroid?.lat ?? null,
    lng: centroid?.lng ?? null,
    matched: centroid !== null,
  };

  // Infer franchise — by hometown coords when available, else state fallback.
  let teamInference: TeamInference;
  if (hometownInput.matched && hometownInput.lat !== null && hometownInput.lng !== null) {
    teamInference = inferFranchise(hometownInput.lat, hometownInput.lng);
  } else {
    teamInference = inferFranchiseFromState(state);
  }
  if (args.franchIDOverride) {
    const overrideTeam = TEAM_LOCATIONS.find((t) => t.franchID === args.franchIDOverride);
    if (overrideTeam) {
      teamInference = {
        inferredFranchID: overrideTeam.franchID,
        inferredTeam: overrideTeam,
        distanceMi: hometownInput.matched
          ? haversineMi(hometownInput.lat!, hometownInput.lng!, overrideTeam.lat, overrideTeam.lng)
          : 0,
        runnersUp: teamInference.runnersUp,
        basis: "override",
      };
    }
  }
  const franchID = teamInference.inferredFranchID;

  const team = getTeam(franchID);
  const stateName = STATES.find((s) => s.code === state)?.name ?? state;
  const hometown = buildHometown(hometownInput, radiusMi);
  const persona  = buildPersona(franchID);
  const timeline = buildTimeline(franchID);
  const stateDensity = buildStateDensity(state);
  const comp     = buildComp(franchID, hometownInput, radiusMi);
  const didYouKnow = buildDidYouKnow(franchID, state);
  const narrative = buildNarrative(team, stateName, hometown, persona, comp);

  // Signature — a short distinctive tagline.
  const where = hometownInput.matched ? `${city}, ${state}` : `${stateName} (state-level fallback)`;
  const signature = team && hometown[0]
    ? `${team.name} × ${where} · scouted via ${hometown.length} ` +
      `${hometownInput.matched ? `careers within ${radiusMi} mi` : "in-state careers"}, ` +
      `${persona.reduce((n, x) => n + x.count, 0)} franchise inner-circle profiles, ` +
      `${comp ? "1 hidden comp" : "0 hidden comps"}.`
    : "";

  return {
    team,
    stateCode: state,
    stateName,
    hometownInput,
    teamInference,
    radiusMi,
    hometown,
    persona,
    timeline,
    stateDensity,
    comp,
    didYouKnow,
    narrative,
    signature,
  };
}
