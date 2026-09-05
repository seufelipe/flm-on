# Vendored primitives — Radix, shadcn and vaul

Decisions #22 and #24 in full — why the hand-rolled overlays and native `title` tooltips were
replaced, how the token bridge is shaped, and why the two overlays change shell at `sm:`.
CLAUDE.md keeps the landmines; this is why each one is there.

Verbatim from CLAUDE.md, which now carries only the rules. **Read this before changing
anything it covers, and update it in the same commit** — the same discipline CLAUDE.md and
the `fetch-films` skill are under.

---

## Decision #22 — Component primitives are vendored from neobrutalism.dev's shadcn registry

**Component primitives are vendored from neobrutalism.dev's shadcn registry — their
structure, our values** (`components/ui/`, `lib/utils.ts`, the token bridge in
`app/globals.css`). The app had hand-rolled every interactive surface: tooltips were the
native `title` attribute (unstyleable, unpositionable, ~1s on the OS's own timer, and it
never fires on touch at all — **no `title` attribute is left in the app**, and adding one
back is a regression), and three separate overlays — `FilterMenu`'s own `pointerdown`
+ Escape listener, `SettingsPanel` and `PlanButton` — each declared `role="dialog"
aria-modal="true"` with no focus trap, no focus restore and no inert background. Radix does
all of that properly, and shadcn components are **copied source, not a dependency**, so
taking them costs nothing in control.
- **Decision #7 is unchanged — still chunky, not brutalist.** What was adopted is their token
  *vocabulary* (`bg-main`, `rounded-base`, `shadow-shadow`, `translate-x-boxShadowX`), not
  their look: 5px corners, a flat single-tone black shadow and pure black on cool grey are
  exactly what #7 was written to rule out. The bridge maps every one of those names onto the
  values we already had, so a copied-in component comes out looking like this app.
- **The bridge is shaped as `:root` raw values + an `@theme inline` mapping**, which is the
  shape neobrutalism.dev's styling customizer emits. A future paste from it drops into the
  `:root` block and nothing else moves. Note the customizer itself caps radius at 15px and
  only emits a single-tone shadow — its output is a *starting point* to hand-edit, which is
  why our `--border-radius: 16px`-class values and two-tone `--shadow` live there directly.
- **`--box-shadow-x/y` is the shadow's total REACH (6px), not its 4px offset.** Their shadow
  is single-tone so the two are the same number; ours wraps a 4px grey block in a 2px ink
  ring. Set it to 4 and every component's press lands 2px shy of the edge it's meant to fall
  into. This is the one value in the bridge that is not a straight copy of theirs.
- **`--main` is our gold, so never take `variant="default"` unexamined.** Their components
  default to `bg-main` as an ordinary fill; ours reserves the accent for actionable and
  selected things (#7). Restyle to `neutral` on the way in — the tooltip is the card
  treatment (`bg-surface text-fg` + ink border + `shadow-shadow`) for exactly this reason,
  not `bg-main`.
- **A Radix tooltip is a hover/focus surface: touch never opens one.** That's not a
  regression (native `title` did nothing on touch either), but it does mean the text has to
  exist somewhere a screen reader and a phone can reach — so every tooltip in the app has the
  same string on an `aria-label` (the pill, the format box, the `FilmNotes` sticker, the
  calendar button). Don't let the tooltip become the only copy. The plan rows go further and
  carry *only* the `aria-label` — their tooltips were dropped for flickering as you move down a
  list you have already chosen from. Two `title`s were
  *dropped* rather than converted, for saying nothing the visible text didn't already: `"for
  kids!"` on the sticker reading "for kids!", and `"Letterboxd"` on a link already labelled
  "View on Letterboxd".
- One shared `TooltipProvider` is mounted at the `ScreeningBrowser` root rather than one per
  tooltip: that's what gives the "already showing one, move along the row of showtimes, no
  fresh delay" grouping. `delayDuration` is 300ms — Radix's own default of 0 makes a row of
  pills flash tooltips as you scan across it.
- **No enter/exit animation on the dialog, and that is a correctness rule rather than taste.**
  A page that isn't being rendered — a backgrounded tab, the installed app behind the home
  screen — doesn't tick CSS animations at all, while `animation-fill-mode` still pins the
  element to frame 0. Radix keeps a node mounted until its exit animation fires
  `animationend`, and it mounts the scroll lock on the **overlay**, so a stalled exit strands
  `data-scroll-locked` on `<body>` — `overflow: hidden !important`, an unscrollable page —
  until the tab is looked at again. A stalled *enter* is the mirror image: the panel sits at
  `opacity: 0`, 16px low, i.e. it opens invisible. Both self-heal the moment the page renders
  again, which is precisely what makes them impossible to reproduce on demand. The surfaces
  these replaced had no animation either, so removing it also kept the swap invisible. Add
  motion to a Radix surface here only with a plan for the not-rendered case. (The tooltip
  still carries its registry animations: it's a hover surface, so it can only open on a page
  that is already rendering, and a stalled exit merely leaves it on screen until you look
  back. Same class, much smaller blast radius — but it is the same trap.)
- **`DialogContent` positions itself; it is a direct child of `DialogPortal`.** `DialogPortal`
  wraps each of its children in its own `<Presence>`, so a positioning `<div>` around Content
  makes Content a grandchild and the wrapper unmounts out from under it. Centring at `sm:` is
  `inset-4` + `m-auto` rather than `-translate-1/2`, so that if motion is ever added back the
  keyframes' own `transform` can't drop a static translate mid-animation.
- **Dismissal is `<DialogClose asChild>`, never a hand-rolled `onClick`.** The `×` in
  `SettingsPanel` started as a plain button calling an `onClose` prop, which meant the modal had
  two ways to close — Radix's (Escape, the scrim) and ours — and only one of them was Radix's to
  keep working. Wrapping the button in `DialogClose` folds it into the same path and deleted the
  prop: `PreferencesButton` no longer threads `onClose` at all, since `setOpen` already sits on
  the Root's `onOpenChange`. `asChild` keeps our own button markup, so `autoFocus` and the
  `aria-label` are untouched. (`PlanPanel`'s `×` still takes an `onClose` prop — it is rendered
  in the desktop rail as well as in a Dialog, and the rail has no Radix Root to close.)
- **`DialogDescription` is `text-sm`, not the `text-xs` it was vendored at.** The registry's own
  value is `text-sm`; shrinking it made the panel's only prose 12px, two steps under the 16px the
  same kind of sentence gets in an `<Alert>` on the page behind it — and the uppercase 12px group
  legends already had the eyebrow job. `SettingsPanel`'s `Group` description moved with it so the
  two read as one level. Worth a look if a longer description is ever added: the option strips
  below are non-wrapping and full-bleed (`-mx-6 px-6`), so anything that changes the panel's
  width budget wants checking in the drawer at 375px too.
- `components.json` points the shadcn CLI at our root-level `@/` layout (no `src/`), so
  `npx shadcn@latest add https://neobrutalism.dev/r/<name>.json` lands in `components/ui/`.
  Adopted so far: **tooltip**, **dialog** and **alert** — the dialog covering both overlays,
  since neither the registry's centred-only `dialog` nor its edge-anchored `sheet` matches
  this app's one shape (a bottom sheet on mobile that becomes a centred modal at `sm:`).
  **`alert` is the first one that brought a dependency**: `class-variance-authority`, which
  every registry component with a `variant` prop is written against. Hand-rolling around
  `cva` would have made this the first vendored file that *doesn't* diff cleanly against a
  future `shadcn add`, which is the whole point of taking their structure.
  Every hover surface is a `<Tooltip>`: the showtime pills (`FilmCard`), the format boxes on
  the meta line (`FilmFormats`), the
  `FilmNotes` marquee and the calendar button (`PlanPanel`). `MarqueeSticker` takes a `ref` and
  spreads the rest of its props onto its outer span purely so `TooltipTrigger asChild` can
  clone it.
  `SettingsPanel` and `PlanButton` render `<DialogContent>` above `sm:` (and a vaul
  `<DrawerContent>` below it — #24) and no longer hand-roll a backdrop, an Escape listener or a
  scroll lock; `PreferencesButton` and `PlanButton` each
  dropped an entire `useEffect`. `FilterMenu` uses **dropdown-menu** (not `popover`): its rows
  already claimed `role="menuitemradio"`, so the menu primitive is the honest one — and it
  brings the arrow-key / Home / End / typeahead navigation those rows had always advertised
  and never had. Nothing hand-rolled is left.
- **`modal={false}` on the dropdown, and that is not cosmetic.** Radix defaults menus to
  modal, which mounts `RemoveScroll` and puts `pointer-events: none` on `<body>`. For a
  filter bar that is wrong twice over: the film list underneath should stay scrollable while
  you pick a day, and a scroll lock is precisely what strands `data-scroll-locked` if its
  exit ever stalls.
- **Two things Radix's `asChild` will not let a child override.** `role` is applied by the
  Radix primitive *before* it spreads your props, so `role="menuitemradio"` has to be handed
  to `DropdownMenuItem` — set on the child button it is silently replaced by `menuitem`
  (`aria-checked`, by contrast, does survive from the child). And `data-highlighted`, Radix's
  own keyboard-cursor flag, never lands on these rows at all, so **the menu's focus cursor is
  anchored on `:focus`** — an inset outline, applied in both states so it still reads on the
  gold selected row. Suppressing the outline centrally in `ui/dropdown-menu.tsx` would remove
  that cursor from every caller, which is why `DropdownMenuItem` sets no `outline-hidden`.
  **Confirmed by hand in a real browser** — it cannot be checked from an automated pane, where
  `document.hasFocus()` is false and `:focus` therefore matches nothing however correct the
  CSS is.
- **A close only clears the slot it owns** (`menuOpenChange` in `FilterControls`). Pressing a
  second trigger while a menu is open fires both a close (the press is outside the first
  menu) and an open, in either order; clearing `openMenu` unconditionally on close would
  sometimes wipe the menu that had just opened, so moving between filters took two clicks.
- **Three things about `alert` worth knowing before editing it.** Its `role="alert"` is an
  assertive live region, so it is right only for a note that appears in answer to something
  you just did; the standing banners pass `role="note"`, which works with no edit to the
  vendored file because it spreads props *after* `role` (the opposite of what `asChild` does
  two bullets up). `AlertDescription` is a **grid**, so a bare text node and an inline
  `<button>` beside it become two rows — the empty state's "…your current view. Reset" has to
  sit inside a `<p>`. And the registry's `line-clamp-1` on `AlertTitle` is dropped: these
  titles are sentences ("It's National Cinema Weekend!") and truncate on a phone otherwise.

---

## Decision #24 — Below `sm:` both overlays are a vaul drawer; above it they stay the centred modal

**Below `sm:` both overlays are a vaul drawer; above it they stay the centred modal**
(`components/ui/drawer.tsx`, `lib/useIsCompact.ts`). The user's call after feeling both on a
phone: a bottom sheet you can fling away beats a modal you have to aim at a close button for,
and the plan especially is opened one-handed mid-browse. Above `sm:` a drawer would be wrong —
a settings panel glued to the bottom of a 1280px window is not a modal, so `DialogContent`
stays there.
- **The breakpoint lives in exactly one place** — `useIsCompact()`, 640px, which is the same
  line `DialogContent` already switches its own positioning on, so the app keeps one idea of
  "phone-shaped" rather than gaining a second breakpoint. Built on `useSyncExternalStore` like
  `lib/preferences.ts` and `lib/plan.ts`: the server snapshot resolves "not compact", so SSR
  and the first client render agree and hydration stays clean; React then re-renders with the
  real value. Invisible in practice because neither overlay is ever open on first paint. It
  re-evaluates live — resizing across 640px swaps the shell with no reload.
- **`PreferencesButton` owns the decision and passes `compact` down to `SettingsPanel`**, so
  the Root that opens and the Content that renders can never disagree. Both halves have to
  match: a `<DrawerContent>` inside a `<Dialog>` finds no context.
- **`DialogTitle` / `DialogDescription` are used inside the drawer too, deliberately.** vaul is
  built on `@radix-ui/react-dialog`'s own primitives (its `Drawer.Title` *is*
  `DialogPrimitive.Title`) and npm dedupes us to a single copy, so the context is shared. That
  is the whole reason `SettingsPanel` needs only one set of title components rather than a
  per-shell pair. If a second copy of `@radix-ui/react-dialog` ever gets installed, this breaks
  — and it breaks as a context error, not a style bug.
- **`shouldScaleBackground` is forced to `false`.** The registry defaults it true, which writes
  `document.body.style.background` (black) and only does anything if the app wraps its content
  in a `[vaul-drawer-wrapper]`. On a warm cream page that is a visible regression for an effect
  nobody asked for.
- **vaul is structurally safer than Radix Presence for decision #22's animation trap**, which
  is why a drawer may animate where the dialog may not: it has **zero** `transitionend` /
  `animationend` handlers and unmounts on a `setTimeout`, so it does not hang forever on a page
  that is not being rendered. It has its own scroll lock (`usePreventScroll`, `position: fixed`
  on `<body>` with a saved offset) rather than Radix's `overflow: hidden`. **Teardown
  confirmed by hand**: open the drawer, close it, the page still scrolls. Worth knowing that
  this is not observable in an automated pane — a page that isn't rendered throttles vaul's
  unmount timer indefinitely, so the sheet appears to hang open there and does not.
- **Costs, accepted:** ~68KB of shipped JS (856K → 924K of chunks), and vaul has not published
  since December 2024. It declares React 19 in peers and works on 19.2.
- The sheet is flush to the screen edges, so it carries `pb-[env(safe-area-inset-bottom)]`
  itself — nothing else is clearing the home indicator for it.
- **Bottom-anchored, not right — considered and rejected.** vaul supports `direction="right"`,
  but its `shouldDrag` returns `true` unconditionally for `left`/`right`: every nested-scroll
  guard it has (the `scrollTop` checks, the `scrollLockTimeout`) runs only for `top`/`bottom`,
  and it never reads `scrollLeft`. The settings panel is four full-bleed `overflow-x-auto`
  option strips (#14), so a side sheet would put the dismiss gesture on the *same axis* as the
  content's own scrolling — swiping the Cinemas row to reach Cineworld would fling the drawer
  shut. `data-vaul-no-drag` on the strips does fix it, at the price of not being able to
  dismiss from an option row at all. A bottom sheet keeps the dismiss axis perpendicular to
  the scroll axis, which is a large part of why it feels right; that's the reason to keep it,
  not inertia.
- **Neither drawer has a `×`** (user's call): you fling it down or press the scrim, and a close
  control sits exactly where the thumb starts the drag. `SettingsPanel` gates its button on
  `!compact`; `PlanButton` passes no `onClose`, which is already how `PlanPanel` decides
  whether to draw one. Both keep it in the modal, where there is nothing to drag.
- **The drawer's horizontal padding goes on the SCROLLING element, not on `DrawerContent`.**
  The settings option strips full-bleed themselves with `-mx-6 px-6`, which only cancels out
  when that padding is on the same box that clips them — the modal gets this for free by
  putting `overflow-y-auto p-6` on one node. Split across two it left ~29px of sideways scroll.
- **`Group`'s `<fieldset>` needs `min-w-0`.** A fieldset defaults to `min-width: min-content`
  and will not shrink below it, and the strip inside is deliberately 48px wider than the box,
  so the fieldset propped the panel open ~5px and the whole thing scrolled sideways. Its
  computed `min-width` still reports `0px`, which is what makes this one hard to see. It
  applies to the modal too — the bug was latent there, the drawer just made it obvious.
