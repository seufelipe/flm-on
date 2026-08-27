import type { MetadataRoute } from "next";

// Static export (next.config `output: "export"`) — this route must be force-static like the rest.
export const dynamic = "force-static";

// Web app manifest — drives the Android/desktop "install" / "add to home screen" experience.
// iOS reads `name`/`short_name` too, but its home-screen title comes primarily from
// `apple-mobile-web-app-title` (set via `metadata.appleWebApp.title` in app/layout.tsx).
//
// URLs are relative to the manifest's own location so they work both at the domain root (local
// dev) and under the GitHub Pages `/flm-on/` basePath without any env plumbing.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "flm on",
    short_name: "flm on",
    description: "Now showing this week at Light House Cinema + IFI. See what's on, make a plan.",
    start_url: ".",
    display: "standalone",
    background_color: "#fcf0ed", // --color-bg
    theme_color: "#fcf0ed",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
