# Preferences, the Highlights lens, the Next-week preview and the New-this-week split

Decisions #14, #18 and #26 in full — the persisted viewing preferences and how they pre-filter
everything, the ephemeral "Specials, etc" lens, the unconfirmed next-week tease, and the two
headings that put new films at the top of "This week".
CLAUDE.md keeps the rules; this is the reasoning behind them.

Verbatim from CLAUDE.md, which now carries only the rules. **Read this before changing
anything it covers, and update it in the same commit** — the same discipline CLAUDE.md and
the `fetch-films` skill are under.

---

## Decision #14 — Settings panel — persisted viewing preferences (localStorage)

**Settings panel — persisted viewing preferences (localStorage).** One of two persisted
stores — the other is `lib/plan.ts` (`flm-on:plan`, the saved plan — decision #5), a separate
key with the same `useSyncExternalStore` + `normalize` shape.
`lib/preferences.ts`: `Preferences` = `cinemas` / `timeframes` maps +
`hideShortFilms` (**defaults on** — the archive strands are noise) + `kidsOnly` + `language`
(`"any"`/`"english"`/`"non-english"`). `normalize` is a pure deep-merge onto
`DEFAULT_PREFERENCES` that coerces bad types and drops unknown keys — the forward-compat seam
(a breaking change would branch on a stored `version`). **Cineworld defaults *off*** (Light
House + IFI are the everyday view; Cineworld is opt-in) — and a blob saved before the key
existed takes that default. Read via `useSyncExternalStore` so SSR + first client render
agree (no hydration warning); a `storage` listener syncs across tabs.
- **Model: standing pre-filter — over browsing, not over your plan.** `preferred` (memo in
  `ScreeningBrowser`) carves the dataset down before anything else derives from it (the
  exception is the saved plan itself, which resolves against `timedAll` — decision #5), so turning a cinema/time off just shrinks a
  `ControlGroup`'s option list and it collapses on its own. When a preference pins a group to
  one value the corresponding filter-bar control isn't rendered at all
  (`cinemaFilterUseful` / `timeFilterUseful`). Controls-only — pills still label their cinema.
- `lib/duration.ts` `isShortFilm` / `SHORT_FILM_MAX_MINS = 40` is **per-screening** (a mixed
  strand keeps only its long session); unknown runtime is never short. `kidsOnly` →
  `lib/certs.ts` `isKidFriendly` (IFCO `G`/`PG`/`12A` only; `15A`+ and *no listed cert*
  excluded).
- **The Highlights toggle** ("Specials, etc", wearing `<SpecialsMark>`) is a filter-bar `useState`, **not** a saved
  preference — ephemeral, first in the bar (the lens reached for most). On → `preferred`
  keeps only screenings that are a surfaced special / a film format / a **non-English
  original language** (`hasNonEnglishLanguage`) / an **open-captioned session**
  (`hasOpenCaptions`) / a `film-labels.json` film. The two caption cases split here, and the
  split is the point: open captions are burned in, there are a handful a week, and the people
  who need them go looking for them specifically — which is exactly the test this lens
  applies, so they count (user's call, reversing the original rule). A plain subtitle track on
  an English film is neither scarce nor sought, so it still doesn't. This is also what keeps
  Cineworld's ordinary multiplex programme
  out of view (decision #16) — with it off and Cineworld on, you get the full slate. The
  empty-state Reset clears prefs **and** this toggle.
- UI: `PreferencesButton` (Lucide `Settings2`, which draws sliders not a gear — no badge) → `SettingsPanel` (responsive
  modal / bottom sheet). Sits in the desktop filter bar (`FilterControls layout="bar"`) and,
  on mobile, top-right of the masthead. **The desktop filter-bar wrapper is opaque `bg-bg`,
  not `backdrop-blur`** — `backdrop-filter` would make it a containing block for the
  `position: fixed` `SettingsPanel` and trap the modal inside the sticky strip. An active
  **kids-only** or **language**
  preference (the two that narrow the films with no filter-bar trace) is surfaced instead by
  `components/ActivePreferenceNote.tsx`, layered on the "FLM ON" title (its wrapper is
  `relative w-fit`): **kids-only** → a `MarqueeSticker` (`tone="accent" tilted`, the one
  status use of the accent) `absolute`-positioned at an angle over the top-right of the
  title, lowercase `for kids!`, as if a kid stuck it on; **language** → two *static* dark
  pills (one
  per line, each hugging its own text, sentence-case) stacked and centred on the logo,
  pulled up so they sit over the base of the title: `Only films` / `in english` (or
  `not in english`). Both can show at once. Cinemas / times / hide-shorts get no indicator.
  Options are toggle
  buttons in `controlSegment.ts` style; the **Language** group is a `Segmented` single-select
  (flush, same treatment as the filter bar) where **pressing the option you're already on
  reverts to the default** (`any`) — the same gesture as a filter-bar control, rather than a
  dead click. Each group is one non-wrapping full-bleed
  `overflow-x-auto` strip (the film-card pill idiom) — options scroll sideways rather than
  stacking on a narrow screen. Cinemas + Times each require ≥1 on — the last
  remaining one locks (keeps the selected look, click is a no-op — not a greyed disabled
  state, decision #7).

---

## Decision #18 — "Next week" preview — the unconfirmed tease

**"Next week" preview — the unconfirmed tease** (`lib/upcoming.ts`, `data/upcoming.json`).
The day picker's **trailing "Next week (maybe)" affordance** (`ScreeningBrowser` — it
*replaces* the old Wednesday-only "Come back Tomorrow!" note; `nextBatchLabel` is no longer
used in the UI): on the mobile **dock** a trailing segment on the Day `ControlGroup`, on the
desktop **bar** the `footer` row of the Day `FilterMenu`.
Pressing it (`nextWeek` state, ephemeral like the Highlights lens) swaps the whole view for a
short list of films coming *next* week, rendered **cards only, no session pills** (`FilmCard
preview` — the sessions aren't confirmed) under a "the full list lands Thursday" banner. You
leave by tapping a day / "This week" (which is why the mobile sole-day segment goes
interactive here — decision #7); it's non-interactive / the selected row once it's the view
you're on. Only if there are no visible days at all (stale data) does it stay a plain toggle
so the preview can't dead-end. The Time / Cinema / "Specials, etc" controls and the
plan/combo tools are hidden while it's on (the desktop plan rail too, unless the plan is
non-empty).
- **Source:** `fetch:batch` writes `data/upcoming.json` (`{ generatedAt, week, films }`) from
  a second scrape of next week, then it's **hand-trimmed** during the weekly review — same
  batch-writes / human-trims / build-time-read pattern as `data/film-labels.json`, and not
  staged or promoted. Selection rules and the trimming order: `fetch-films` skill.
- `app/page.tsx` reads it at build (`loadUpcoming`), passes `upcoming` / `upcomingWeek` to
  `ScreeningBrowser`; `upcomingVisible` re-applies the cinema / kids-only / language
  preferences (not time / hide-shorts) — no length cap, the committed file is already
  hand-trimmed to a teaser list (**no count shown** — decision #8). The "Next week" segment
  only renders when `data/upcoming.json` has films. A film shows if *any* enabled cinema
  plays it, and its film-page links are filtered to the enabled cinemas (each `cinemaLinks`
  entry carries its `cinema` id for this) — matching a regular card. The card's merged
  `screeningTags` stay film-level (no per-cinema split), so a format/strand tag from a
  muted cinema can still ride along; harmless for a session-less tease and none of the
  surfaced ones render visibly without a pill.
- `FilmCard preview`: header + meta line + `FilmNotes` + the film-page/Letterboxd footer,
  no showtime section at all. The label is the live `film-labels.json` value
  (`labels?.[key] ?? f.label`), so a label edit + rebuild updates it like any card.
- **Coverage caveat:** Light House only exposes 9 days out, so next-week coverage leans on
  Cineworld + IFI.

---

## Decision #26 — "This week" leads with what's new

### The problem it answers

"This week" was sorted chronologically, same as a pinned day — a film's position in the list
came from its earliest screening. On a pinned day that's exactly right: the list reads as your
day. Across a whole week it's close to meaningless. It says "this one plays on Monday", which is
nobody's reason for choosing a film, and it buries a one-off première under a wide release that
happens to have an early-week matinee.

The thing the user actually scans a week for is what they haven't had a chance to see yet. So
that's what the week now opens on.

### Why the signal has to come from the pipeline

The app has exactly one week of data. It has no way to know whether a film is new — a film in
its third week and a film opening Thursday look identical in `showtimes.json`.

But the pipeline already knows. `lib/filmDiff.ts` has diffed each incoming week against the last
published one since the weekly-pipeline decision (#9), to print the NEW/GONE section that orients
the whole Thursday review. Nothing was persisting it. So `fetch:batch` now writes `diff.added`'s
keys into the staged data as a top-level `newFilms: string[]`, keyed like `FilmGroup.key`
(`title.trim().toLowerCase()`) — the same key `film-labels.json` and the override files use — and
`app/page.tsx` threads it to `ScreeningBrowser` exactly as it threads `labels`.

**The mid-week wrinkle.** A re-run on, say, a Saturday diffs against the week we published on
Thursday, so `added` comes back nearly empty — and a naive overwrite would quietly un-new every
film that was new two days earlier. Hence the carry-forward: when `days[0]` matches the committed
week's, `fetch:batch` unions the published `newFilms` into this run's additions. A genuinely new
week moves the window, so the list starts clean by itself with nothing to remember to reset.

**Known consequence:** a film that drops out for a week and comes back reads as new again.
That's arguably correct — it *is* newly available — and no cheap fix exists that doesn't mean
keeping a running history of every film ever published.

### Both headings or neither

(Since decision #27 a festival strand can add a section of its own ahead of these two; the rule
below generalised to "headings only when at least two sections have films".)

Three cases collapse back to a single unlabelled list, all handled in `partitionFilmSections`:

- nothing is new;
- **everything** is new — the first run against an empty baseline, or a week where the whole
  programme turned over;
- no `newFilms` at all; a pinned day and the Next-week preview opt out by passing no options.

The second is the interesting one: a "New this week" heading over a list with nothing under
"Also on" is a heading that distinguishes nothing. The rule lives in `lib/` rather than as a
condition in the component precisely so it can be tested — the component's whole rule is then
"a heading per section when there's more than one".

Order **within** each half is untouched, so `groupByFilm`'s chronological sort survives the
split; a stable partition, not a re-sort.

### The treatment

Two centred plain-text headings, `<h2>` (cards are `<h3>`, so the document outline is right and a
screen reader gets real landmarks), in the masthead tagline's voice: `font-bold text-dim uppercase
text-sm tracking-widest`. No container, no rule, no count (#8), no accent (#7) — the cards keep
the page and the heading just labels the region.

Each is led by a lucide icon (#23), `size-[1em]` and `aria-hidden`: `Popcorn` over the new films,
`CupSoda` over the rest. They're a pair from one scene rather than two unrelated glyphs, and the
concession stand is the only iconography in the app that belongs to *going* to the cinema rather
than to a film — which is the right register for a heading that isn't describing any film in
particular. Neither carries meaning a screen reader loses by skipping it; the heading text is the
label.

Two spacing details that both look like tidy-up bait and aren't. The row needs `-mr-[0.2em]`,
because `tracking-widest` adds letter-space *after* the last letter too, and centring a box that
includes that phantom space sits the visible icon+text pair noticeably right of centre. And the
second heading carries an extra `mt-8`: without it the seam between the two groups measures
exactly the same as the gap between two cards, and the split stops doing any work.

Rejected on the way: a per-card "new" marker on the `FilmNotes` sticker. It would have avoided a
new region in the list, but that sticker names *strands* and curated labels (#13), and "new"
is neither — and a marker repeated down eighteen cards is noisier than naming the group once.

