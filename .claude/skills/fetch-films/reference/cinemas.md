# The three cinemas — how each is fetched, and where each one lies

Registry: `lib/scrapers/index.ts`. Adding a cinema is one adapter file + one array entry
(deliberately no in-app settings UI). All three return **every** screening; nothing is filtered
at scrape time.

---

## Light House Cinema — `lib/scrapers/lighthouse.ts`

HTML scrape of `https://www.lighthousecinema.ie`.

- `/films` renders **today only** in static HTML. The other day-tabs are empty placeholders
  filled client-side from `/ajax/films-by-day/{n}` (`n` = 1..9), same `div.film` markup.
- Per-film detail (runtime, cert) comes from `/film/{slug}`.
- Per-session descriptors live in `.time > em.additional` — `Parent and Baby`,
  `Cinema Book Club`, `Silver Screen`, `35mm`, and the caption notes `Subtitled` / `Dubbed` /
  `Open Captioned`. Read into `Screening.screeningTags` verbatim.

**`robots.txt` disallows `/ajax/*`, and we use it anyway.** Justified *only* because this is one
deliberate fetch a week from a manual script (decision #9). If the app ever goes back to
per-request live scraping, this has to be revisited — the "continuous automated access against an
explicit disallow" objection comes straight back.

**Where it lies:** re-releases get stamped with the **current** year. That's the input to the
Letterboxd slug guess, so a repertory title can resolve to a different, genuinely-new film of the
same name (`The Sacrifice` → `the-sacrifice-2026`). Pin those in
`data/letterboxd-overrides.json`, keyed on the *wrong* year.

**Silently breaks if:** a new `em.additional` value appears (only the batch report's
"unrecognised screening tags" section catches it); the `/ajax` endpoint or `div.film` markup
changes (falls back to cache, no alert).

**Coverage:** only 9 days out — which is why next-week preview coverage leans on Cineworld + IFI
plus Light House's first ~3 next-week days.

---

## IFI — `lib/scrapers/ifi.ts`

HTML scrape of `https://ifi.ie/whats-on?date=YYYY-MM-DD` — one request per date, concurrency 4.
`robots.txt` allows it.

The redesigned (Astro, 2026) page renders every screening for the day inline, no per-event page
walk. Per `article.screening-card`: `.screening-card__title`, `.screening-card__runtime`,
`.age-rating img[alt]` (cert), `.tags .tag` (first = year, second = director), the
`.screening-card__ctas a[href*="/films/"]` CTA → `filmPageUrl`, and one
`a.screening-card__screening` per bookable session (`shop.ifi.ie/performance/{id}/`, unique per
session — decision #6). Formats come from `svg[data-icon]` inside the booking link.

**Where it lies:**

- **Year** is often the *programme/season* year, not the film's — `+Sons`, a 2025 doc, tagged
  2026. Harmless: it's only the slug-guess hint, and the displayed year comes from the matched
  Letterboxd page (decision #4).
- **Titles** name the *strand*, not the film, for recurring programmes: `Archive at Lunchtime
  August 2026: Programme 1` is really "Horse Plays". The only reliable signal is the poster
  filename or the synopsis' first line. Handled reactively via `corrections` per month — a
  strand-aware model is still wanted, same open question as `CINEMA BOOK CLUB:` and Mystery
  Matinee.
- **Titles are often ALL CAPS**, so the same film from two cinemas reads as two entries unless
  keys are lower-cased. The report flags this as `[CASING DIFFERS]`; new mismatches aren't caught
  automatically.

**Not wired up:** IFI's special-audience strands aren't tagged (only Cineworld + Light House
are), and its "Archive at Lunchtime" strand's sole signal is the `filmPageUrl` slug —
slug-derivation is deliberately not done.

**Silently breaks if:** a new format `svg[data-icon]` appears — it's dropped without a word.

---

## Cineworld Dublin — `lib/scrapers/cineworld.ts`

Not a scrape: a public, unauthenticated JSON API on a Gatsby site (`robots.txt` empty). Theatre
id **`X07A4`**, base `https://www.cineworld.ie/api/gatsby-source-boxofficeapi`. Two calls per
window:

- `schedule?from={ISO}&to={ISO}&theaters={"id":"X07A4","timeZone":"Europe/Dublin"}` (`theaters`
  is URL-encoded JSON; day boundary 03:00 local; accepts an arbitrary range) →
  `{ X07A4: { schedule: { <movieId>: { <YYYY-MM-DD>: [ {id, startsAt, tags[], data.ticketing} ] } } } }`.
  The `provider:"default"` URL (`web.cineworld.ie/order/showtimes/0001-NNNNNN/seats`) is the
  `bookingUrl`.
- `movies?…&ids=…` (chunked at 30) → `{ id, title, originalTitle, runtime (SECONDS — ÷60),
  certificate, release / releases[].releasedAt }`. `filmPageUrl` = `cineworld.ie/movies/{id}-{slug}/`.

`normaliseTags` maps raw tag tokens onto the shared `screeningTags` vocabulary
(`Format.Projection.Imax` → `IMAX`, `Showtime.Event.BigScreenClassics` → `Big Screen Classics`,
`Localization.Language.Tamil` → `Tamil`, `Showtime.Accessibility.AutismFriendly` → relaxed) and
drops the meaningless ones via `IGNORED_TAGS` (`Format.Projection.Digital`/`.Laser`,
`Auditorium.Experience.4dx`/`.ScreenX`/`.Superscreen`, `Showtime.Accessibility.AudioDescription`).
**Unknown `Showtime.Event.*` are kept verbatim** so they land in the report's unrecognised-tags
section. `Big Screen Classics` is normalised and kept but **not** surfaced in the UI, and
`isUnsurfacedTag` keeps it out of that section — it's a decision, not a discovery (decision #13).

An ordinary wide-release showing therefore carries **no** `screeningTags` — nothing is dropped at
scrape time, the multiplex firehose is simply hidden by the "Specials, etc" lens in the UI
(decision #14). The report's "Cineworld — ordinary screenings" section is the only view of what
that lens hides.

**Where it lies:**

- Re-releases get a **current-year** `release` — same trap as Light House. Fix in
  `data/letterboxd-overrides.json`.
- IMAX is sometimes a **separate movie record**, `"…: The IMAX Experience"`. The adapter strips
  the suffix and synthesises an `IMAX` tag so `groupByFilm` merges it back.
- Foreign titles carry a trailing `(Tamil)` — stripped.
- `originalTitle` from the `movies` API is only the **fallback** for the card's original title;
  Letterboxd's `originalname` is canonical (decision #4).

**Known gap:** highlight detection is tag-based only. A plain-digital showing of a genuinely
interesting film shows *only* with the lens off, buried in the full slate — there's no per-title
allowlist to promote it. The report's ordinary-screenings section is the manual check. Because
the whole programme is committed, `showtimes.json` diffs churn with wide-release showtimes.

**Default:** Cineworld is **off** in preferences (Light House + IFI are the everyday view).
