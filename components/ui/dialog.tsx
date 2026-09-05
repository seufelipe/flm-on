"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import * as React from "react";

import { cn } from "@/lib/utils";

// Radix dialog, from neobrutalism.dev's shadcn registry (CLAUDE.md decision #22). Two departures
// from what the registry ships, both deliberate:
//
//  1. Their DialogContent is centred-only (`top-1/2 left-1/2 -translate-1/2`) and their separate
//     `sheet` is edge-anchored-only. This app's two overlays are neither: both are a bottom sheet
//     on mobile that becomes a centred modal at `sm:`, so Content carries that responsively.
//  2. Their DialogContent bakes in its own `×` button (and a `lucide-react` import for it). Both
//     call sites here already draw their own close control in their header, so it's dropped.
//
// Content is a DIRECT child of DialogPortal, and that is load-bearing: DialogPortal wraps each of
// its children in its own <Presence>, so a positioning <div> around Content makes Content a
// grandchild — and when `open` goes false the wrapper (which has no exit animation of its own)
// unmounts instantly and tears Content out from under its own cleanup. Concretely that leaked
// `data-scroll-locked="1"` onto <body> forever, leaving `overflow: hidden !important` behind
// after the dialog had closed.
//
// Centring at `sm:` is `inset` + `m-auto`, NOT a `-translate-1/2`: tw-animate-css's enter/exit
// keyframes animate `transform` wholesale, so a static translate would be dropped for the length
// of the animation and the panel would visibly jump.

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "no-print fixed inset-0 z-50 bg-overlay",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "no-print fixed z-50",
          // Mobile: a bottom sheet, inset from the edges by the same 1.25rem the hand-rolled
          // frame used, clearing the home indicator.
          "inset-x-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[calc(100%-2.5rem)]",
          // sm: a centred modal. `inset-4` + `m-auto` + an intrinsic height centres a fixed box
          // with no transform of its own — see the note above on why that matters here.
          "sm:inset-4 sm:m-auto sm:h-fit sm:w-full sm:max-w-lg sm:max-h-[calc(100%-2rem)]",
          // The app's card shell — border-4 / rounded-card / shadow-card-lg, not the registry's
          // lighter border-2 / rounded-base / shadow-shadow. Both call sites want this one.
          "border-4 border-border bg-surface shadow-card-lg rounded-card",
          // NO enter/exit animation, deliberately — the surface these replaced had none either,
          // so this is the previous behaviour rather than a choice of taste, and both directions
          // turned out to be actively unsafe here. A page that is not being rendered (a
          // backgrounded tab, the app behind the home screen) does not tick CSS animations at
          // all, and `animation-fill-mode` still pins the element to frame 0:
          //   - on exit, Radix keeps the node mounted until `animationend`, which never comes.
          //     The scroll lock lives on the OVERLAY, so a stalled exit strands
          //     `data-scroll-locked` on <body> — `overflow: hidden !important`, an unscrollable
          //     page — until the tab is looked at again.
          //   - on enter, the panel is pinned at `opacity: 0` and `translateY(1rem)`, i.e. it
          //     opens invisible and 16px low.
          // Both self-heal once the page is rendered again, which is exactly what makes them the
          // kind of bug you cannot reproduce on demand. Add motion here only with a plan for the
          // not-rendered case.
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-black uppercase tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-dim", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
