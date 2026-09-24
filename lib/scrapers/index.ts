import { lighthouseAdapter } from "./lighthouse";
import { ifiAdapter } from "./ifi";
import { cineworldAdapter } from "./cineworld";
import type { CinemaAdapter } from "./types";
import { PAUSED_CINEMAS } from "@/lib/cinemas";

export const adapters: CinemaAdapter[] = [lighthouseAdapter, ifiAdapter, cineworldAdapter].filter(
  (a) => !PAUSED_CINEMAS.has(a.id),
);
