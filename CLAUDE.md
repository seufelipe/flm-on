@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts). Combines showtimes from **Light House Cinema**,
**IFI** and **Cineworld Dublin** — all scraped in full — into one place, with tools to plan a day
at the cinema, from a double bill up to back-to-back screenings. Cineworld is off by default and,
when on, its ordinary multiplex programme is hidden by the "Specials, etc" lens unless you ask
for it (decisions #14, #16). Built entirely through conversation with the user; this file exists
so a future session can pick up without re-deriving the reasoning.

**Public deploy runs on a weekly curated pipeline, not live scraping** (decision #9): a
manually-run script fetches the week, prints a plain-text report to review, and confirming
promotes it to the one committed data file the deployed app reads statically.

**Where the rest of it is.** This file is the rules and a map; the reasoning behind them was
moved out to keep it loadable every session. `docs/architecture.md` — the component-by-component
notes. `docs/decisions/{plan,visual-language,ui-primitives,screening-tags,preferences-and-lenses}.md`
— each decision in full, named from its entry below. The `fetch-films` skill — the weekly pipeline,
the three cinemas, and every `data/` override file. **Read the relevant one before changing
anything it covers.**

**Before any layout change, sketch the proposed result as ASCII and get sign-off first** — the
user iterates on layout a lot and wants to see the shape before code. This covers anything that
moves, resizes, reflows, merges or splits regions (columns, cards, bars, headers, panels), not
one-off spacing tweaks.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, cheerio (Light House / IFI HTML; Cineworld is
a JSON API), vitest. Component primitives are Radix, vendored in via neobrutalism.dev's shadcn
registry and restyled to our own tokens (decision #22) — with `class-variance-authority`, which
those files' `cva` variant maps need — plus vaul for the mobile drawers (#24);
icons are lucide-react (#23). No database. Committed in `data/`: `showtimes.json` (the published week) and
the curated override / editorial files (`title-overrides`, `letterboxd-overrides`, `film-labels`,
`hidden-films`, `language-overrides`, `director-overrides`); everything else in `data/` is
gitignored cache/staging.

## Architecture

A map, not the full notes. **`docs/architecture.md` has the component-by-component detail** —
read it before working on a component you haven't touched before.

### Data pipeline (server-only, weekly — `app/page.tsx` never runs it)

Runs only from `npm run fetch:batch`, i.e. once a week: `lib/scrapers/` → `lib/aggregate.ts` →
`scripts/fetch-batch.ts` (staging + review report) → `scripts/confirm-batch.ts` (promote).

**The whole of it lives in the `fetch-films` skill** — `reference/pipeline.md` for the modules and
the order they run in, `reference/cinemas.md` for the three cinemas, `SKILL.md` for the weekly
procedure. It's out of context here on purpose: it's a weekly ritual, not something a UI change
touches. Load the skill before editing any of those files, any `data/` override file, or before
debugging a wrong title / year / language / director — don't work from what's left here.

What the **UI** derives from its output:

- `lib/groupings.ts` — `groupByFilm`, case/whitespace-insensitive across cinemas *and* dates, so
  one film = one card with many pills.
- `lib/clash.ts` — **absolute-ordinal minutes** (`toOrdinalMinutes`), so gap maths is a plain
  subtraction across days (#5). `itineraryTransitions` (gap / overlap / too-tight / `crossDay`,
  no max cap) and the one suggestion engine `planAdditions`, read two ways: `fittingAdditions`
  (`bookingUrl → tightness`, for the card pills) and `bestAdditionPerSlot` (one tightest fit per
  open slot, for the plan's ghost rows).
- `lib/highlights.ts` — `isHighlight`: the single definition of "interesting". Gates the
  "Specials, etc" lens (#14) *and* ranks the empty-plan seeds.
- `lib/startingPoints.ts` — what an **empty** plan offers: one screening per timeframe, specials
  first, each film only once (#5).
- `lib/calendar.ts` — `planToICS`, pure and DOM-free; the browser half is
  `ScreeningBrowser.exportPlan` (#21).
- `app/page.tsx` — server component, reads `data/showtimes.json` directly. Static per deploy (#3).

### `Screening.screeningTags: string[]` — the shared per-session vocabulary

Raw descriptors on a showtime, read by three sibling modules. Sources: Light House
`em.additional`, IFI format `svg[data-icon]`s, Cineworld's normalised API tags (#16), plus
`aggregate` appending the per-film Letterboxd language (#17) and `ScreeningBrowser` attaching a
synthetic `Mystery Matinee` at render time (#12).

- `lib/screeningTags.ts` — `displayScreeningTags` → surfaced strands, each
  `{ label, title, description, mark? }`. `KNOWN` is the gate, `UNSURFACED`/`isUnsurfacedTag` the
  deliberate opposite (read only by the batch report). #13.
- `lib/formats.ts` — `displayFilmFormats` → `35mm` / `70mm` / `IMAX`. #15.
- `lib/languages.ts` — `displayLanguage` → `{ language?, subtitled, openCaptioned, dubbed } | null`;
  `matchesLanguagePref` for the Language preference. #17.
- `lib/screeningTooltip.ts` — the three modules' `*Tooltip` helpers merged into one ` · `-joined
  string. **The single copy**, used by the card pills and by both plan rows' `aria-label`; the meta-line format box
  keeps `filmFormatsTooltip` alone, since it explains only itself.

### UI (all client, under `ScreeningBrowser`)

- `ScreeningBrowser.tsx` — the interactive core: the Day/Cinema/Time filters, the `preferred`
  pre-filter (#14), the persisted plan (#5), and the ephemeral `highlightsOnly` / `nextWeek` /
  `dismissed` / `planCleared` state. Two-column shell is a bare `lg:grid` — right rail
  (`<Masthead>` + sticky `<PlanPanel>`), left column (sticky `FilterControls` + film list).
- `FilterControls.tsx` — both filter-bar shapes, `layout="dock"` (mobile) and `"bar"` (desktop),
  off one `effective*` + `setActive*` prop bag (#7). Also `DayMark`, and the "Next week"
  affordance (#18).
- `FilmCard.tsx` — one film's card: title line (`[original title] TITLE [year]` + the `FilmNotes`
  sticker), meta line (cert, duration, director, `<LanguageTag>`, format boxes), pills grouped by
  day then timeframe, and a `no-print` footer of cinema film-page links + the Letterboxd mark.
  ⚠️ Each day's pill strip is one non-wrapping `overflow-x-auto` row and **needs `relative`** —
  the pills' `position:absolute` `.sr-only` spans otherwise escape the clip and give the whole
  page a phantom horizontal scrollbar.
- `FilmNotes.tsx` + `MarqueeSticker.tsx` — the **one** dark scrolling sticker per card, carrying
  the strand name(s) and the curated label joined by ` · `. The sticker *names* a strand; its
  tooltip *explains* it, and a label-only card gets no tooltip at all. ⚠️ `MarqueeSticker`
  measures one copy and pins the track to `2×` that width **in px**, so the keyframe's plain
  `translate3d(-50%…)` lands exactly on one copy — a var-free keyframe runs on the compositor,
  where a `%`-of-`max-content` translate stutters. `--color-fg`/`--color-bg`, never accent;
  reduced-motion → static.
- `ScreeningTags.tsx` / `FilmFormats.tsx` / `ScreeningLanguage.tsx` — the pill/card renderers for
  the three readers above, plus `<SpecialsMark>`. `<LanguageTag>` measures its own text box and
  draws the bubble as one continuous SVG `<path>` (the box model can't miter a horizontal border
  into a 45° tail arm).
- `PlanRow.tsx` — `<PlanRow>` (solid, a pick, click removes) and `<GhostRow>` (dashed, a
  suggestion, click adds). Neither carries an affordance glyph (#7), and **neither shows a
  tooltip** — `screeningTooltip` goes on the `aria-label` only (a tooltip per row flickered down
  a list you've already chosen from, and the mobile sheet can't open one anyway). Don't add one
  back without asking.
- `PlanPanel.tsx` / `PlanButton.tsx` / `DayPlan.tsx` — the one persistent plan surface (desktop
  rail, mobile floating button + sheet), the per-day grouping with its transition labels, and the
  slot ghost rows. A ghost **replaces the real transition label of its slot**: you see the two
  gaps you'd have, not the one you have.
- `Masthead.tsx`, `ActivePreferenceNote.tsx`, `PreferencesButton.tsx` + `SettingsPanel.tsx`,
  `CinemaWeekendBanner.tsx` — the title and the things layered on it (#14, #19), and the
  preferences overlay. `PreferencesButton` sits in the desktop filter bar and, on mobile, the
  masthead.
- `controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass(active)`, the selected-segment
  styling shared by the filter bar and the settings panel.
- **The four notes over the film list are all one `<Alert>`** — the Cinema Weekend banner (#19),
  "Next week (maybe)" (#18) and the two empty states, each led by a lucide icon in the gutter.
  **The two banners pass `role="note"`; only the two empty states keep the default
  `role="alert"`** — an assertive live region belongs to a note that appears *in answer to*
  something you just did, not to standing page furniture.
- `components/ui/` — vendored shadcn/Radix primitives, restyled to our tokens (#22): `tooltip`,
  `dialog` (the modal half of both overlays), `dropdown-menu`, `alert`, and vaul's `drawer` (#24).
  `lib/utils.ts` holds `cn`.

## Decisions worth knowing before changing anything

Each entry is the **rule** plus enough of the why that a future session can't tidy it away. The
full reasoning — what was tried, what was rejected, the worked examples — lives in
`docs/decisions/` and in the `fetch-films` skill. **Read the named file before changing anything
it covers, and update it in the same commit.**

1. **Light House multi-day data is fetched from an endpoint its `robots.txt` disallows.**
   Justified **only** because this is one deliberate fetch a week from a manual script
   (decision #9), not per-visitor scraping — so a return to a live per-request model has to
   revisit it. Which endpoint and why it's the only way: `fetch-films` skill.

2. **Cinema-reported titles and years are not trustworthy.** Which cinema lies about what, and
   the strand-aware model that's still wanted: `fetch-films` skill. What it means here is that
   the curated override files and the weekly human review are load-bearing, not belt-and-braces.

3. **`app/page.tsx` is static, not `force-dynamic`.** It reads the committed `showtimes.json`;
   content changes only on redeploy. Don't reintroduce `force-dynamic` unless the page goes back
   to calling the live pipeline at request time.

4. **Letterboxd is the source of truth for a film's own facts.** The matched page supplies the
   **year the UI shows** (not the cinema's — so `Kiki's Delivery Service` reads 1989, not 2026),
   the primary language (#17), the original title, and the director(s) on the card's meta line.
   How a link is resolved, how that fails, and how to pin a bad match: `fetch-films` skill.

5. **A plan can span the week; it persists** (`lib/plan.ts`, `flm-on:plan` localStorage;
   `lib/clash.ts`; `lib/startingPoints.ts`). Any number of screenings across any number of days,
   surviving reloads — coming back to it is the point of week-planning.
   Reasoning: `docs/decisions/plan.md`.
   - **The plan resolves against reality, the suggestions against your preferences.**
     `dayPlanItems` / `effectiveSelectedKeys` read `timedAll`, **not** `preferred`, so muting a
     cinema or flipping the Highlights lens never prunes a confirmed pick; only the day passing,
     the session starting (plus the grace, #20) or the screening leaving `showtimes.json` does.
     Get this wrong and `toggleSelected` writes the pruned set back — the pick is gone for good.
   - **Times are absolute-ordinal minutes** (`toOrdinalMinutes`), so every gap calc is
     multi-day-correct and a past-midnight end doesn't wrap. A day boundary is `crossDay`,
     rendered as the next day's header, never as a gap.
   - **Suggestions are one mechanism and they live inside the plan** — one dashed ghost per open
     slot (`planAdditions` → `bestAdditionPerSlot`), taken with the same gesture as tapping a
     pill. **Never suggest a film already in the plan on *any* day**, nor one taken back out this
     session (`dismissed`); `Clear` also silences the empty-plan seeds (`planCleared`). Both are
     ephemeral — a persisted "never show me this" with no UI to review or undo it is a trap.
   - **An empty plan has no slots, so it seeds instead** (`startingPoints`): one ghost per
     timeframe, specials first, no heading over them. On "This week" each names its own day.
   - Tapping a showtime just adds it — the Day filter does **not** snap to it.
   - None of the suggestion muting feeds the card-pill "wouldn't fit" fade, and that fade only
     applies on days the plan already touches.

6. **A screening's identity key is its `bookingUrl`.** Real listings can have two distinct
   bookable sessions for the same film at the same time. (They currently render as near-identical
   pills with no format label — a known minor gap.)

7. **Visual design: "chunky", not brutalist** (user's explicit call, ref inkwellgames.com). Warm
   cream page, near-white card, warm near-black ink, rounded corners, hard offset shadows; all
   tokens in the `@theme` block of `app/globals.css`.
   Palette, shadow model and control mechanics in full: `docs/decisions/visual-language.md`.
   - **Accent reservation:** the one accent (`--color-accent`, gold) is for actionable things, the
     current selection, and exactly one status use (the "for kids!" sticker, #14) — never plain
     decoration. Two non-ink/gold exceptions, both third-party brand identities: the Letterboxd
     mark and IMAX blue.
   - **`--shadow-chip` is a 6px total reach**, the resting elevation of pills and filter segments;
     pressed/selected translate a matching 6px, hover is a 3px half-press.
   - **Segmented controls:** each segment its own border + shadow, `-ml-0.5` merges adjacent
     borders, only end segments round outward, and every segment needs an explicit `relative` +
     ascending inline `z-index` (the active one's `translate` makes a stacking context). **No
     disabled variant** — drop the segment, or make it non-interactive. Don't reintroduce a
     greyed-out state without asking.
   - **Two filter-bar shapes** (`FilterControls`, chosen by `layout`): `"dock"` is the mobile
     flush segmented row, `"bar"` the desktop `FilterMenu` dropdowns. A full week of day chips is
     far too many flush segments for a bar that isn't pinned to a screen edge.
   - **The Place filter's "any" option names the cinemas it covers** ("3 cinemas"), counted from
     *preferences*, not from what's on. Not "Anywhere" — a promise the filter can't keep.
   - `body { cursor: default }` (an app, not a document); interactive elements set
     `cursor-pointer`, and the film *name* opts back into `cursor-text`.

8. **No film-count / progress UI.** A counter was tried and rejected — the user said counters
   "add pressure". No running counts or badges in the main UI without asking. The three sanctioned
   exceptions all count **your own plan or preferences**, never the catalogue: `DayPlan`'s per-day
   "{n} films · ~span", the mobile `PlanButton` badge, and the Place filter's "3 cinemas". A ghost
   row's gap numbers are facts about your plan, not a tally.
   Reasoning: `docs/decisions/visual-language.md`.

9. **Public release = weekly curated pipeline, not live per-visitor scraping.** Live scraping on
   every request let any visitor trigger a scrape and gave no chance to catch mangled titles /
   wrong Letterboxd matches before users saw them. Now `fetch:batch` → human review →
   `fetch:confirm`, on Thursdays when the programmes turn over. Drove decisions #1 & #3;
   `app/actions.ts` + `RefreshButton` are gone. **The run itself is the `fetch-films` skill**
   — load it rather than driving the scripts freehand.

10. **Installable as "flm on" (lowercase).** `<title>`, `appleWebApp.title`, and `manifest.ts`
    `name`/`short_name` are the lowercase string; the descriptive text is `description`.
    `app/manifest.ts` needs `export const dynamic = "force-static"` and **relative** URLs
    (`start_url: "."`, `src: "icon-192.png"`) so it works at the domain root locally and under
    the `/flm-on/` GitHub Pages basePath. Icons are **generated, committed PNGs** —
    `npm run gen:icons` (`scripts/gen-icons.tsx`, SVG → `sharp`) writes `app/icon.png` /
    `app/apple-icon.png` / `app/favicon.ico` (a hand-rolled ICO container) /
    `public/icon-{192,512,maskable}.png`. Re-run if the palette changes.

11. **Curated editorial labels — `data/film-labels.json`.** `Record<"<title.trim().toLowerCase()>",
    string>` (e.g. `"classic!"`). **Render/build-time only** — `app/page.tsx` reads it and threads
    a `labels` map to `FilmCard`; not in `showtimes.json`, so editing a label needs only a
    rebuild. Rendered by `FilmNotes` in the same sticker as the special-screening name(s), joined
    by ` · ` — decorative (`--color-fg`/`--color-bg`, never accent/count). `fetch:batch` also
    **writes** pre-fills into this file during the weekly review (rules: `fetch-films` skill).

12. **The IFI "Mystery Matinee" strand is a redacted card** (`lib/mystery.ts`,
    `components/MysteryTitle.tsx`). Drops the year + duration (IFI's are placeholders anyway) and
    puts each word of the title behind a block, click to reveal. `ScreeningBrowser` attaches a
    synthetic `Mystery Matinee` tag at render time so it passes the Highlights lens, and its
    `KNOWN` entry is `mark: false` — the redacted card is treatment enough. `DayPlan` still shows
    its runtime, for the gap maths. Details: `docs/decisions/screening-tags.md`.

13. **Special screenings get a per-session marker** (`lib/screeningTags.ts`). `KNOWN` is the gate
    on what surfaces — widening it is one entry — and `UNSURFACED` is its deliberate opposite,
    tags we recognise and choose not to show. Reasoning: `docs/decisions/screening-tags.md`.
    - **One `<SpecialsMark>` serves all three surfaces** — the pill, the `FilmNotes` sticker that
      names the strand, and the lens that filters on it — so the mark you scan a row for can't
      drift from the control that shows them. Lucide's `FaceGrinning`, **outline, not
      `fill-current`** (the eyes and mouth are strokes drawn inside the circle). The caller sizes
      it in `em`.
    - **The card names the strand once; the pills carry the bare mark.** Once the card names it
      you recognise the mark, so don't repeat the words on every pill.
    - **House style for tag descriptions** (here and in `lib/formats.ts`): exactly one ` — ` per
      rendered string — the title/description separator — **and none inside a description**, under
      ~90 characters. A pill can show a strand and a format joined by ` · `, so a description that
      spends its own em-dashes leaves five in a row each meaning something different.
    - **`Big Screen Classics` is deliberately not surfaced.** A curated `film-labels.json` label is
      the whole of what that strand gets, so trimming one at review really does mean that film
      shows nothing.
    - `mark: false` = still a surfaced special (Highlights, tooltip) but no mark and no
      `FilmNotes` segment.

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

15. **Film formats — 35mm / 70mm / IMAX** (`lib/formats.ts`, `components/FilmFormats.tsx`).
    `<FilmFormatTag>` is a box on the meta line, all one width, `height = width / ratio` with the
    ratio descending 35mm→70mm→IMAX so **a bigger format is a taller box** — not literal
    projection ratios. 35mm/70mm (`print: true`) get an animated film-strip; IMAX is a static
    plaque in brand blue. Counts toward Highlights; not part of the `FilmNotes` sticker. 4DX /
    ScreenX / Superscreen are recognised and deliberately unsurfaced.
    Sources and treatment: `docs/decisions/screening-tags.md`.

16. **Cineworld Dublin — a JSON-API adapter, scraped in full** (`lib/scrapers/cineworld.ts`).
    What matters outside a fetch is that **an ordinary wide-release showing ends up with no
    `screeningTags` at all** — nothing is dropped at scrape time, so the whole multiplex slate is
    in `showtimes.json` and it's the **"Specials, etc" Highlights lens** (decision #14) that keeps
    it out of view. **Cineworld also defaults off** in preferences. Consequence: its git diffs
    churn with wide-release showtimes.

    Endpoints, the tag-normalisation vocabulary, the separate `"…: The IMAX Experience"` movie
    record and the rest: the `fetch-films` skill's `reference/cinemas.md`.

17. **International / foreign-language support** (`lib/languages.ts`) — the third `screeningTags`
    reader. Reasoning: `docs/decisions/screening-tags.md`.
    - **Language is per-film** (Letterboxd, folded into every screening's tags at fetch time, so
      it covers all three cinemas); **the caption state is per-session**.
    - **Open captions are their own state, not a flavour of `subtitled`** — a separate
      `openCaptioned` flag, its own `OC` mark returned ahead of `ST`, and two different tooltip
      sentences. On a non-English film subtitles are *translation*; open captions on an English
      film are an *accessibility* screening. Collapsing them made those two sessions describe
      themselves identically, which is exactly what someone choosing between them needs told apart.
    - **Every tooltip sentence opens with a preposition** ("In Tamil…", "With open captions…",
      "Originally in Spanish, dubbed into English"), so a row of pills reads in one voice.
    - A non-English original language counts toward Highlights, and so does an open-captioned
      session; a plain subtitled or dubbed screening of an English film does not.
    - `<LanguageTag>` = the language name on the meta line, `<LanguageMarks>` = `OC`/`ST`/`Dub` on
      a pill. The `language` preference filters on non-English only; `dubbed` is not filtered on.

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

19. **National Cinema Weekend — a date-boxed campaign note** (`lib/cinemaWeekend.ts`,
    `components/CinemaWeekendBanner.tsx`). Sat 5 / Sun 6 September 2026, tickets from €4 at all
    three cinemas: a star before the day name in both day pickers, plus an `<Alert>` over the film
    list. Shown on a pinned Sat/Sun **and** on "This week", never in the Next-week preview. **One
    `<CinemaWeekendMark>` serves both surfaces**, ink and never accent (a selected day chip is
    already gold). **It expires by itself** — two hard-coded ISO dates, and `visibleDays` already
    drops days that have passed, so after the weekend nothing renders and the module and its
    component can be deleted whole with no edit to any caller.
    Copy and the rest: `docs/decisions/visual-language.md`.

20. **A screening lingers ten minutes past its start time** (`GRACE_MINUTES` + `screeningCutoff`,
    `lib/date.ts`). Every "is this still on?" test compares against that cutoff rather than the
    wall clock, so it governs the plan too (#5). You can still walk into a film ten minutes late,
    and a session disappearing out from under a plan you're halfway through is a worse failure
    than one you can no longer quite make. It **crosses midnight rather than clamping**, so a
    late-night screening gets the same grace as any other; the accepted consequence is that
    yesterday can stay a visible day chip for those few minutes. `now` is fixed at mount.
    Details: `docs/decisions/plan.md`.

21. **The plan exports to a calendar as one `.ics` file** (`lib/calendar.ts` `planToICS`; the
    button at the foot of `PlanPanel`, the browser half in `ScreeningBrowser.exportPlan`). One
    file for the whole plan, one ordinary VEVENT per pick; it does not create an "FLM ON"
    calendar. Reasoning: `docs/decisions/plan.md`.
    - **It's an export, not a sync.** Import can add and update but never delete, so a film taken
      out of the plan stays in the calendar. What it does avoid is duplicating: each `UID` is a
      stable FNV-1a hash of the `bookingUrl` — whitespace stripped, because Light House's carry a
      literal newline mid-query-string — keyed on the URL alone so a moved session *updates* its
      event. That asymmetry is the button's tooltip and, spelled out in full, its `aria-label`:
      the one tooltip whose text is nowhere else in the UI.
    - **Times are `TZID=Europe/Dublin` with a static `VTIMEZONE`**, never floating — a floating
      time is silently wrong the moment the device leaves Irish time. `DTEND` derives from
      `endMins`, never from `s.date`, so a late film ends on the next date.
    - **`LOCATION` is `CINEMA_ADDRESS` (`lib/cinemas.ts`) and its exact shape is load-bearing** — a
      calendar geocodes it as a *place lookup* and only draws a map when that resolves. Registered
      venue name on its own first line, then the canonical postal address ending in the country.
      Don't tidy the line break away, and don't substitute `CINEMA_LABEL`.
    - **The event is what / where / when and nothing else** — `SUMMARY`, `DTSTART`, `DTEND`,
      `LOCATION`. No `URL`, no `DESCRIPTION`: by the time an event is in your calendar you've
      booked and you know what you're seeing.
    - It reads `dayPlanItems`, so it inherits #5 — muting a cinema never drops a confirmed film
      from the file.
    - **Built in the browser** (Web Share first, blob + `<a download>` fallback), because
      `output: "export"` plus a `basePath` that differs between local and CI rules out a route.
      The generator is pure and lives in `lib/`, which is why it has tests.

22. **Component primitives are vendored from neobrutalism.dev's shadcn registry — their structure,
    our values** (`components/ui/`, `lib/utils.ts`, the token bridge in `app/globals.css`).
    Decision #7's look is unchanged; what was adopted is their token *vocabulary*. Why Radix, what
    it replaced, the bridge's shape and the adopted list: `docs/decisions/ui-primitives.md`.
    The landmines:
    - **No `title` attribute anywhere** — unstyleable, and it never fires on touch. Every tooltip
      is a Radix `<Tooltip>`; those are hover/focus-only, so the same string must also sit on an
      `aria-label`. Adding a `title` back is a regression. One shared `TooltipProvider` at the
      `ScreeningBrowser` root, `delayDuration` 300ms (Radix's default 0 makes a row of pills flash).
    - **`--box-shadow-x/y` is the shadow's total REACH (6px), not its 4px offset** — the one bridge
      value that isn't a copy of theirs. Set it to 4 and every press lands 2px shy of its edge.
    - **`--main` is our gold — never take `variant="default"` unexamined.** Restyle to `neutral` on
      the way in (#7 reserves the accent).
    - **No enter/exit animation on `Dialog`.** A page that isn't rendering (backgrounded tab,
      installed app behind the home screen) doesn't tick CSS animations, and Radix holds the node
      until `animationend`: a stalled exit strands `data-scroll-locked` on `<body>` — an
      unscrollable page — and a stalled enter opens the panel invisible. Both self-heal on the next
      render, so neither reproduces on demand. The tooltip keeps its animations (hover-only, so it
      can't open on an unrendered page).
    - **`DialogContent` is a direct child of `DialogPortal`** — Portal wraps each child in its own
      `<Presence>`, so a positioning `<div>` unmounts Content out from under itself.
    - **`modal={false}` on `dropdown-menu`** — Radix's modal default mounts a scroll lock and
      `pointer-events: none` on `<body>`; the film list must stay scrollable while you pick a day.
    - **`asChild` won't let a child override `role`** — `role="menuitemradio"` goes on
      `DropdownMenuItem` (`aria-checked` does survive from the child). And `data-highlighted` never
      lands on these rows, so the keyboard cursor is anchored on `:focus` — don't add
      `outline-hidden` centrally in `ui/dropdown-menu.tsx`.
    - **`menuOpenChange` clears only the slot it owns** — pressing a second trigger fires a close
      and an open in either order; clearing unconditionally makes moving between filters take two
      clicks.
    - **`alert`** — `role="alert"` is an assertive live region, so the standing banners pass
      `role="note"`; `AlertDescription` is a grid, so text with an inline button needs a wrapping
      `<p>`; the registry's `line-clamp-1` on the title stays dropped.
    - Vendored files must keep diffing cleanly against a future `shadcn add` — that's why `cva` is
      a dependency rather than hand-rolled around.

23. **Icons are `lucide-react`.** Lucide's defaults *are* this app's drawing spec — 24 viewBox,
    `fill: none`, `currentColor`, 2px stroke, round caps — and it's in Next 16's
    `optimizePackageImports`, so a named import tree-shakes with no config. **No text glyph is
    load-bearing any more**: `★` and `☻` both became icons (`<CinemaWeekendMark>`,
    `<SpecialsMark>`), and the bar for a third is whether an `em`-sized icon can carry it, not the
    old blanket rule. Deliberately still bespoke SVG: the Letterboxd mark, `<LanguageTag>`'s
    speech bubble, the film-format strips. The `×` close controls are still characters —
    converting them is a live option, not yet taken.
    - **The meta-line icons label, they don't decorate.** `Hourglass` and `User`/`Users` (split on
      a comma in the comma-joined director string, so the mark doesn't call two people one) are
      the first icons added to text that read fine without one — they earn their place by making
      "111min Pedro Almodóvar" scannable rather than parsed. Both `aria-hidden`, both `size-[1em]`
      inside an `inline-flex gap-1.5` so each hugs its own text; as bare siblings in the flow the
      meta line's `gap-x-4` stops reading as two groups.
    What's adopted and why each: `docs/decisions/visual-language.md`.

24. **Below `sm:` both overlays are a vaul drawer; above it they stay the centred modal**
    (`components/ui/drawer.tsx`, `lib/useIsCompact.ts`). A bottom sheet you can fling away beats a
    modal you have to aim at, and the plan is opened one-handed mid-browse; above `sm:` a sheet
    glued to the bottom of a 1280px window would be wrong. Reasoning, including why bottom-anchored
    and not right: `docs/decisions/ui-primitives.md`.
    - **The breakpoint lives in exactly one place** — `useIsCompact()`, 640px, the same line
      `DialogContent` switches its own positioning on. `useSyncExternalStore`, server snapshot
      "not compact", so hydration stays clean.
    - **The parent owns the decision and passes `compact` down**, so the Root that opens and the
      Content that renders can't disagree — a `<DrawerContent>` inside a `<Dialog>` finds no
      context.
    - **`DialogTitle` / `DialogDescription` are used inside the drawer too**: vaul is built on
      `@radix-ui/react-dialog` and npm dedupes us to one copy, so the context is shared. A second
      copy would break this as a context error, not a style bug.
    - **`shouldScaleBackground` is forced `false`** — the registry default writes a black
      `document.body.style.background`.
    - **The drawer's horizontal padding goes on the scrolling element, not `DrawerContent`** — the
      option strips full-bleed with `-mx-6 px-6`, which only cancels out on the box that clips them.
    - **`Group`'s `<fieldset>` needs `min-w-0`** — a fieldset won't shrink below `min-content`
      however plainly its computed `min-width` reports `0px`.
    - **Neither drawer has a `×`** (you fling it down or press the scrim); both keep one in the
      modal, where there's nothing to drag.
    - vaul may animate where the Dialog may not (#22): it has no `animationend` handlers and
      unmounts on a `setTimeout`, so it can't hang on a page that isn't being rendered.

## Known gaps

- No tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`).
- Duplicate-session pills aren't visually distinguished (#6).
- **Nothing enforces the Thursday cadence** — a skipped refresh just keeps serving last week's
  `showtimes.json` silently.
- **Nothing alerts on a silent scrape failure**, and several classes of bad data (a wrong
  Letterboxd match, an untagged strand, a wrong language, a dropped format icon) are only ever
  caught by eye during the weekly review. The batch report has a section for each; the
  **`fetch-films` skill** enumerates them and says what to look for. Nothing is automatic.
- **`CINEMA_ADDRESS` is hand-maintained with nothing to verify it** — three constants read only by
  the calendar export (#21), and correctness there means "a calendar geocodes it to the right
  pin", which no test can assert: the unit tests only prove the string reaches the file intact.
  Confirmed once by hand in Calendar. A cinema that moves, a typo'd Eircode, or a tidy-up of the
  name/address line break all break the map silently. Light House's entry is the thinnest and
  resolves off the venue name alone.
- **Cineworld "highlight" detection is tag-based only** — a plain-digital showing of an
  interesting film shows only with the Highlights lens *off*, buried in the full multiplex slate,
  with no per-title allowlist to promote it.

## Running it

- `npm run dev` — dev server. To open it on a phone over the LAN, that host has to be listed in
  `allowedDevOrigins` in `next.config.ts` — Next 16 blocks cross-origin requests for `/_next/*` dev
  resources by default, and the failure is silent and confusing: the HTML arrives, no JS loads, so
  `ScreeningBrowser` never hydrates and the page just stops after the masthead. Dev-only; it has no
  effect on `next build` or the export.
- `npx vitest run` — unit tests
- `npm run build` — production build; check `/` stays `○ (Static)` (decision #3)
- `npm run fetch:batch` / `npm run fetch:confirm` — the weekly refresh (decision #9). **Driven by
  the `fetch-films` skill**; don't run them freehand
- `npm run gen:icons` — regenerate app icons + favicon (decision #10)

## Working on this

- **Before calling anything done:** `npx vitest run`, then `npm run build` and confirm `/` is still
  `○ (Static)` (decision #3). A UI change also needs a look in `npm run dev` — the marquee, sticker
  and segmented-control work is all pixel-level, and type-checking proves nothing about it.
- **The docs are part of the change.** Nearly every feature commit here touches CLAUDE.md in the
  same commit. A new decision gets a numbered entry here — **the rule, plus enough of the why that
  the next session can't tidy it away** — and its full reasoning goes in the matching
  `docs/decisions/` file. A reversed decision is *rewritten* in both, never appended to.
  Same for `docs/architecture.md` when a component changes shape, and for the **`fetch-films`
  skill** (`.claude/skills/fetch-films/`) when a scraper, an override file, the report or the
  aggregate pipeline changes.
- **The split is by consequence, not by topic.** A rule whose loss ships a bug lives here; the
  argument behind it lives in `docs/`. When you're unsure which half a new paragraph is, ask what
  breaks if a future session never reads it — if the answer is "a bug", it belongs here.
- **Everything out of this file is out of context most sessions, which is the point *and* the
  risk**: nothing will tell you a doc has rotted. If you read one and it's wrong, fix it then.
- **Root causes only.** The scrapers already degrade silently (see Known gaps); a patch that papers
  over a parse failure instead of fixing the selector hides a real break.

## Data files (`data/`)

Three are **read at build time**, and they're the only ones a UI change ever touches:
`showtimes.json` (the published week — screenings may carry `screeningTags: string[]`, shared vocab
per decisions #13/#15/#17, plus `originalTitle` (#16) and `director` (#4)), `upcoming.json` (the
hand-trimmed "Next week" tease, #18) and `film-labels.json` (the curated editorial labels, #11 —
**the only override file a rebuild picks up**; edit it and reload).

Everything else is the pipeline's: the five override files applied at *fetch* time, and the
gitignored caches. **Which is which, the exact key formats and what needs a re-fetch are in the
`fetch-films` skill** (`reference/pipeline.md`, "Data files", and `SKILL.md`'s fix table) — don't
guess a key from memory.
