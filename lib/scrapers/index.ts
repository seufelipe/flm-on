import { lighthouseAdapter } from "./lighthouse";
import { ifiAdapter } from "./ifi";
import { cineworldAdapter } from "./cineworld";
import type { CinemaAdapter } from "./types";

export const adapters: CinemaAdapter[] = [lighthouseAdapter, ifiAdapter, cineworldAdapter];
