---
paths:
  - "lib/scrapers/**"
  - "lib/cinemas.ts"
  - "lib/aggregate.ts"
---

# Cineworld

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

16. **Cineworld Dublin — a JSON-API adapter, scraped in full** (`lib/scrapers/cineworld.ts`).
    What matters outside a fetch is that **an ordinary wide-release showing ends up with no
    `screeningTags` at all** — nothing is dropped at scrape time, so the whole multiplex slate is
    in `showtimes.json` and it's the **"Specials, etc" Highlights lens** (decision #14) that keeps
    it out of view. **Cineworld also defaults off** in preferences. Consequence: its git diffs
    churn with wide-release showtimes.

    Endpoints, the tag-normalisation vocabulary, the separate `"…: The IMAX Experience"` movie
    record and the rest: the `fetch-films` skill's `reference/cinemas.md`.

    ⚠️ **Currently paused** (`PAUSED_CINEMAS` in `lib/cinemas.ts`, since 24 Sep 2026): the API
    started answering automated requests with a Cloudflare bot challenge (403), and the cache
    fallback served a week-old, near-empty slate. A paused cinema is **dropped whole, not shown
    stale** — `lib/scrapers/index.ts` filters it out of `adapters` (no fetch, so no cache
    fallback either), and the UI iterates `LIVE_CINEMAS` (Settings toggles, the Place filter's
    count). It stays in `CINEMA_ORDER` on purpose, so `normalize` keeps a saved Cineworld
    preference for when it returns. Unpause = delete the entry, re-fetch. Don't try to get past
    the challenge — the fix is a different source.
