export interface Driver {
  driverId: number;
  driverRef: string;
  number: number | null;
  code: string | null;
  forename: string;
  surname: string;
  dob: string | null;
  nationality: string;
  url: string;
}

export interface DriverCareer extends Driver {
  wins: number;
  podiums: number;
  poles: number;
  championships: number;
  starts: number;
  points: number;
  debutYear: number | null;
  lastYear: number | null;
  seasonsCount: number;
  teamRef: string;
  teamName: string;
  teamColor: string;
  active: boolean;
}

export interface Constructor {
  constructorId: number;
  constructorRef: string;
  name: string;
  nationality: string;
  url: string;
}

export interface ConstructorCareer extends Constructor {
  wins: number;
  podiums: number;
  championships: number;
  starts: number;
  points: number;
  firstYear: number | null;
  lastYear: number | null;
  seasonsCount: number;
  driversCount: number;
  color: string;
  active: boolean;
  championYears: number[];
  drivers: Driver[];
}

export interface Circuit {
  circuitId: number;
  circuitRef: string;
  name: string;
  location: string;
  country: string;
  lat: number | null;
  lng: number | null;
  alt: number | null;
  url: string;
}

export interface CircuitCareer extends Circuit {
  races: number;
  firstYear: number | null;
  lastYear: number | null;
  color: string;
}

export interface Race {
  raceId: number;
  year: number;
  round: number;
  circuitId: number;
  name: string;
  date: string;
  time: string | null;
  url: string;
}

export interface Result {
  resultId: number;
  raceId: number;
  driverId: number;
  constructorId: number;
  number: number | null;
  grid: number;
  position: number | null;
  positionText: string;
  positionOrder: number;
  points: number;
  laps: number;
  time: string | null;
  milliseconds: number | null;
  fastestLap: number | null;
  rank: number | null;
  fastestLapTime: string | null;
  fastestLapSpeed: string | null;
  statusId: number;
}

export interface EnrichedResult extends Result {
  driver: Driver | null;
  constructor: Constructor | null;
  status: string;
  teamColor: string;
}

export interface Qualifying {
  qualifyId: number;
  raceId: number;
  driverId: number;
  constructorId: number;
  number: number | null;
  position: number;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface Status {
  statusId: number;
  status: string;
}

/** One row of the compact `season_standings.csv`. */
export interface SeasonStanding {
  year: number;
  driverId: number;
  position: number;
  points: number;
  wins: number;
  constructorId: number;
}

/** One row of the compact `season_constructor_standings.csv`. */
export interface SeasonConstructorStanding {
  year: number;
  constructorId: number;
  position: number;
  points: number;
  wins: number;
}

export interface DriverSeasonRow {
  year: number;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  races: number;
  teamRef: string;
  teamName: string;
  teamColor: string;
}

export interface StandingsRow {
  position: number;
  points: number;
  wins: number;
  driver?: Driver;
  constructor?: Constructor;
  teamColor: string;
}

export interface RaceWithResults {
  race: Race;
  circuit: Circuit | null;
  results: EnrichedResult[];
  podium: EnrichedResult[];
  fastestLap: EnrichedResult | null;
  qualifying: (Qualifying & { driver?: Driver; constructor?: Constructor })[];
}

export interface ChampionRow {
  year: number;
  driver: Driver | null;
  constructor: Constructor | null;
  teamColor: string;
  points: number;
  wins: number;
}

export interface RivalSeason {
  year: number;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
}

export interface RivalryData {
  driverId: number;
  driver: Driver | null;
  driverName: string;
  teamColor: string;
  seasons: RivalSeason[];
}

export interface ArchiveMeta {
  generatedAt: string;
  startYear: number;
  endYear: number;
  /** ISO date the archive was last reconciled with the live season. */
  dataThrough: string;
  /** Date of the most recent race that actually has results. */
  latestRaceDate: string;
  /** Seasons whose championship is decided. The live season is never listed. */
  completeYears: number[];
  currentYear: number;
  counts: {
    drivers: number;
    constructors: number;
    circuits: number;
    races: number;
    results: number;
    qualifying: number;
    seasons: number;
  };
  source?: { archive: string; current: string };
}

/** One scheduled round, whether or not it has been run yet. */
export interface SeasonRound {
  race: Race;
  circuit: Circuit | null;
  complete: boolean;
}

/** Calendar + championship state for a single season. */
export interface SeasonSummary {
  year: number;
  complete: boolean;
  roundsTotal: number;
  roundsCompleted: number;
  standings: StandingsRow[];
  constructorStandings: (SeasonConstructorStanding & { constructor?: Constructor; color: string })[];
  leader: StandingsRow | null;
  champion: StandingsRow | null;
  latestRace: RaceWithResults | null;
  nextRace: SeasonRound | null;
}
