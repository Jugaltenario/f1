/** Raw shapes returned by https://api.openf1.org/v1 (2023 → present). */

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  meeting_key: number;
  circuit_key: number;
  circuit_short_name: string;
  country_code: string;
  country_name: string;
  location: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  year: number;
  is_cancelled: boolean;
}

export interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  location: string;
  country_name: string;
  country_code: string;
  country_flag: string;
  circuit_key: number;
  circuit_short_name: string;
  circuit_type: string;
  circuit_image: string;
  circuit_info_url: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  year: number;
  is_cancelled: boolean;
}

export interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
  headshot_url: string;
  session_key: number;
  meeting_key: number;
  country_code: string | null;
}

export interface OpenF1SessionResult {
  position: number;
  driver_number: number;
  number_of_laps: number;
  points: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | number[] | null;
  gap_to_leader: number | string | null;
  meeting_key: number;
  session_key: number;
}

export interface OpenF1ChampionshipDriver {
  driver_number: number;
  position_start: number;
  position_current: number;
  points_start: number;
  points_current: number;
  meeting_key: number;
  session_key: number;
}

export interface OpenF1ChampionshipTeam {
  team_name: string;
  position_start: number;
  position_current: number;
  points_start: number;
  points_current: number;
  meeting_key: number;
  session_key: number;
}

export interface OpenF1Interval {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Position {
  date: string;
  driver_number: number;
  position: number;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Lap {
  driver_number: number;
  lap_number: number;
  date_start: string;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  is_pit_out_lap: boolean;
  lap_duration: number | null;
  st_speed: number | null;
  session_key: number;
  meeting_key: number;
  segments_sector_1?: number[];
  segments_sector_2?: number[];
  segments_sector_3?: number[];
}

export interface OpenF1Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string;
  tyre_age_at_start: number;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Pit {
  date: string;
  driver_number: number;
  lap_number: number;
  lane_duration: number | null;
  stop_duration: number | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1RaceControl {
  date: string;
  category: string;
  driver_number: number | null;
  flag: string | null;
  lap_number: number | null;
  message: string;
  scope: string | null;
  sector: number | null;
  qualifying_phase: number | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Weather {
  date: string;
  air_temperature: number | null;
  track_temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  rainfall: number;
  wind_direction: number | null;
  wind_speed: number | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1CarData {
  date: string;
  driver_number: number;
  speed: number;
  rpm: number;
  n_gear: number;
  throttle: number;
  brake: number;
  drs: number | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Location {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
  session_key: number;
  meeting_key: number;
}

/** A driver row joined with the timing data needed by the live board. */
export interface LiveDriverRow {
  position: number;
  driver: OpenF1Driver;
  interval: number | string | null;
  gap: number | string | null;
  laps: number;
  stint: OpenF1Stint | null;
  lastLap: number | null;
  bestLap: number | null;
  pitStops: number;
  color: string;
  inPit: boolean;
}
