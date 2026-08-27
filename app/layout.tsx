import type { Metadata, Viewport } from "next";
import { Elms_Sans } from "next/font/google";
import "./globals.css";

const elmsSans = Elms_Sans({ subsets: ["latin"], variable: "--font-elms-sans", display: "swap" });

export const metadata: Metadata = {
  // Lowercase "flm on" everywhere it reads as an app name — the browser tab, and (via
  // appleWebApp.title) the iOS home-screen label. The longer tagline lives in `description`.
  title: "flm on",
  description: "Now showing this week at Light House Cinema + IFI. See what’s on, make a plan.",
  appleWebApp: {
    title: "flm on",
    statusBarStyle: "default",
  },
};

// viewportFit: "cover" lets the bottom filter bar read env(safe-area-inset-bottom) to clear the
// home indicator on notched iPhones — without it, the inset always resolves to 0.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#fcf0ed", // --color-bg; tints the status bar when launched from the home screen
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${elmsSans.variable}`}>
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
