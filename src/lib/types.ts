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
  // Optional: backed by data-raw/fetch_photos_v2.py
  wiki_image?: string;
  wiki_title?: string;
  wiki_page?:  string;
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

export type CityCentroid = {
  city: string;
  state: string;
  lat: number;
  lng: number;
};

export type TeamLocation = {
  franchID: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

export type ScoutReportInputs = {
  city: string;
  state: string;
  franchID?: string;   // optional override; otherwise inferred from hometown
};

export type ReportSection = {
  kind: "hometown" | "persona" | "comp" | "narrative" | "legacy";
  title: string;
  body: React.ReactNode;
};
