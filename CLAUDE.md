@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts). Combines showtimes from **Light House Cinema**,
**IFI** and **Cineworld Dublin** — all scraped in full — into one place, with tools to plan a day
at the cinema, from a double bill up to back-to-back screenings. (Cineworld is **paused** — not
fetched, not in the UI — until its API is reachable again; #16.) Cineworld is off by default and,
when on, its ordinary multiplex programme is hidden by the "Specials, etc" lens unless you ask
for it (decisions #14, #16). Built entirely through conversation with the user; this file exists
so a future session can pick up without re-deriving the reasoning.

**Public deploy runs on a weekly curated pipeline, not live scraping** (decision #9): a
manually-run script fetches the week, prints a plain-text report to review, and confirming
promotes it to the one committed data file the deployed app reads statically.

**Where the rest of it is.** This file is the rules that apply everywhere; the rules for one area
of the code are in `.claude/rules/` (path-scoped, indexed under "Decisions"), and the reasoning
behind both was moved out to keep them loadable. `docs/architecture.md` — the component-by-component
notes. `docs/decisions/{plan,visual-language,ui-primitives,screening-tags,preferences-and-lenses}.md`
— each decision in full, named from its entry below. The `fetch-films` skill — the weekly pipeline,
the three cinemas, and every `data/` override file. **Read the relevant one before changing
anything it covers.**

**Before any layout change, sketch the proposed result as ASCII and get sign-off first** — the
user iterates on layout a lot and wants to see the shape before code. This covers anything that
moves, resizes, reflows, merges or splits regions (columns, cards, bars, headers, panels), not
one-off spacing tweaks.

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

`app/page.tsx` is a server component that reads `data/showtimes.json` directly — static per
deploy (#3). What the UI derives from it is mapped in `.claude/rules/` (below) and
`docs/architecture.md`.

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
   **No link, no year** (#28): a card with no Letterboxd page — pinned `null` or NOT FOUND —
   shows no year at all rather than falling back to the cinema's.

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

11. **Curated editorial labels — `data/film-labels.json`.** `Record<"<title.trim().toLowerCase()>",
    string>` (e.g. `"classic!"`). **Render/build-time only** — `app/page.tsx` reads it and threads
    a `labels` map to `FilmCard`; not in `showtimes.json`, so editing a label needs only a
    rebuild. Rendered by `FilmNotes` in the same sticker as the special-screening name(s), joined
    by ` · ` — decorative (`--color-fg`/`--color-bg`, never accent/count). `fetch:batch` also
    **writes** pre-fills into this file during the weekly review (rules: `fetch-films` skill).

### Loaded only with the code they cover — `.claude/rules/`

These decisions keep their numbers but live in path-scoped files that load automatically when you
read or edit a matching file. **If you're about to change behaviour in one of these areas before
you've opened its code, read the file first.**

- `plan.md` — #5 a plan spans the week and persists (resolves against `timedAll`, never
  `preferred`); #20 a screening lingers ten minutes past its start; #21 the `.ics` export.
- `strands.md` — #12 Mystery Matinee; #13 strand marks and tag-description house style; #15 film
  formats; #17 languages and captions; #25 marathons; #27 festival sections; #28 shorts programmes
  and "no Letterboxd link, no year". Plus the `FilmCard` pill-strip and `MarqueeSticker` gotchas.
- `browsing.md` — #14 persisted preferences; #18 the Next-week preview; #26 "New this week".
- `ui-primitives.md` — #22 the vendored Radix primitives and their landmines; #23 lucide icons;
  #24 vaul drawers below `sm:`.
- `cineworld.md` — #16 (currently paused). `install.md` — #10, the lowercase "flm on" PWA and icons.

**Two of those apply everywhere and so are repeated here:**

- **No `title` attribute anywhere** (#22) — every tooltip is a Radix `<Tooltip>`, and since those
  are hover/focus-only the same string must also sit on an `aria-label`.
- **Icons are `lucide-react`** (#23); no text glyph (`★`, `☻`, `×`) is load-bearing in the UI.

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
- **The docs are part of the change.** Nearly every feature commit here touches CLAUDE.md or a
  `.claude/rules/` file in the same commit. A new decision gets the next number — **the rule, plus
  enough of the why that the next session can't tidy it away** — in the rules file whose `paths`
  cover its code (here, only if it applies everywhere; add it to the index either way, and widen a
  file's `paths` when it starts governing a new file), and its full reasoning goes in the matching
  `docs/decisions/` file. A reversed decision is *rewritten* in both, never appended to.
  Same for `docs/architecture.md` when a component changes shape, and for the **`fetch-films`
  skill** (`.claude/skills/fetch-films/`) when a scraper, an override file, the report or the
  aggregate pipeline changes.
- **The split is by consequence, not by topic.** A rule whose loss ships a bug lives here or in
  `.claude/rules/`; the argument behind it lives in `docs/`. When you're unsure which half a new paragraph is, ask what
  breaks if a future session never reads it — if the answer is "a bug", it belongs here.
- **Everything out of this file is out of context most sessions, which is the point *and* the
  risk**: nothing will tell you a doc has rotted. If you read one and it's wrong, fix it then.
- **Root causes only.** The scrapers already degrade silently (see Known gaps); a patch that papers
  over a parse failure instead of fixing the selector hides a real break.

## Data files (`data/`)

Three are **read at build time**, and they're the only ones a UI change ever touches:
`showtimes.json` (the published week — screenings may carry `screeningTags: string[]`, shared vocab
per decisions #13/#15/#17, plus `originalTitle` (#16) and `director` (#4); alongside them a
top-level `newFilms: string[]`, #26), `upcoming.json` (the
hand-trimmed "Next week" tease, #18) and `film-labels.json` (the curated editorial labels, #11 —
**the only override file a rebuild picks up**; edit it and reload).

Everything else is the pipeline's: the five override files applied at *fetch* time, and the
gitignored caches. **Which is which, the exact key formats and what needs a re-fetch are in the
`fetch-films` skill** (`reference/pipeline.md`, "Data files", and `SKILL.md`'s fix table) — don't
guess a key from memory.
