export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  year: number;
}

export interface Session {
  session_key: number;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  circuit_key: number;
  circuit_short_name: string;
  country_key: number;
  country_code: string;
  country_name: string;
  location: string;
  gmt_offset: string;
  year: number;
}

export interface Driver {
  meeting_key: number;
  session_key: number;
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  country_code: string;
}

export interface LapData {
  meeting_key: number;
  session_key: number;
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
  segments_sector_1: number[];
  segments_sector_2: number[];
  segments_sector_3: number[];
  st_speed: number | null;
}

export interface PitStop {
  date: string;
  session_key: number;
  meeting_key: number;
  driver_number: number;
  lap_number: number;
  stop_duration: number | null;
  pit_duration: number | null;
}

export interface Stint {
  meeting_key: number;
  session_key: number;
  stint_number: number;
  driver_number: number;
  lap_start: number;
  lap_end: number;
  compound: TireCompound;
  tyre_age_at_start: number;
}

export type TireCompound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET";

export interface CarData {
  date: string;
  session_key: number;
  meeting_key: number;
  driver_number: number;
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  n_gear: number;
  drs: number;
}

export interface Position {
  date: string;
  session_key: number;
  meeting_key: number;
  driver_number: number;
  position: number;
}

export interface Weather {
  date: string;
  session_key: number;
  meeting_key: number;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_direction: number;
  wind_speed: number;
}

export interface RaceControlMessage {
  meeting_key: number;
  session_key: number;
  date: string;
  driver_number: number | null;
  lap_number: number | null;
  category: string;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  message: string;
}

export interface TeamRadio {
  meeting_key: number;
  session_key: number;
  driver_number: number;
  date: string;
  recording_url: string;
}

export interface LocationSample {
  session_key: number;
  meeting_key: number;
  driver_number: number;
  date: string;
  x: number;
  y: number;
  z: number;
}

export interface Interval {
  session_key: number;
  meeting_key: number;
  driver_number: number;
  date: string;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}
