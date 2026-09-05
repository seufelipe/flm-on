import { cva, type VariantProps } from "class-variance-authority";

import * as React from "react";

import { cn } from "@/lib/utils";

// Vendored from neobrutalism.dev's shadcn registry — their structure, our values
// (CLAUDE.md decision #22). Every difference from the registry file is a class value, so a future
// `shadcn add` still diffs cleanly against this:
//
//  - `variant="default"` is our card, not their gold `bg-main`. The notes this renders are
//    information about the view you're in, not actionable things, so the accent is spoken for
//    (decision #7). Their `destructive` (`bg-black text-white`) is dropped rather than restyled:
//    the app has no error state to put in one, and a black-on-white slab is exactly the look
//    decision #7 rules out.
//  - The shell is the card the four notes over the film list already wore:
//    `border-4 / rounded-card / shadow-card / p-4 sm:p-8`, not their
//    `border-2 / rounded-base / px-4 py-3`.
//  - Icons are `size-5`, not `size-4` — 16px reads thin beside a `text-xl font-black` title —
//    so the gutter column and the icon's own optical nudge grow to match.
//  - `AlertTitle` drops their `line-clamp-1`: our titles are sentences ("It's National Cinema
//    Weekend!") and truncate on a phone otherwise.
//
// `role="alert"` is an assertive live region, so it's right only for a note that appears in
// answer to something you just did (the empty states, after a filter change). The standing
// banners pass `role="note"` — props spread after it, so that needs no edit here.
const alertVariants = cva(
  "relative w-full rounded-card border-4 border-border p-4 sm:p-8 grid has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-2 items-start [&>svg]:size-5 [&>svg]:translate-y-1 [&>svg]:text-current shadow-card",
  {
    variants: {
      variant: {
        default: "bg-surface text-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 text-xl font-black uppercase tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      // A grid, so anything loose in here becomes its own row — wrap prose in a <p> rather than
      // handing it a bare text node beside an inline <button>.
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-dim [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
