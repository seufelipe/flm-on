# The visual language

Decisions #7, #8 and #23 in full — what "chunky, not brutalist" means in values, why the
app has no counters, and the move to lucide. CLAUDE.md keeps
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
- **The mobile plan trigger is an ink tab standing on the dock's top edge** (`PlanButton`,
  rendered *inside* the dock div). It replaced a gold pill floating bottom-right over the film
  list. The user's objections were placement and volume: the pill sat over the cards, and as the
  one gold object that never leaves the screen it outshouted the selections the accent is for. A
  centred tab reads as the lip of the sheet it pulls up, and it's part of the dock, not something
  hovering over the list. Ink, not gold: it's actionable, so gold would be allowed, but not on
  every screen. The count is an inverted `bg-bg` badge (decision #8's sanctioned count). It's
  `absolute bottom-full` against the dock's padding box, so it covers the dock's 2px top border
  and tab and bar join into one shape. **Moved out of the dock, it loses its anchor.** Rejected
  alternatives: a smaller round icon FAB (still floats), a fixed Plan segment at the end of the
  dock row (costs day-chip width) and a full-width basket strip (a permanent extra row).

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

## Decision #23 — Icons are `lucide-react`

**Icons are `lucide-react`.** Chosen because it needs nothing bent to fit: Lucide's defaults
*are* this app's drawing spec — 24 viewBox, `fill: none`, `currentColor`, 2px stroke, round
caps — which is exactly what the hand-rolled preferences glyph had already been written to.
It's also in Next 16's built-in `optimizePackageImports` list, so a named import is
tree-shaken with no config; verified on a real build — the one icon's path data ships in a
single chunk and no other icon's does.
- **Both typographic marks moved to icons, and neither reason for keeping them survived
  contact.** `★` went first — the day-picker mark of a one-off, date-boxed campaign note
  (National Cinema Weekend, Sept 2026), deleted whole once the weekend passed: the "it's read
  out" half was never true of the glyph, which had always rendered `aria-hidden` with an
  `sr-only` name beside it, so the label was doing that work, not the character.
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
  inherit the type's size and weight — is handled by having the
  caller size it in `em` and `currentColor` does the rest.
- **No text glyph is load-bearing any more** — and since the `×` swap below, none is left at
  all. If one ever comes up again, the bar is whether an `em`-sized icon can carry it — not the
  old blanket rule.
- Likewise untouched: the **Letterboxd** three-dot mark (a brand identity, #7), the
  `<LanguageTag>` speech bubble (drawn to a measured text box, #17) and the film-format strips
  (#15) — all bespoke SVG that no icon set has.
- Adopted so far: **`Settings2`** on `PreferencesButton` — despite the name it draws sliders,
  so #14's "sliders, not a gear" still holds; it cost one of the previous three tracks and
  kept the round knobs, which was the trade the user picked over `SlidersHorizontal`'s
  three-tracks-with-tick-marks. Then the notes over the film list (#22): **`Star`**
  (shared with the day pickers; gone with the campaign it marked), **`CalendarClock`** on "Next week (maybe)", **`CalendarOff`**
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
- **The `×` close controls are now `X`** — the last text glyphs in the UI, converted once the
  bar above was met: a close control is exactly the case an icon carries, and at 2px round-capped
  stroke it reads as the same kind of mark as `ChevronsUpDown` on the filter triggers rather than
  as a character borrowed from the type. Both callers (`SettingsPanel`'s modal, `PlanPanel`'s
  header) size it `size-5` and drop the `text-2xl leading-none` that was only ever there to size
  the glyph — the old one set a 24px font to get maybe half that in ink, so the sizes don't
  correspond. The icon is `aria-hidden` and the button keeps its `aria-label`. Nothing
  text-based is load-bearing anywhere now.
