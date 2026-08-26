import { lighthouseAdapter } from "./lighthouse";
import { ifiAdapter } from "./ifi";
import type { CinemaAdapter } from "./types";

export const adapters: CinemaAdapter[] = [lighthouseAdapter, ifiAdapter];
