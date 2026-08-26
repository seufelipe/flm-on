import type { Metadata, Viewport } from "next";
import { Elms_Sans } from "next/font/google";
import "./globals.css";

const elmsSans = Elms_Sans({ subsets: ["latin"], variable: "--font-elms-sans", display: "swap" });

export const metadata: Metadata = {
  title: "FLM ON · See what’s on, make a plan. Updated every Thursday morning",
  description: "Now showing this week at Light House Cinema + IFI.",
};

// viewportFit: "cover" lets the bottom filter bar read env(safe-area-inset-bottom) to clear the
// home indicator on notched iPhones — without it, the inset always resolves to 0.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${elmsSans.variable}`}>
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
