import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The class merger every shadcn / neobrutalism component expects (CLAUDE.md decision #22).
// clsx flattens the conditional forms; twMerge resolves Tailwind conflicts last-wins, which is
// what lets a call site override a component's baked-in classes by just passing `className`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
