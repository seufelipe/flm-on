"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import * as React from "react";

import { cn } from "@/lib/utils";

// Radix dropdown menu, from neobrutalism.dev's shadcn registry (CLAUDE.md decision #22). Trimmed
// to the parts the filter bar actually uses — Root / Trigger / Content / Item / Separator; the
// registry's sub-menus, checkbox and radio items, labels and shortcut slots are not vendored.
// Add them from `https://neobrutalism.dev/r/dropdown-menu.json` if a caller ever needs them.
//
// Three departures from what the registry ships, all deliberate:
//
//  1. `modal` defaults to FALSE here, where Radix defaults it to true. A modal menu mounts
//     `RemoveScroll` and puts `pointer-events: none` on <body> — for a filter bar that is wrong
//     twice: the film list underneath should still scroll while you are picking a day, and a
//     scroll lock is exactly the thing that strands `data-scroll-locked` on <body> if its exit
//     ever stalls (see the animation note in decision #22).
//  2. No enter/exit animation, for the reason recorded in decision #22 — a page that isn't being
//     rendered doesn't tick them, and Radix waits on `animationend` before unmounting.
//  3. `bg-surface`, not the registry's `bg-main`: `--main` is our gold, and gold is reserved for
//     actionable / selected things (decision #7). The selected ROW is what goes gold, via
//     MenuRow in FilterControls — not the whole panel.

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" modal={false} {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "start",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          // z-40: above the sticky bar / dock (z-20) and the plan FAB (z-30), below the dialogs
          // (z-50). `min-w-[--radix-…-trigger-width]` is Radix's stand-in for the `min-w-full`
          // the hand-rolled panel got from being absolutely positioned inside the trigger's box.
          "no-print z-40 w-max min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden",
          "border-2 border-border bg-surface rounded-[10px] shadow-card",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      // No `outline-hidden` here: with asChild this className lands on the caller's row element,
      // and suppressing the outline centrally would silently remove that row's focus cursor.
      // Rows style their own :focus (see MenuRow in FilterControls).
      className={className}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("border-t-2 border-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
