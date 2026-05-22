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
  ARCHETYPES, LEADERS, getPlayer, getTeam,
} from "./data";
import type { Player } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Section types
// ─────────────────────────────────────────────────────────────────────────

export type HometownHero = {
  player: Player;
  rank: number;
  // Why does this player matter for someone from this state?
  insight: string;
};

export type ArchetypeFinding = {
  position: string;
  count: number;
  topExample: Player | null;
  insight: string;
};

export type Comp = {
  anchor: Player;          // Hall of Famer / franchise legend
  candidate: Player;       // a player whose age-similar stats mirror the anchor
  ageAtSnapshot: number;
  similarity: number;      // 0..1 (cosine-like over normalized stats)
  insight: string;
};

export type DidYouKnow = {
  kind: "stat" | "history" | "geo";
  headline: string;
  detail: string;
};

export type ScoutReport = {
  team: ReturnType<typeof getTeam>;
  stateCode: string;
  stateName: string;
  hometown: HometownHero[];
  persona: ArchetypeFinding[];
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

// Cosine-like similarity over a small stat vector, anchored by primary role.
function similarity(a: Player, b: Player): number {
  if (isPitcher(a) !== isPitcher(b)) return 0;
  if (isPitcher(a)) {
    const av = [a.pitchingTotals?.W ?? 0, a.pitchingTotals?.SO ?? 0, a.pitchingTotals?.G ?? 0];
    const bv = [b.pitchingTotals?.W ?? 0, b.pitchingTotals?.SO ?? 0, b.pitchingTotals?.G ?? 0];
    return cosine(av, bv);
  }
  const av = [a.battingTotals.H, a.battingTotals.HR, a.battingTotals.G];
  const bv = [b.battingTotals.H, b.battingTotals.HR, b.battingTotals.G];
  return cosine(av, bv);
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

// Pick a deterministic "candidate" comp for a Hall of Famer anchor.
// We exclude the anchor itself and other inner-circle HOFers — the point of
// the exercise is "this lesser-known player's profile mirrors a legend's".
function findComp(anchor: Player): Comp | null {
  const stateCandidates = anchor.birthState
    ? (PLAYERS_BY_STATE[anchor.birthState] || []).map(getPlayer).filter(Boolean) as Player[]
    : Object.values(PLAYERS);
  let best: { p: Player; sim: number } | null = null;
  for (const cand of stateCandidates) {
    if (cand.id === anchor.id) continue;
    if (cand.hof) continue;                              // not another HOFer
    if (isPitcher(cand) !== isPitcher(anchor)) continue;
    if ((cand.battingTotals.G + (cand.pitchingTotals?.G ?? 0)) < 200) continue;
    const sim = similarity(anchor, cand);
    if (!best || sim > best.sim) best = { p: cand, sim };
  }
  if (!best || best.sim < 0.7) return null;
  const ageAtSnapshot = anchor.finalYear - anchor.debutYear + 1;
  return {
    anchor,
    candidate: best.p,
    ageAtSnapshot,
    similarity: best.sim,
    insight: buildCompInsight(anchor, best.p, best.sim),
  };
}

function buildCompInsight(anchor: Player, cand: Player, sim: number): string {
  const pct = Math.round(sim * 100);
  if (isPitcher(anchor)) {
    return `${cand.fullName}'s career W/SO/G profile shares ${pct}% similarity with ${anchor.fullName}'s ` +
           `at the same point in their careers. ${anchor.fullName} is in Cooperstown. ` +
           `${cand.fullName} isn't — but the shape of their work tells the same story.`;
  }
  return `${cand.fullName}'s career H/HR/G profile shares ${pct}% similarity with ${anchor.fullName}'s ` +
         `at the same point in their careers. ${anchor.fullName} is in Cooperstown. ` +
         `${cand.fullName} isn't — but the shape of their work tells the same story.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Section: Hometown Heroes
// ─────────────────────────────────────────────────────────────────────────

function buildHometown(stateCode: string): HometownHero[] {
  const list = (PLAYERS_BY_STATE[stateCode] || []).slice(0, 5);
  return list
    .map((pid, i) => {
      const p = getPlayer(pid);
      if (!p) return null;
      return {
        player: p,
        rank: i + 1,
        insight: buildHometownInsight(p, i + 1),
      };
    })
    .filter(Boolean) as HometownHero[];
}

function buildHometownInsight(p: Player, rank: number): string {
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
  return `${ord} career produced by a ${era} player born in ${p.birthCity ?? "this state"}. ${bits.join(" · ")}.`;
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

function buildComp(franchID: string, stateCode: string): Comp | null {
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
  return findComp(anchor);
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
      `${Math.round(comp.similarity * 100)}% similar by career W/SO/G or H/HR/G — depending on role. ` +
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

export function buildScoutReport(franchID: string, stateCode: string): ScoutReport {
  const team = getTeam(franchID);
  const stateName = STATES.find((s) => s.code === stateCode)?.name ?? stateCode;
  const hometown = buildHometown(stateCode);
  const persona  = buildPersona(franchID);
  const comp     = buildComp(franchID, stateCode);
  const didYouKnow = buildDidYouKnow(franchID, stateCode);
  const narrative = buildNarrative(team, stateName, hometown, persona, comp);

  // Signature — a short distinctive tagline.
  const signature = team && hometown[0]
    ? `${team.name} × ${stateName} · scouted via ${hometown.length} hometown careers, ` +
      `${persona.reduce((n, x) => n + x.count, 0)} franchise inner-circle profiles, ` +
      `${comp ? "1 hidden comp" : "0 hidden comps"}.`
    : "";

  return { team, stateCode, stateName, hometown, persona, comp, didYouKnow, narrative, signature };
}
