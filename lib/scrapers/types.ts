export type CinemaId = "lighthouse" | "ifi";

export interface Screening {
  cinema: CinemaId;
  cinemaName: string;
  filmTitle: string;
  cert?: string;
  durationMins?: number;
  durationEstimated?: boolean;
  year?: number;
  date: string; // ISO YYYY-MM-DD
  time: string; // "HH:MM" 24h
  bookingUrl: string;
  filmPageUrl?: string; // the cinema's own film detail page (not the booking flow)
  letterboxdUrl?: string;
}

export interface AdapterResult {
  screenings: Screening[];
  error?: string;
}

export interface CinemaAdapter {
  id: CinemaId;
  name: string;
  fetchScreenings(opts: { days: string[] }): Promise<AdapterResult>;
}
