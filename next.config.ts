import type { NextConfig } from "next";

// GitHub Pages serves this repo under /flm-on/, not the domain root — basePath/assetPrefix only
// apply in CI (GITHUB_ACTIONS is set by the Actions runner) so `npm run dev`/`npm run build` stay
// unaffected locally.
const repoBasePath = process.env.GITHUB_ACTIONS ? "/flm-on" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: repoBasePath,
  assetPrefix: repoBasePath,
};

export default nextConfig;
