---
name: fetch-films
description: Run the FLM ON showtimes refresh — scrape Light House, IFI and Cineworld, review the batch report, fix the title / Letterboxd / language / director overrides and labels, trim the Next-week preview, and promote staging to data/showtimes.json. Also the reference for how each cinema is fetched and where each one lies. Use when running `npm run fetch:batch` or `npm run fetch:confirm`, doing the Thursday (or a mid-week) refresh, editing any part of the fetch pipeline (`lib/scrapers/`, `lib/aggregate.ts`, `lib/letterboxd.ts`, `lib/titles.ts`, `lib/hidden.ts`, `lib/filmDiff.ts`, `lib/upcoming.ts`, the `*Overrides` modules, `scripts/fetch-batch.ts`) or any `data/*-overrides.json`, or chasing a wrong title, year, language, director or missing Letterboxd link on a film.
---

# Fetching a new week of films

The weekly curated pipeline (CLAUDE.md decision #9). You drive it; the user approves every
change. **Never commit or push** — the run ends with a diff summary in their hands.

Reference material — read it before editing any of it, not just when the weekly run breaks:

- `reference/pipeline.md` — the modules, in order: adapters → `aggregate` → `titles` → `hidden` →
  `letterboxd` → the override files → `fetch-batch`. **CLAUDE.md no longer carries this**; it's
  here because it's weekly, not because it's unimportant.
- `reference/cinemas.md` — the three cinemas: how each is fetched, and where each one lies.

## Two modes

| | Thursday | Mid-week |
| --- | --- | --- |
| Window | full 7 days, the new programme | today → next Wednesday only |
| Effect | whole programme turns over | **narrows** the published window — days already past drop out |
| Expected diff | long NEW/GONE lists are normal | near-zero churn; anything in NEW/GONE is a real change |

`upcomingDays()` (`lib/date.ts`) decides this from the current date — you don't pass anything.
`nextWeekDays()` is always the next full Thursday-week, so the Next-week preview is stable either
way.

## Step 1 — fetch

```bash
npm run fetch:batch
```

Takes a few minutes (three cinemas plus Letterboxd resolution). It writes **three** files before
anyone has approved anything:

- `data/staging-batch.json` — the new week, not yet published
- `data/upcoming.json` — **rewritten whole** (next week's tease)
- `data/film-labels.json` — pre-fills merged in (existing values are never clobbered)

Run `git status` afterwards so the user sees what moved.

## Step 2 — confirm early, so localhost shows the new week

`app/page.tsx` reads `data/showtimes.json`, **not** staging — until you confirm, localhost is
still showing last week. So confirm now, before the review:

```bash
npm run fetch:confirm
```

Say plainly why this is safe: it writes one local file, `data/showtimes.json` is committed so
`git checkout data/showtimes.json` is a complete undo, and **nothing is published until the
push** — which this skill never does. The commit is the publish gate.

Then start the dev server (`preview_start` with the `flm-dev` config in `.claude/launch.json`)
and give the user the URL. `loadShowtimes()` reads the file per-request in dev, so after any
later re-confirm **a browser reload is enough** — never restart the server.

## Step 3 — read the report

| Section | What a problem looks like |
| --- | --- |
| `Errors:` | Any adapter erroring — that cinema fell back to cached data. Don't review blind; find out why. |
| `Since the last published week` | A long `GONE` list on a **mid-week** run (a cinema silently broke); `PREVIEWED BUT ABSENT` entries; a `NEW` film that's really a held-over one under a changed title |
| unique-films list | `NOT FOUND`; `[CASING DIFFERS]`; a repertory title carrying **this** year; a re-release whose link resolved to a same-name *new* film |
| Pre-filled `film-labels.json` | A pre-fill that reads wrong — `classic!` on an ordinary wide release |
| `Labels` | A film that deserves an editorial label and shows `—` |
| `Languages` | `UNMARKED` sessions (Letterboxd filed it as Animation, so no subtitle was assumed — is it really dubbed?), or a wrong primary language; Letterboxd is often wrong for Indian regional films and dubs |
| `Special screenings` | A strand that should surface but isn't in `lib/screeningTags.ts` `KNOWN` |
| `Unrecognised screening tags` | A new Cineworld `Showtime.Event.*` or a new Light House `em.additional` value |
| `Cineworld — ordinary screenings` | A mistitled blockbuster, or one worth promoting with a label — this is the only view of what the "Specials, etc" lens hides |
| `Next week` candidates | The teaser list, before you trim it |

## Step 4 — resolve a NOT FOUND or a suspicious match

The resolver guesses a slug and accepts the page only if its `og:title` year is within ±1
(`lib/letterboxd.ts`). Two ways it fails: no page at the guessed slug (`NOT FOUND`), or a *wrong*
page that happens to match — a re-release stamped with the current year resolving to a different
film of that name from this year (`The Sacrifice` → `the-sacrifice-2026`). The second is the
dangerous one, because it looks fine in the report.

The report prints, under every `NOT FOUND`, the Letterboxd search link and the exact override
line to paste. **Give the user the search link — do not fetch it yourself** (`/search` is behind
Cloudflare and 403s anything automated; it's fine in their browser). Once they name a candidate,
fetch that `/film/{slug}/` page directly — those aren't blocked — and confirm the year and
director before proposing the pin.

Sanity-check **every** repertory / restoration / re-release link this way, not just the NOT
FOUNDs.

## Step 5 — the fix table

| Symptom | File | Key | After editing |
| --- | --- | --- | --- |
| Mangled or strand-titled name | `data/title-overrides.json` | `corrections` (exact), `stripPrefixes`, `stripAnnotations` (regex) | **re-fetch** |
| Wrong or missing Letterboxd link | `data/letterboxd-overrides.json` | `"title\|year"` — the year the **cinema** reported, often the wrong one, sometimes empty | **re-fetch** |
| Wrong or unwanted language | `data/language-overrides.json` | normalized title; `null` forces unmarked | **re-fetch** |
| Missing co-director | `data/director-overrides.json` | normalized title | **re-fetch** |
| Film shouldn't appear at all | `data/hidden-films.json` | title substring | **re-fetch** |
| Editorial label | `data/film-labels.json` | normalized title | **reload only** |

"normalized title" = `title.trim().toLowerCase()` — **lower-cased, not otherwise cleaned**. It
keeps the cinema's own typography, curly apostrophe included: the key is
`kiki’s delivery service`, and a straight `'` silently adds a *second*, dead entry rather than
editing the one that's live. Copy the key from the report, don't type it.

The Letterboxd key is normalized differently again — the cleaned title **verbatim, exact case**,
plus `|year`. The report prints that one for you too.

**Re-fetch vs reload is the thing to get right.** Everything except `film-labels.json` is applied
inside `lib/aggregate.ts` at *fetch* time and baked into `staging-batch.json` — editing one and
running `fetch:confirm` publishes stale data.

## Step 6 — problems in chat, the catalogue in the browser

Present the **problems** as a list in the chat: one entry per problem, each with the proposed
edit and the reason. The **full film list is reviewed in the browser**, not in chat — never dump
the catalogue into the conversation.

Before handing over, drive the page yourself: it renders, no console errors, the day picker
covers the expected window, the Next-week preview shows the trimmed list, and each film you
flagged looks right (title, year, director, language chip, format box, label sticker).
Screenshot anything you're proposing to change.

Tell the user that the default view is **Cineworld off** and the **"Specials, etc" lens on**
(decisions #14, #16) — the "full list" needs Cineworld enabled in preferences and the lens off.
Those live in localStorage, so their browser keeps the setting between runs.

**Write nothing until they say yes.**

## Step 7 — apply, re-fetch, reload

Apply the approved edits. If any **re-fetch** file changed: `npm run fetch:batch`, then
`npm run fetch:confirm`, then reload the browser. A `film-labels.json`-only change needs neither
— just reload. Loop back to Step 6 for anything the browser turns up.

## Step 8 — trim `data/upcoming.json`

**Always the last thing before the final confirm.** `fetch:batch` rewrites this file whole, so
any re-fetch in Step 7 wipes the trim and it has to be redone. `git diff data/upcoming.json`
shows what the last trim removed.

It's a hand-curated teaser, not a listing — cut it to the films actually worth teasing.

## Step 9 — check, then stop

```bash
npx vitest run
npm run build
```

`/` must still be `○ (Static)` (decision #3). Then summarise the `data/` diff and hand it back.

**Do not commit. Do not push.** If they want out entirely, `git checkout data/` reverts the whole
run.
