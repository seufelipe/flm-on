---
paths:
  - "components/ui/**"
  - "components/SettingsPanel.tsx"
  - "components/PlanPanel.tsx"
  - "components/FilterControls.tsx"
  - "components/ScreeningBrowser.tsx"
  - "components/FilmCard.tsx"
  - "components/ScreeningTags.tsx"
  - "components/Masthead.tsx"
  - "lib/useIsCompact.ts"
  - "lib/utils.ts"
  - "app/globals.css"
---

# Radix/shadcn primitives, icons and the mobile drawers

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

## Gotcha

- The four notes over the film list are all one `<Alert>`; **the two banners pass `role="note"`,
  only the two empty states keep the default `role="alert"`** — an assertive live region is for a
  note that appears in answer to something you just did.

## Decisions

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
    speech bubble, the film-format strips. **The `×` close controls are `X` too** (`SettingsPanel`,
    `PlanPanel`), sized `size-5` — no text glyph is left in the UI at all.
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
    - **vaul's scroll locks are off** (`disablePreventScroll={false}` — reads backwards — and
      `noBodyStyles`, defaulted in `ui/drawer.tsx`). Both are iOS-only: one `scrollTo(0, 0)`s on
      open, the other pins `<body>` `position: fixed`, and on a real phone the page behind the sheet
      jumped to the top and snapped back on close. Radix's `RemoveScroll`, already mounted by
      vaul's Content, does the locking without moving the page. Desktop can't reproduce it.
    - **The drawer's horizontal padding goes on the scrolling element, not `DrawerContent`** — the
      option strips full-bleed with `-mx-6 px-6`, which only cancels out on the box that clips them.
    - **`Group`'s `<fieldset>` needs `min-w-0`** — a fieldset won't shrink below `min-content`
      however plainly its computed `min-width` reports `0px`.
    - **Neither drawer has a `×`** (you fling it down or press the scrim); both keep one in the
      modal, where there's nothing to drag.
    - vaul may animate where the Dialog may not (#22): it has no `animationend` handlers and
      unmounts on a `setTimeout`, so it can't hang on a page that isn't being rendered.
