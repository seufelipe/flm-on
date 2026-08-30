import type { CinemaId } from "./scrapers/types";

export const CINEMA_LABEL: Record<CinemaId, string> = {
  lighthouse: "Light House",
  ifi: "IFI",
  cineworld: "Cineworld",
};

export const CINEMA_LOCATION: Record<CinemaId, string> = {
  lighthouse: "Smithfield",
  ifi: "Temple Bar",
  cineworld: "Parnell St",
};

export const CINEMA_ORDER: CinemaId[] = ["lighthouse", "ifi", "cineworld"];
