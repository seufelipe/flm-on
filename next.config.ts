import type { NextConfig } from "next";

// GitHub Pages serves this repo under /flm-on/, not the domain root — basePath/assetPrefix only
// apply in CI (GITHUB_ACTIONS is set by the Actions runner) so `npm run dev`/`npm run build` stay
// unaffected locally.
const repoBasePath = process.env.GITHUB_ACTIONS ? "/flm-on" : "";

const nextConfig: NextConfig = {
  // Next 16 refuses cross-origin requests for /_next/* dev resources by default, which silently
  // breaks testing on a phone over the LAN: the HTML arrives but no JS loads, so ScreeningBrowser
  // never hydrates and the page stops after the masthead. Dev-only — `allowedDevOrigins` has no
  // effect on `next build`/`output: "export"`.
  allowedDevOrigins: ["192.168.0.241"],
  output: "export",
  basePath: repoBasePath,
  assetPrefix: repoBasePath,
};

export default nextConfig;
