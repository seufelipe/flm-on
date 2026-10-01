---
paths:
  - "lib/preferences.ts"
  - "lib/upcoming.ts"
  - "lib/groupings.ts"
  - "lib/highlights.ts"
  - "components/ScreeningBrowser.tsx"
  - "components/SettingsPanel.tsx"
  - "components/PreferencesButton.tsx"
  - "components/ActivePreferenceNote.tsx"
  - "components/FilterControls.tsx"
  - "components/Masthead.tsx"
  - "data/upcoming.json"
---

# Preferences, lenses, the Next-week preview and the This-week sections

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

## Map

- `lib/groupings.ts` — `groupByFilm`, case/whitespace-insensitive across cinemas *and* dates, so
  one film = one card with many pills.
  `partitionFilmSections` splits that list under the This-week view's headings — a festival
  strand first (#27), then "New this week" / "Also on" (#26).
- `lib/highlights.ts` — `isHighlight`: the single definition of "interesting". Gates the
  "Specials, etc" lens (#14) *and* ranks the empty-plan seeds.

## Decisions

14. **Settings panel — persisted viewing preferences** (`lib/preferences.ts`; the other persisted
    store is the plan, #5). Cinemas / timeframes maps, `hideShortFilms` (**defaults on**),
    `kidsOnly`, `language`. Read via `useSyncExternalStore` so SSR and the first client render
    agree. Full model: `docs/decisions/preferences-and-lenses.md`.
    - **A standing pre-filter over browsing, not over your plan.** `preferred` carves the dataset
      down before anything else derives from it; the saved plan is the exception (#5). When a
      preference pins a group to one value, that filter-bar control isn't rendered at all.
    - **Cineworld defaults off**, including for a blob saved before the key existed.
    - **The Highlights toggle ("Specials, etc") is ephemeral `useState`, not a saved preference.**
      It is also what keeps Cineworld's ordinary multiplex programme out of view (#16). An
      open-captioned session counts toward it; a plain subtitle track on an English film does not.
    - **`normalize` is a pure deep-merge onto `DEFAULT_PREFERENCES`** that coerces bad types and
      drops unknown keys — the forward-compat seam.
    - **Cinemas and Times each require ≥1 on**; the last one locks, keeping the selected look with
      a no-op click — not a greyed disabled state (#7).
    - ⚠️ **The desktop filter-bar wrapper is opaque `bg-bg`, not `backdrop-blur`.**
      `backdrop-filter` makes it a containing block for the `position: fixed` `SettingsPanel` and
      traps the modal inside the sticky strip.
    - An active **kids-only / language** preference is surfaced on the title by
      `ActivePreferenceNote`, never as a count (#8). Cinemas / times / hide-shorts get no
      indicator.

18. **"Next week" preview — the unconfirmed tease** (`lib/upcoming.ts`, `data/upcoming.json`). A
    trailing "Next week (maybe)" affordance on the day picker swaps the whole view for **cards
    only, no session pills** (`FilmCard preview`) — the sessions aren't confirmed. `nextWeek` is
    ephemeral state like the Highlights lens; the Time / Cinema / Specials controls and the plan
    tools hide while it's on. Reasoning: `docs/decisions/preferences-and-lenses.md`; how the file
    is written and trimmed: `fetch-films` skill.
    - It re-applies the cinema / kids-only / language preferences, not time / hide-shorts, and
      shows **no count** (#8).
    - The segment renders only when `data/upcoming.json` has films, and stays a plain toggle only
      when there are no visible days at all — so the preview can never dead-end.

26. **"This week" leads with what's new** (`lib/groupings.ts` `partitionFilmSections`, the `newFilms`
    array in `data/showtimes.json`). The list splits under two centred plain-text headings —
    **"New this week"** then **"Also on"** — so the week opens on what you haven't had the chance
    to see yet. Reasoning: `docs/decisions/preferences-and-lenses.md`.
    - **"New" is computed at fetch time, not derived in the browser.** `fetch:batch` already
      diffs the incoming week against the last published one (`lib/filmDiff.ts`); it now writes
      `diff.added`'s keys into the staged data as `newFilms: string[]`, keyed like
      `FilmGroup.key`. The app has only one week of data, so it could never work this out itself.
    - **A mid-week re-run carries the list forward.** Its baseline is the week we *just*
      published, so `added` comes back near-empty and every film that was new on Thursday would
      silently stop being new. When `days[0]` hasn't moved, `fetch:batch` unions the committed
      `newFilms` into the new one.
    - **Headings only when there are at least two sections.** Nothing new, or *everything* new
      (a first run against an empty baseline), collapses to one unlabelled list — a heading over
      the whole list says nothing. `partitionFilmSections` owns that rule, which is why it's in
      `lib/` with tests rather than inline in the component.
    - **"This week" only.** A pinned day keeps its chronological order — reading in time order is
      the point of pinning a day — and the Next-week preview is untouched. Chronological ordering
      across a whole week is only ever "whoever plays Monday", which is what makes this the view
      with room for a better answer.
    - The headings are `<h2>` (cards are `<h3>`), centred, in the masthead tagline's voice
      (`font-bold text-dim uppercase text-sm tracking-widest`), each led by a lucide icon —
      `Popcorn` for new, `CupSoda` for the rest — `size-[1em]` and `aria-hidden` like every other
      labelling mark (#23). No container, no rule, no count (#8). Two spacing details that look
      like tidy-up bait: the second heading carries an extra `mt-8` on top of the list's own
      `gap-8` (without it the seam reads exactly like the gap between two cards and the split
      stops doing any work), and the row carries `-mr-[0.2em]` to pull back the trailing
      letter-space `tracking-widest` leaves after the last letter, which otherwise sits the
      icon+text pair visibly right of centre.
