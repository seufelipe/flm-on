"use client";

import { Drawer as DrawerPrimitive } from "vaul";

import * as React from "react";

import { cn } from "@/lib/utils";

// vaul-backed bottom drawer, from neobrutalism.dev's shadcn registry, restyled to our tokens.
// Used below `sm:` by both overlays; above it they stay the centred <DialogContent> (decision #24).
// vaul builds on @radix-ui/react-dialog's own primitives and we have a single deduped copy of it,
// so the Radix Dialog context is shared — <DialogTitle> / <DialogDescription> work inside a
// DrawerContent unchanged, which is why SettingsPanel needs no per-shell title components.
//
// Departures from what the registry ships:
//  1. `shouldScaleBackground` defaults to FALSE. Theirs defaults it true, which writes
//     `document.body.style.background` (black) and only does anything if the app wraps its content
//     in a `[vaul-drawer-wrapper]` element. On a warm cream page that's a visible regression for
//     an effect we aren't asking for.
//  2. `bg-surface` + `border-4` + `rounded-t-card` — the app's card shell, not the registry's
//     `bg-background` / `border-2` / `rounded-base`.
//  3. No CSS enter/exit animation classes on the overlay. vaul drives both the panel transform and
//     the overlay opacity from the drag itself via inline styles; layering keyframes on top fights
//     it. This also keeps us clear of the stall documented in decision #22 — though note vaul is
//     structurally safer there anyway: it never gates unmount on `animationend`.

function Drawer({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    />
  );
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn("no-print fixed inset-0 z-50 bg-overlay", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "no-print fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[85vh] flex-col",
          // Flush to the bottom edge, so the sheet owes its own clearance for the home indicator.
          "pb-[env(safe-area-inset-bottom)]",
          // Flush to the screen edges, so only the top corners round and the bottom border would
          // sit off-screen — dropped rather than wasting 4px under the home indicator.
          "border-4 border-b-0 border-border bg-surface rounded-t-card",
          className,
        )}
        {...props}
      >
        {/* The grab handle. Ink, not a hairline — it's an affordance, and this app draws those solid. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 mb-1 h-1.5 w-14 shrink-0 rounded-full bg-dim"
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-black uppercase tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-xs text-dim", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
