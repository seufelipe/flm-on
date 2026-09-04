"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import * as React from "react";

import { cn } from "@/lib/utils";

// Radix tooltip, from neobrutalism.dev's shadcn registry (CLAUDE.md decision #22). The structure
// is theirs verbatim so a future `shadcn add` diffs cleanly; only TooltipContent's class list is
// ours. Replaces the native `title` attribute, which can't be styled, can't be positioned, waits
// ~1s on the OS's own timer and never fires on touch at all.
//
// One shared Provider is mounted at the ScreeningBrowser root rather than per-tooltip: it's what
// gives the "already showing one, move to the next pill, no fresh delay" grouping across a whole
// row of showtimes.

function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // The app's dark-sticker treatment (MarqueeSticker's `bg-fg text-bg`), plus the stacked
          // -card shadow so it sits above the page at the same elevation as everything else.
          // Deliberately NOT `bg-main`: gold is reserved for actionable/selected things, and a
          // tooltip is neither (decision #7).
          "z-50 max-w-[16rem] overflow-hidden rounded-base border-2 border-border bg-fg px-2.5 py-1.5",
          "text-xs font-bold tracking-wide text-bg shadow-shadow",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "origin-(--radix-tooltip-content-transform-origin)",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
