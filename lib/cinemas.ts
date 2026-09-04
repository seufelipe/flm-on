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

// The LOCATION of a calendar event exported from the plan (decision #21) — a bare "Light House"
// gives a calendar nothing to navigate to.
//
// **These strings are exact, and the shape is load-bearing.** A calendar doesn't treat LOCATION as
// freeform text to print: it geocodes it, and only draws a map when the lookup resolves to a known
// place. That needs the venue's *registered* name on its own first line, then the canonical postal
// address, ending in the country. Written out longhand — "Cineworld Dublin", "Irish Film
// Institute", "6 Eustace Street", an extra "Temple Bar", no country — every one of them silently
// failed to resolve and the event showed no map. Verified by hand in Calendar, one cinema at a
// time. So: don't tidy these onto one line, don't expand the abbreviations, don't drop "Ireland",
// and don't reach for CINEMA_LABEL here — that's the app's short name, not the map's.
//
// Light House's is the thinnest of the three (its own site publishes no Eircode) and resolves off
// the venue name; if it ever stops, the next thing to try is ", Smithfield, Dublin 7, Ireland".
export const CINEMA_ADDRESS: Record<CinemaId, string> = {
  lighthouse: "Light House Cinema\nMarket Square",
  ifi: "Irish Film Institute (IFI)\n6 Eustace St, Dublin 2, D02 PD85, Ireland",
  cineworld: "Cineworld Cinemas\nThe Parnell Centre, Parnell Street, Dublin 1, D01 V4Y1, Ireland",
};

export const CINEMA_ORDER: CinemaId[] = ["lighthouse", "ifi", "cineworld"];
