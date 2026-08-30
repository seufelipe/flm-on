export type CinemaId = "lighthouse" | "ifi" | "cineworld";

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
  // Raw per-session descriptors the cinema attaches to a specific showtime — "Parent and Baby",
  // "Dubbed", "Subtitled", "Open Captioned", "35mm", "IMAX", "Tamil", "Big Screen Classics"…
  // Stored verbatim (adapters normalise their cinema-specific tokens onto these shared labels);
  // lib/screeningTags.ts / lib/formats.ts / lib/languages.ts each decide which ones surface in
  // the UI and how they're labelled. Undefined for an ordinary screening.
  screeningTags?: string[];
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
