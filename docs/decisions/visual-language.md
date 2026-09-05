# The visual language

Decisions #7, #8, #19 and #23 in full — what "chunky, not brutalist" means in values, why the
app has no counters, the National Cinema Weekend note, and the move to lucide. CLAUDE.md keeps
the rules; this is the reasoning behind them.

Verbatim from CLAUDE.md, which now carries only the rules. **Read this before changing
anything it covers, and update it in the same commit** — the same discipline CLAUDE.md and
the `fetch-films` skill are under.

---

## Decision #7 — Visual design: "chunky", not brutalist

**Visual design: "chunky", not brutalist** (user's explicit call, ref inkwellgames.com). Warm
cream page (`--color-bg`), near-white card (`--color-surface`), warm near-black ink
(`--color-fg`/`--color-border`), rounded corners, hard (non-blurred, offset) layered shadows.
Font: Elms Sans. All tokens in the `@theme` block of `app/globals.css`.
- **Accent reservation:** the one accent (`--color-accent`, gold `#fdc732`) is for
  actionable things, the current selection, and — the one status use — the header
  `<ActivePreferenceNote>` "for kids!" marquee (a tilted gold sticker stuck over the title
  when the kids-only filter is on, decision #14); never plain decoration (the film-card
  `FilmNotes` marquee stays ink, and the sibling language tag is a plain dark tag). **Two**
  non-ink/gold colours are allowed, both third-party brand identities: the Letterboxd mark's
  orange/green/blue, and the IMAX format box's brand blue.
- `body { cursor: default }` (an app, not a document); interactive elements set
  `cursor-pointer`, the film *name* opts back into `cursor-text` (it's the thing you copy).
- **`--shadow-chip`** (two-tone "stacked card", 6px total reach) is the resting elevation of
  screening pills *and* filter-bar segments; pressed/selected translate a matching 6px to land
  where the shadow edge was, hover is a half-press (`--shadow-chip-half`, 3px).
- **Segmented controls** (`ControlGroup` in `FilterControls`, settings `Segmented`): each segment
  has its own border + shadow, `-ml-0.5` merges adjacent borders into one line, only the group's
  end segments round outward, and every segment needs an explicit `relative` + ascending
  inline `z-index` (the active segment's `translate` makes a stacking context). **No
  "disabled" variant** — a segment you can't act on is removed from the row (or, if it's the
  last one, shown non-interactive). Don't reintroduce a greyed-out disabled state without
  asking. The one exception: `ControlGroup`'s sole option renders non-interactive only while
  `isActive` (it *is* the current view); when something else holds the view — the Day row's
  "Next week" preview (decision #18) — it becomes a real button, "take me back to this".
- **Two filter-bar shapes** (`components/FilterControls.tsx`, chosen by `layout`):
  - `"dock"` — the mobile fixed-bottom bar: the flush **segmented** `ControlGroup` row above,
    scrolling sideways on overflow.
  - `"bar"` — the desktop sticky bar at the top of the film column: Day / Time / Place each
    collapse to a **`FilterMenu`** — a trigger button showing the current choice that opens a
    chunky dropdown (`shadow-card`, `z-40`, first row is the "any" option, Day's `footer` is
    the "Next week" affordance). A full week of day chips is far too many flush segments for a
    bar that isn't pinned to a screen edge. Built on Radix's dropdown-menu (decision #22) —
    dismissal, roving focus and keyboard navigation come from there; the parent still holds
    `openMenu` so only one is open at a time. Accent fill on a trigger = "this filter is
    narrowing the view"; open-but-default just presses in.
  The `"any"` / single-option / pinned-preference logic is the same across both (a menu with
  one real option, a hidden control when a preference pins it).
  - **The Place filter's "any" option names the cinemas it covers** — `cinemaAnyLabel` in
    `FilterControls`: "3 cinemas", or the place's own name if a single one is enabled. Not
    "Anywhere", which was a promise the filter can't keep (it only ever spans the cinemas the
    preferences allow). Counted from the **preferences** (`cinemasEnabled`, which also decides
    whether the control renders at all), not from `cinemasPresent`, so it doesn't flicker as
    you page through days. Same label in both shapes: the dock's "any" segment, and the bar's
    trigger + first menu row.

---

## Decision #8 — No film-count / progress UI

**No film-count / progress UI.** A "here are X films" counter was tried and rejected — the
user said counters "add pressure". No running counts, badges, or the like in the main UI
without asking. (An active kids-only / language preference is named on the title —
`components/ActivePreferenceNote.tsx` — a gold sticker over the top / dark subtitle pills
over the base, not a count.) The two sanctioned exceptions both count **the user's own plan**,
never the catalogue: `DayPlan`'s per-day "{n} films · ~span" line, and the mobile
`PlanButton` badge (how many screenings are in the plan). The Place filter's "3 cinemas"
label (decision #7) is a count of *your own preferences*, not of what's on — same principle.
A ghost row's gap numbers (decision #5) are in the same category as `DayPlan`'s existing
transition labels: facts about *your* plan, not a tally of the catalogue.

---

## Decision #19 — National Cinema Weekend — a date-boxed campaign note

**National Cinema Weekend — a date-boxed campaign note** (`lib/cinemaWeekend.ts`,
`components/CinemaWeekendBanner.tsx`). Sat 5 / Sun 6 September 2026: admission from €4 at
participating cinemas across the Republic (Screen Ireland-backed). Two surfaces, both fed by
`cinemaWeekendDaysInView(effectiveDay, visibleDays)`: a **star before the day name** in both
day pickers (the dock segment, the desktop menu row *and* its collapsed trigger — `DayMark`),
and a **banner above the film list** — an `<Alert>` (#22) with the same star in its icon
gutter, the same shell as the "Next week (maybe)" one.
- **Shown on a pinned Sat/Sun *and* on "This week"** (user's call): "This week" lists those
  days' screenings, so hiding the note there would keep the offer from the view most likely
  to be open. Not shown on an ordinary day, and never in the Next-week preview.
- **A star, not the specials smiley** — that mark means a strand *within* a day; this means the
  whole day is cheap. It **leads** the day name / the banner heading — the mark is what you're
  scanning the row for, so it shouldn't sit behind the label. Ink in both places, never
  accent: a selected day segment is already filled gold and the mark has to stay readable on
  it (decision #7), and the accent's one status use is spoken for (#14).
- **It's lucide's `Star`, not the `★` character** (#23) — the one typographic mark that
  moved. Drawn `fill-current` rather than lucide's default outline, so at day-chip size it
  still reads as the solid star it replaces. **One `<CinemaWeekendMark>` serves both
  surfaces**, so the star on a day chip can't drift from the one heading the note that sent
  you there; the caller sizes it (`size-[1em] align-[-0.14em]` inline in a day name, the
  alert's own `[&>svg]:size-5` in the gutter). Always `aria-hidden` — the day picker already
  carried the campaign name in an `sr-only` span beside it, and the banner has it in the
  heading.
- **The copy says "all three cinemas have tickets from €4"** — Light House Cinema, IFI
  Cinemas and Cineworld are all on the campaign's published participant list, so the app can
  say so flatly. **"From €4" stays hedged** because the campaign's own wording is a floor,
  not a flat rate. The days are named **without the month** ("On Saturday 5 and Sunday 6…"):
  the banner only ever shows on days that are hours away, and the sentence still reads right
  once a passed Saturday leaves it "On Sunday 6". The one other line is that screenings will
  go faster than usual — the actionable part for a planner.
- **It expires by itself.** The days are two hard-coded ISO dates with their written-out
  labels (no general "campaign" facility for a thing that happens once), and `visibleDays`
  already drops days that have passed — so on the Sunday the banner narrows to Sunday, and
  after the weekend nothing renders. The module and its component can then be deleted whole,
  with no edit to any caller.

---

## Decision #23 — Icons are `lucide-react`

**Icons are `lucide-react`.** Chosen because it needs nothing bent to fit: Lucide's defaults
*are* this app's drawing spec — 24 viewBox, `fill: none`, `currentColor`, 2px stroke, round
caps — which is exactly what the hand-rolled preferences glyph had already been written to.
It's also in Next 16's built-in `optimizePackageImports` list, so a named import is
tree-shaken with no config; verified on a real build — the one icon's path data ships in a
single chunk and no other icon's does.
- **Both typographic marks have now moved to icons, and neither reason for keeping them
  survived contact.** `★` went first (National Cinema Weekend, #19): the "it's read out" half
  was never true of the glyph — `DayMark` has always rendered it `aria-hidden` with an
  `sr-only` name beside it, so the label was doing that work, not the character — and it sits
  in plain flow text with nothing measuring it. Drawn `fill-current` so it stays the solid
  star it was.
- **Then `☻` went too** (a surfaced special, #13 — now `<SpecialsMark>`, lucide's
  `FaceGrinning`, i.e. the same smiley redrawn as an icon). The
  objection had been mechanical: the mark rides inside `MarqueeSticker`'s scrolling track,
  which measures one copy of the string and pins the track to `2×` its width in px, and an SVG
  in a measured text run looked like a real complication. **It isn't — it's the opposite.** An
  icon sized in `em` has a deterministic width that doesn't depend on which font has loaded,
  so it's *more* stable under that measure than the glyph was; confirmed in the browser, where
  the track measures exactly `2×` the item and the two copies agree to a fraction of a pixel.
  (The `document.fonts.ready` re-measure still earns its keep for the text beside it.) The
  other half — that at pill size it sits among `OC` / `ST` / the ratio boxes and has to
  inherit the type's size and weight — is handled the way `CinemaWeekendMark` handles it: the
  caller sizes it in `em` and `currentColor` does the rest.
- **No text glyph is load-bearing any more.** If a third one ever comes up, the bar is
  whether an `em`-sized icon can carry it — not the old blanket rule.
- Likewise untouched: the **Letterboxd** three-dot mark (a brand identity, #7), the
  `<LanguageTag>` speech bubble (drawn to a measured text box, #17) and the film-format strips
  (#15) — all bespoke SVG that no icon set has.
- Adopted so far: **`Settings2`** on `PreferencesButton` — despite the name it draws sliders,
  so #14's "sliders, not a gear" still holds; it cost one of the previous three tracks and
  kept the round knobs, which was the trade the user picked over `SlidersHorizontal`'s
  three-tracks-with-tick-marks. Then the four notes over the film list (#22): **`Star`**
  (shared with the day pickers), **`CalendarClock`** on "Next week (maybe)", **`CalendarOff`**
  and **`SearchX`** on the two empty states. Then **`FaceGrinning`** as the specials mark
  (#13), replacing the last of the two text glyphs. Then **`ChevronsUpDown`** on the
  `FilterMenu` triggers (#7), replacing the `▲`/`▼` pair. Then **`Hourglass`** and
  **`User`**/**`Users`** leading the runtime and the director on the film card's meta line.
- **The meta-line icons label, they don't decorate.** Until them, every icon here replaced a
  mark that was already there; these two are the first added to text that read fine without
  one — so they earn their place by making the line scannable rather than parsed: a bare
  "111min Pedro Almodóvar" is two facts in identical dim type, and the icons say which is
  which before you read either. `Hourglass` over a clock face because the runtime is a
  *duration* and the pills already own time-of-day. `Users` when `group.director` contains a
  comma (that string is comma-joined for a co-directed film — `lib/scrapers/types.ts`), so
  the mark doesn't call two people one. Both are `aria-hidden`: the text beside them is
  already the label, and "hourglass 111min" read aloud is noise. Both `size-[1em]` inside an
  `inline-flex gap-1.5`, so each icon hugs its own text while the meta line's `gap-x-4`
  between items is untouched — put them in the flow as bare siblings and the two facts stop
  being two groups.
- **The filter-bar trigger no longer flips its mark on open.** `ChevronsUpDown` is the
  combobox indicator — both arrows at once, meaning "this opens a list", where `▼`/`▲`
  claimed to report state. Nothing is lost: the trigger already says it is open by pressing
  in (and, when it is narrowing the view, by staying gold), and the open menu is right there
  under it. Sized `size-[1.1em]` by the caller like every other icon here, so it tracks the
  trigger's own type.
- The `×` close controls are still text characters. Converting them is a live option,
  deliberately not taken yet.
