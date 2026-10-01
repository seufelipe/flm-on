---
paths:
  - "app/manifest.ts"
  - "app/layout.tsx"
  - "scripts/gen-icons.tsx"
  - "public/**"
---

# Installability and icons

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

10. **Installable as "flm on" (lowercase).** `<title>`, `appleWebApp.title`, and `manifest.ts`
    `name`/`short_name` are the lowercase string; the descriptive text is `description`.
    `app/manifest.ts` needs `export const dynamic = "force-static"` and **relative** URLs
    (`start_url: "."`, `src: "icon-192.png"`) so it works at the domain root locally and under
    the `/flm-on/` GitHub Pages basePath. Icons are **generated, committed PNGs** —
    `npm run gen:icons` (`scripts/gen-icons.tsx`, SVG → `sharp`) writes `app/icon.png` /
    `app/apple-icon.png` / `app/favicon.ico` (a hand-rolled ICO container) /
    `public/icon-{192,512,maskable}.png`. Re-run if the palette changes.
