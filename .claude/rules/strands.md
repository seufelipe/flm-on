---
paths:
  - "lib/screeningTags.ts"
  - "lib/formats.ts"
  - "lib/languages.ts"
  - "lib/mystery.ts"
  - "lib/marathon.ts"
  - "lib/highlights.ts"
  - "lib/screeningTooltip.ts"
  - "lib/groupings.ts"
  - "lib/aggregate.ts"
  - "lib/scrapers/ifi.ts"
  - "lib/titles.ts"
  - "lib/filmContext.ts"
  - "components/FilmCard.tsx"
  - "components/FilmNotes.tsx"
  - "components/MarqueeSticker.tsx"
  - "components/ScreeningTags.tsx"
  - "components/FilmFormats.tsx"
  - "components/ScreeningLanguage.tsx"
  - "components/MysteryTitle.tsx"
  - "data/title-overrides.json"
  - "data/film-labels.json"
---

# Strands, formats, languages and what a film card shows

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

## Map

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

- `lib/mystery.ts` / `lib/marathon.ts` — the two title-detected strands (#12, #25). Neither is
  scraped; `ScreeningBrowser` attaches their tag at render time.

## Card gotchas

- ⚠️ `FilmCard`: each day's pill strip is one non-wrapping `overflow-x-auto` row and **needs
  `relative`** — the pills' `position:absolute` `.sr-only` spans otherwise escape the clip and give
  the whole page a phantom horizontal scrollbar.
- ⚠️ `MarqueeSticker` measures one copy and pins the track to `2×` that width **in px**, so the
  keyframe's plain `translate3d(-50%…)` lands exactly on one copy — a var-free keyframe runs on the
  compositor, where a `%`-of-`max-content` translate stutters. `--color-fg`/`--color-bg`, never
  accent; reduced-motion → static. A label-only card's sticker gets no tooltip at all.

## Decisions

12. **The IFI "Mystery Matinee" strand is a redacted card** (`lib/mystery.ts`,
    `components/MysteryTitle.tsx`). Drops the year + duration (IFI's are placeholders anyway) and
    puts each word of the title behind a block, click to reveal. `ScreeningBrowser` attaches a
    synthetic `Mystery Matinee` tag at render time so it passes the Highlights lens, and its
    `KNOWN` entry is `mark: false` — the redacted card is treatment enough. `DayPlan` still shows
    its runtime, for the gap maths. Its sibling is the marathon card (#25), which shares the
    year/runtime suppression but not the redaction. Details: `docs/decisions/screening-tags.md`.

13. **Special screenings get a per-session marker** (`lib/screeningTags.ts`). `KNOWN` is the gate
    on what surfaces — widening it is one entry — and `UNSURFACED` is its deliberate opposite,
    tags we recognise and choose not to show. Reasoning: `docs/decisions/screening-tags.md`.
    - **A strand's mark is `<StrandMark>`, its own icon or the generic smiley.** `STRAND_MARKS`
      in `components/ScreeningTags.tsx` maps a `label` to an icon — `parent & baby` → `Baby`,
      `silver screen` → `Coffee`, `q&a` → `MicVocal`, `knit-along` → `Spool`; everything else falls back to `<SpecialsMark>`, lucide's
      `FaceGrinning`. **The map lives in the renderer, not in `lib/screeningTags.ts`** — which
      glyph a strand wears is a rendering decision, and that module stays data-only and
      React-free. Adding a mark is one line and is never required.
    - **The pill and the sticker use `<StrandMark>`; the "Specials, etc" lens keeps
      `<SpecialsMark>`** — the lens filters on *every* strand, so it can't wear any one strand's
      icon. This is the accepted cost of per-strand marks: a Parent & Baby pill shows `Baby`
      while the control that reveals it shows the smiley, where before they were the same glyph.
      Worth it because the marks now carry information — `Baby` vs `Coffee` tells you which of
      two marked pills is the buggy screening and which the over-65s matinee.
    - **All of them are outline, never `fill-current`** — `FaceGrinning`'s eyes and mouth are
      strokes drawn inside the circle, so filling it paints over the face. The caller sizes it
      in `em`.
    - **The card names the strand once; the pills carry the bare mark.** Once the card names it
      you recognise the mark, so don't repeat the words on every pill.
    - **One sticker per thing** (`FilmNotes`): a sticker per strand, then one for the curated
      label — never two things joined by ` · ` in one sticker, so each strand sticker's tooltip
      explains exactly its strand, and the label sticker (already fully readable) has none. They
      sit in one `inline-flex` group so they wrap below the title together.
    - **A strand belongs to a session, not to the film — so with two or more on one card, each
      strand sticker's tooltip says when it plays** ("Silver Screen (Fri 2 Oct, 12:00) — …"),
      from `strandSessions` over the full preferred set. The stickers' marks are the key to the
      pills; the tooltip says which pill is which. A lone strand keeps its plain line, and past
      three sessions the times are dropped (a weekly strand would turn the
      tooltip into a listing). The date is `formatWeekdayDate` — absolute, never "Tomorrow" —
      because it also lands in the SSR'd `aria-label` of a static page. Naming the strand on the
      pill itself (`[12:00 ☕ silver screen]`) was considered and held back until a strand with
      no icon of its own shares a card with another one.
    - **House style for tag descriptions** (here and in `lib/formats.ts`): exactly one ` — ` per
      rendered string — the title/description separator — **and none inside a description**, under
      ~90 characters. A pill can show a strand and a format joined by ` · `, so a description that
      spends its own em-dashes leaves five in a row each meaning something different.
    - **`Big Screen Classics` is deliberately not surfaced.** A curated `film-labels.json` label is
      the whole of what that strand gets, so trimming one at review really does mean that film
      shows nothing.
    - `mark: false` = still a surfaced special (Highlights, tooltip) but no mark and no
      `FilmNotes` segment.

15. **Film formats — 35mm / 70mm / IMAX** (`lib/formats.ts`, `components/FilmFormats.tsx`).
    `<FilmFormatTag>` is a box on the meta line, all one width, `height = width / ratio` with the
    ratio descending 35mm→70mm→IMAX so **a bigger format is a taller box** — not literal
    projection ratios. 35mm/70mm (`print: true`) get an animated film-strip; IMAX is a static
    plaque in brand blue. Counts toward Highlights; not part of the `FilmNotes` sticker. 4DX /
    ScreenX / Superscreen are recognised and deliberately unsurfaced.
    Sources and treatment: `docs/decisions/screening-tags.md`.

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

25. **A marathon is one card with no year and no runtime** (`lib/marathon.ts`, the `noFilmFacts`
    gate in `FilmCard.tsx`). A whole-day sitting of several films on one ticket arrives as a
    single listing whose year and runtime describe the sitting, not any film in it — Light House's
    LOTR marathon came through as `2022` / `785min`. Reasoning:
    `docs/decisions/screening-tags.md`.
    - **`FilmCard` folds this in with the Mystery Matinee as one `noFilmFacts` gate** — both drop
      the year and the duration, because neither card describes a single film. **Only `isMystery`
      also redacts the title and the director**; don't widen `noFilmFacts` to cover those.
    - **It keeps the mark**, where the Mystery Matinee is `mark: false` (#12): a marathon card is
      an ordinary card with two facts missing, so without the ☻ nothing says the session is
      unusual. The strand is named `marathon` on the sticker, not `extended edition marathon` —
      the title names the film, the sticker names the strand (#13).
    - **The runtime stays in the data** so `DayPlan`'s gap maths still blocks out the sitting,
      exactly as for a Mystery Matinee. Suppressing it is a display decision, not a data one.
    - **Pinned to `null` in `data/letterboxd-overrides.json`**, the "no link at all" form — there
      is no page for three films at once, and an auto-resolve failure would show up in the weekly
      report every week as if it were a film we just hadn't found yet.
    - The detector is generic (`/\bmarathon\b/i`, not the LOTR title) — all three cinemas run
      these, under a different name each time.

27. **A festival is a strand with its own section** (`strandPrefixes` in
    `data/title-overrides.json`, `section: true` in `lib/screeningTags.ts` `KNOWN`, the strand
    sections in `partitionFilmSections`). First use: the **IFI Documentary Festival**, Sept 2026.
    Reasoning: `docs/decisions/screening-tags.md`.
    - **The signal is the cinema's own title prefix, turned into a per-session tag at fetch
      time.** `strandPrefixes` maps a prefix to a tag: stripped like `stripPrefixes`, and the
      value appended to that session's `screeningTags` in `lib/aggregate.ts`. Per session because
      the prefix is — Knife plays the festival at the IFI and an ordinary run at Light House, and
      only the IFI pills carry the mark. **Not a `film-labels.json` label**: a label is per-film,
      and grouping cards on a label's text is a string match waiting to break.
    - From there it's an ordinary `KNOWN` strand: sticker, pill mark (`Clapperboard` in
      `STRAND_MARKS`), tooltip, and it passes the "Specials, etc" lens. Its `label` is the
      official name in its own capitals, **not** the lowercase every other strand uses.
    - **`section: true` gives a strand its own heading on "This week", ahead of "New this
      week".** A film files there if any visible session carries it, and each film appears in
      exactly one section — a new festival film goes under the festival. Same rules as #26
      otherwise: "This week" only, headings only when ≥2 sections are non-empty. The heading is
      the strand's `title` wearing its `STRAND_MARKS` icon (`strandIcon`).
    - **`strandSuffixes` is the same at the end of a title**: a regex source → tag, stripped and
      tagged per session. First use: IFI's "+ Q&A" / "+ Q+A" → `In-Person QandA`, the tag Light
      House sends for the same thing — so an IFI Q&A gets the same `q&a` sticker and mic mark
      instead of keeping "+ Q+A" in its title (Bourdieu, Oct 2026). Applied before the prefixes,
      so it works under a festival prefix too.
    - **Next year is a one-line edit**: the prefix carries the year (`IFI Documentary Festival
      2026:`). When the festival ends there's nothing to remove — no session carries the tag,
      and the section doesn't render.

28. **A shorts programme lists its films under the title, and has no year** (`programme` on
    `Screening`, `parseProgrammeFilms` in `lib/scrapers/ifi.ts`, the list in `FilmCard.tsx`).
    Reasoning: `docs/decisions/screening-tags.md`.
    - **Scraped live each week, not curated** (user's call). IFI's listing card gives "Various"
      in the director slot for a programme; only those get one extra request, to their film page,
      whose synopsis lists the films as `<br>`-separated `Title – Director` lines.
    - **The parser is deliberately strict**: exactly one spaced dash, under 100 characters, and
      the longest run of ≥2 consecutive such lines — a prose sentence can use dashes too. When
      nothing parses, `programme` is `[]`, not absent, and the report's **`Programmes`** section
      prints `NO LIST PARSED`. That's the only place a broken parse shows; the card just falls
      back to title + runtime. Don't loosen the parser to make that line go away.
    - **One flowing line** under the meta line — `Title (Director) · Title (Director) · …`,
      directors dim — chosen over one row per film for height. It takes the director's place;
      the runtime stays, because the length of the sitting is still worth knowing — **prefixed
      `~`**, since it's the cinema's approximate figure for the whole sitting ("98 mins approx.").
    - **The card is marked by lucide `PlayingCardsFan` before the title** (title-sized, dim like
      the year; tried first as a meta-line mark leading the list, and moved). It carries a
      tooltip — "Shorts programme — Several short films on one ticket.", also its `aria-label`
      (#22) — because a list of titles in brackets doesn't explain itself. A long programme
      title plus the icon pushes the `FilmNotes` sticker onto its own line; that's its normal
      wrap, not a bug. `isProgramme` is `programme !== undefined`, so the
      `~` and nothing else still applies to a programme whose list didn't parse.
    - **No Letterboxd link, no year — for every card, not just programmes.** The year is
      Letterboxd's (#4), and a cinema's own is a guess (#2): a programme's is a placeholder, a
      NOT FOUND film's may be this year's re-release stamp. The rule lives in `FilmCard` alone —
      the data still has the year, so the plan and the report are untouched.

29. **A cinema's context prefix is shown above the title, in its own words** (`contextPrefixes`
    in `data/title-overrides.json`, `titleContext` in `lib/titles.ts`, `context` on `Screening`,
    `lib/filmContext.ts`, the kicker in `FilmCard.tsx`). Reasoning:
    `docs/decisions/screening-tags.md`.
    - **Only prefixes that add context get shown**: an occasion (`Black History Month:`,
      `International Lesbian Day:`) or who's presenting (`Emmy Shigeta & Jack Reynor Present:`).
      Partner lists (`IFI and DCU:`) and prefixes already shown another way (`CINEMA BOOK CLUB:`)
      stay in `stripPrefixes`; a recurring programme (`Wild Strawberries:`, `IFI Family:`) is a
      strand and belongs with #13/#27, not here. An unlisted prefix is never shown, so a new
      sponsor credit stays hidden until someone opts it in.
    - **Never reworded** (user's call): the kicker is the prefix as it appears in that session's
      title, colon dropped. The override lists prefixes; it has no display text to drift.
    - **Per session, like `strandPrefixes`**, because a prefix belongs to one cinema's listing:
      Lesbian Lines is "International Lesbian Day:" at the IFI and plain at Light House. So when
      only some of a card's sessions carry it, the kicker adds where and when ("· IFI, Thu 8 Oct",
      `formatWeekdayDate`, up to three places, then dropped); when every session does, the text
      alone. Computed over the full preferred set, like the stickers.
    - **The kicker** is a `<p>` above the `<h3>`: `text-xs font-bold uppercase tracking-widest
      text-dim`, the section headings' voice, the where-and-when in normal weight. Not on a
      Mystery Matinee (#12). The Next-week preview gets it too, precomputed into
      `data/upcoming.json` as `contexts`.
