// Static data loaders — all JSON lives in src/data/ and is bundled at build.
// Next.js handles the import statically; no runtime fetches needed.
import players from "@/data/players.json";
import teams from "@/data/teams.json";
import teamAlumni from "@/data/team_alumni.json";
import playersByState from "@/data/players_by_state.json";
import archetypes from "@/data/archetypes.json";
import leaders from "@/data/leaders.json";
import hofList from "@/data/hof.json";
import meta from "@/data/meta.json";
import type { Player, Franchise, Archetype } from "./types";

export const PLAYERS = players as unknown as Record<string, Player>;
export const TEAMS = teams as unknown as Franchise[];
export const TEAM_ALUMNI = teamAlumni as unknown as Record<string, string[]>;
export const PLAYERS_BY_STATE = playersByState as unknown as Record<string, string[]>;
export const ARCHETYPES = archetypes as unknown as Record<string, Record<string, Archetype>>;
export const LEADERS = leaders as unknown as Record<string, string[]>;
export const HOF = hofList as unknown as string[];
export const META = meta as unknown as {
  playerCount: number;
  teamCount: number;
  hofCount: number;
  lastSeason: number;
  firstSeason: number;
  source: string;
  license: string;
};

export function getPlayer(id: string): Player | undefined {
  return PLAYERS[id];
}

export function getTeam(franchID: string): Franchise | undefined {
  return TEAMS.find((t) => t.franchID === franchID);
}

// US states + territories + DC. ISO-ish abbreviations matching Lahman.
export const STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "PR", name: "Puerto Rico" },
];
