export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthYear: number;
  birthState: string | null;
  birthCity: string | null;
  birthCountry: string | null;
  deathYear: number | null;
  debutYear: number;
  finalYear: number;
  bats: string | null;
  throws: string | null;
  height: number; // inches
  weight: number; // lbs
  bbrefID: string | null;
  primaryPos: string | null;
  battingTotals: {
    G: number; AB?: number; R?: number; H: number; HR: number;
    RBI?: number; SB?: number; BB?: number; SO?: number;
    "2B"?: number; "3B"?: number;
  };
  pitchingTotals: null | {
    G: number; GS?: number; W: number; L?: number; SV?: number;
    IPouts?: number; H?: number; ER?: number; HR?: number;
    BB?: number; SO: number;
  };
  allStarSelections: number;
  majorAwards: Array<[string, number]>;
  hof: boolean;
  hofYear: number | null;
  franchs: string[];
  careerValue: number;
};

export type Franchise = {
  franchID: string;
  name: string;
  yearFirst: number | null;
  yearLast: number | null;
  wsTitles: number;
  leaguePennants: number;
  teamIDs: string[];
};

export type Archetype = {
  count: number;
  examples: string[];
};

export type ScoutReportInputs = {
  franchID: string;
  birthState: string;
};

export type ReportSection = {
  kind: "hometown" | "persona" | "comp" | "narrative" | "legacy";
  title: string;
  body: React.ReactNode;
};
