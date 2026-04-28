export interface Driver {
  driverId: number;
  driverRef: string;
  number: number | null;
  code: string | null;
  forename: string;
  surname: string;
  dob: string;
  nationality: string;
  url: string;
  championships?: number;
  wins?: number;
  podiums?: number;
  poles?: number;
  debutYear?: number;
}

export interface Season {
  year: number;
  url: string;
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
  number: string | null;
  grid: number;
  position: number | null;
  positionText: string;
  positionOrder: number;
  points: number;
  laps: number;
  time: string | null;
  milliseconds: string | null;
  fastestLap: number | null;
  rank: string | null;
  fastestLapTime: string | null;
  fastestLapSpeed: string | null;
  statusId: number;
}

export interface Constructor {
  constructorId: number;
  constructorRef: string;
  name: string;
  nationality: string;
  url: string;
}

export interface Circuit {
  circuitId: number;
  circuitRef: string;
  name: string;
  location: string;
  country: string;
  lat: number;
  lng: number;
  alt: number;
  url: string;
}

export interface DriverStanding {
  driverStandingsId: number;
  raceId: number;
  driverId: number;
  points: number;
  position: number;
  positionText: string;
  wins: number;
}

export interface Qualifying {
  qualifyId: number;
  raceId: number;
  driverId: number;
  constructorId: number;
  number: string | null;
  position: number;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface ChampionshipStanding {
  driverId: number;
  driverName: string;
  constructorName: string;
  points: number;
  position: number;
  wins: number;
  year: number;
}

export interface RivalryData {
  driverId: number;
  driverName: string;
  standings: SeasonStanding[];
}

export interface SeasonStanding {
  year: number;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
}