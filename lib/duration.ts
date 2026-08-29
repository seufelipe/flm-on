// The line between a "short" and a feature, for the settings-panel "hide short films" toggle.
// 40 min is the common festival cut-off; in practice the only sub-40 titles the two cinemas
// programme are IFI's "Archive at Lunchtime" strands (~24–35 min). A film with no listed
// runtime is never treated as short — don't hide something you can't measure.
export const SHORT_FILM_MAX_MINS = 40;

export function isShortFilm(durationMins: number | undefined): boolean {
  return durationMins !== undefined && durationMins < SHORT_FILM_MAX_MINS;
}
