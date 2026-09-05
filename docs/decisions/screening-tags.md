# The `screeningTags` vocabulary and its three readers

Decisions #12, #13, #15 and #17 in full — the redacted Mystery Matinee card, special-screening
strands, film formats, and language/caption handling. CLAUDE.md keeps the rules; this is the
reasoning, including which strands are deliberately *not* surfaced and why.

Verbatim from CLAUDE.md, which now carries only the rules. **Read this before changing
anything it covers, and update it in the same commit** — the same discipline CLAUDE.md and
the `fetch-films` skill are under.

---

## Decision #12 — The IFI "Mystery Matinee" strand is a redacted card

**The IFI "Mystery Matinee" strand is a redacted card.** `lib/mystery.ts` `isMysteryFilm`
(`/^mystery matinee\b/i` on the cleaned title) gates `FilmCard` to drop the year + duration
(IFI's are placeholders anyway) and render the title via `MysteryTitle.tsx` (each word behind
a `--color-fg` block, transparent text under it for AT, click to reveal). The trailing
`Month YYYY` is handled by a `stripAnnotations` regex so future months need no correction.
`DayPlan` still shows its runtime (gap math). `ScreeningBrowser` attaches a
synthetic `"Mystery Matinee"` `screeningTag` render-time so it passes the Highlights filter;
its `KNOWN` entry is `mark: false` (no glyph/sticker — the redacted card is treatment enough).

---

## Decision #13 — Special screenings get a per-session marker

**Special screenings get a per-session marker.** Light House tags them per showtime in
`.time > em.additional` (`Parent and Baby`, `Cinema Book Club`, `Silver Screen`, plus caption
notes `Subtitled`/`Dubbed`/`Open Captioned`); the adapter reads them into `Screening.screeningTags`
verbatim. `lib/screeningTags.ts` `KNOWN` is the gate on what surfaces (widening = one entry),
and `UNSURFACED` is its counterpart — tags we've *decided* not to show, kept out of the weekly
report's "unrecognised" list so it stays a list of genuinely new strands;
each entry carries a curated `title` + `description` (originally Light House's `data-tooltip`)
used as the hover tooltip. **House style for those descriptions, and the format ones in
`lib/formats.ts`: exactly one ` — ` per rendered string** — the title/description separator —
**and none inside a description**, kept under ~90 characters. A pill can show a strand and a
format at once (joined by ` · `), so a description that spends its own em-dashes leaves four
or five of them in a row each meaning something different; and past ~90 characters at
`max-w-[16rem]` the tooltip stops being a glance. Rendered as a bare `<SpecialsMark>` on each matching pill + the name once per card
in `FilmNotes` — rationale (user): once the card names it you recognise the mark, so don't
repeat words on every pill.
- **The mark is lucide's `FaceGrinning`** (`<SpecialsMark>` in `components/ScreeningTags.tsx`),
  which replaced the `☻` text glyph — see decision #23 for why that one moved to an icon after
  the original rule had kept it as text. **It is still the same smiley**: the glyph became an
  icon, the mark itself didn't change. (A `Gem` was tried in passing and rejected — the user
  likes seeing the face, and the whole point of `☻` was that it reads as one.) **One component serves all three surfaces** — the pill /
  plan row, the `FilmNotes` sticker that names the strand, and the "Specials, etc" lens that
  filters on it — so the mark you scan a row of showtimes for can't drift from the one on the
  control that shows them. Same shape as `<CinemaWeekendMark>` (#19), and for the same reason.
  Lucide's outline, **not** the star's `fill-current`: the eyes and mouth are strokes drawn
  *inside* the circle, so filling it paints over the face. That does invert the old glyph's
  rationale — `☻` was picked over `☺` because a filled smiley held up better at small sizes —
  but a 2px-stroked circle with dot eyes reads at pill size where a hairline `☺` didn't;
  confirmed in the browser at 380px and at desktop width. The caller sizes it (`size-[1.1em]` on a pill,
  `1.15em` in the sticker and on the lens) — an icon fills its box where the smiley's ink sat
  well inside its em, so 1em would have read smaller than the glyph it replaced.
  `KnownTag` no longer carries a `symbol`: every surfaced strand wears the same mark, so it
  belongs to the renderer, not the data. The `FilmNotes` sticker holds **multiple** notes joined by ` · `
(the old "one sticker max" rule is gone); `mark: false` tags contribute neither glyph nor
name. Cineworld maps its `Showtime.Event.*` / `Showtime.Accessibility.AutismFriendly` onto
this vocab (decision #16). `fetch:batch` prints
a "Special screenings" + "unrecognised screening tags" section for review.
- **`Big Screen Classics` is deliberately NOT surfaced** (user's call). Every other strand in
  `KNOWN` *does* something to the screening — Parent & Baby turns the sound down, Relaxed dims
  the lights, Silver Screen pours the tea, Movies for Juniors cuts the price. Big Screen
  Classics only states which film was picked, and Cineworld is the only one of the three
  cinemas that badges that, so an identical re-release at the IFI or Light House carried no
  mark and the tag read as a difference between the *films* rather than between the cinemas'
  marketing. The selection is still worth surfacing — via `data/film-labels.json`, which
  `fetch:batch` still pre-fills from this very tag ("40th anniversary", `classic!`) for the
  user to review. Curated beats automatic, so the label is the whole of what the strand gets;
  trimming one at review really does mean that film shows nothing. **The raw tag stays in
  `showtimes.json`** — the prefill reads it — and `isUnsurfacedTag` keeps it out of the
  report's unrecognised list. Its films no longer pass the Highlights lens on the strand
  alone, only on their label.
- Not tagged: IFI's special-audience strands (only Cineworld + Light House are wired); IFI's
  "Archive at Lunchtime" strand (sole signal is the `filmPageUrl` slug — slug-derivation
  deliberately not done).

---

## Decision #15 — Film formats — 35mm / 70mm / IMAX

**Film formats — 35mm / 70mm / IMAX** (`lib/formats.ts`, `components/FilmFormats.tsx`).
Sources: Light House `35mm` in `em.additional`; IFI `svg[data-icon]` (`70mm`); Cineworld
`Format.Projection.Imax` + a `": The IMAX Experience"` companion-movie the adapter folds in
(decision #16). `<FilmFormatTag>` is a box on the meta line, all one width, `height = width /
ratio` with ratio descending 35mm→70mm→IMAX so a bigger format is a taller box ("bigger =
taller", not literal projection ratios). **35mm / 70mm (`print: true`)** get an animated
film-strip treatment (sprocket rails + scrolling label reel, `.flm-filmstrip-*` in
`globals.css`, frozen for reduced-motion/print). **IMAX (`print: false`)** is a normal
digital projection, so a static plaque in IMAX brand blue (`#0057b8`, the second palette
exception — decision #7). `<FilmFormatMarks>` = a bare ratio-shaped rectangle on a pill.
Counts toward Highlights. Not part of the `FilmNotes` sticker. 4DX / ScreenX / Superscreen
are recognised but deliberately unsurfaced.

---

## Decision #17 — International / foreign-language support — `lib/languages.ts`

**International / foreign-language support — `lib/languages.ts`.** The third `screeningTags`
reader. `displayLanguage` → `{ language?, subtitled, openCaptioned, dubbed } | null`
(`LANGUAGE_NAMES`, ~90 entries).
- **Language is per-film** (from Letterboxd, folded into every screening's `screeningTags` at
  fetch time — so it covers every non-English film across all three cinemas, not just the
  ones a cinema tags), while **the caption state is per-session** (the cinema's own caption
  tags, with `Subtitled` assumed for an untagged non-English screening — except animation,
  which often screens dubbed, and except a session that already carries `Open Captioned`).
  How that's resolved and how to correct it: `fetch-films` skill.
- **Open captions are their own state, not a flavour of `subtitled`.** They're burned into
  the print, always on screen, and carry speaker IDs and sound effects — and the two tags mean
  different things to different people: on a non-English film subtitles are *translation*,
  while open captions on an English film are an *accessibility* screening for deaf and
  hard-of-hearing viewers. Collapsing them (as `displayLanguage` used to) made those two
  sessions describe themselves with the identical sentence, which is exactly what someone
  choosing between them needs told apart. So: a separate `openCaptioned` flag, its own pill
  mark `OC`, and two tooltip sentences — "In Korean, with open captions" (the language
  already says what they're for; "open" only adds that they can't be switched off) versus
  "With open captions, including sound descriptions" (on an English film, what they carry
  beyond dialogue *is* the reason to pick that session). `captionMark` returns `OC` ahead of
  `ST`: an open-captioned session is always captioned, where `ST` only promises a track.
- Render: `<LanguageTag>` = the language name only (meta-line chip); `<LanguageMarks>` = the
  per-showtime `OC`/`ST`/`Dub` on a pill (not repeated with the language). Not part of the
  `FilmNotes` sticker. **A non-English original language counts toward Highlights
  (`hasNonEnglishLanguage`), and so does an open-captioned session (`hasOpenCaptions`, #14);
  a plain subtitled or dubbed session of an English film does not.**
- The **`language` preference** (segmented control `any`/`english`/`non-english`,
  `matchesLanguagePref`) filters `preferred` on whether `displayLanguage` found a non-English
  original language. `dubbed` is no longer filtered on — just the pill "Dub" mark.
- **Every tooltip sentence opens with a preposition** ("In Tamil…", "With open captions…",
  "Dubbed into English"), so a row of pills reads in one voice; the dubbed-with-a-language
  case is "Originally in Spanish, dubbed into English" for that reason rather than the
  "Spanish film…" it used to be.
