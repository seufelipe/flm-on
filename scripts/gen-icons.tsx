/**
 * Regenerates the app icons from a single source design.
 *
 *   npm run gen:icons
 *
 * Outputs (committed):
 *   app/icon.png             512, browser tab / rel="icon"
 *   app/apple-icon.png       180, iOS home-screen (Next auto-links as apple-touch-icon)
 *   app/favicon.ico          64,  legacy /favicon.ico requests (PNG wrapped in an ICO container)
 *   public/icon-192.png      manifest, purpose "any"
 *   public/icon-512.png      manifest, purpose "any"
 *   public/icon-maskable.png 512, manifest, purpose "maskable" (content inside the safe circle)
 *
 * Design: the page's cream background (--color-bg) with a single gold accent disc, carrying the
 * same chunky treatment as the buttons — ink border + the two-tone offset shadow (--shadow-chip:
 * a grey block wrapped in an ink ring).
 */
import { writeFileSync } from "fs";
import path from "path";

const BG = "#fcf0ed"; // --color-bg
const GOLD = "#fdc732"; // --color-accent
const GREY = "#bdbdbd"; // --color-shadow
const INK = "#2f2525"; // --color-fg

/**
 * `discFraction` — disc diameter as a fraction of the 512 canvas. Smaller for the maskable
 * variant so the disc + its offset shadow stay inside the safe circle.
 */
function svg(discFraction: number): string {
  const C = 512;
  const d = Math.round(C * discFraction);
  const r = d / 2;
  const border = Math.round(d * 0.05); // ~ buttons' border-2 on a ~40px pill
  const offset = Math.round(d * 0.1); // ~ --shadow-chip 4px offset
  const ring = Math.round(d * 0.05); // ~ --shadow-chip 2px ink ring

  // Centre the whole mark (disc + its down-right shadow) in the canvas.
  const spanMin = -r - border / 2;
  const spanMax = offset + r + ring + border / 2;
  const cx = Math.round((C - (spanMax + spanMin)) / 2);
  const cy = cx;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">
  <rect width="${C}" height="${C}" fill="${BG}"/>
  <circle cx="${cx + offset}" cy="${cy + offset}" r="${r + ring}" fill="${INK}"/>
  <circle cx="${cx + offset}" cy="${cy + offset}" r="${r}" fill="${GREY}"/>
  <circle cx="${cx}" cy="${cy}" r="${r - border / 2}" fill="${GOLD}" stroke="${INK}" stroke-width="${border}"/>
</svg>`;
}

/** Minimal ICO container wrapping a single PNG (valid for sizes <= 256). */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(0, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png]);
}

(async () => {
  const sharp = (await import("sharp")).default;
  const root = process.cwd();
  const png = (source: string, size: number) =>
    sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

  const standalone = svg(0.66);
  const maskable = svg(0.5);

  writeFileSync(path.join(root, "app/icon.png"), await png(standalone, 512));
  writeFileSync(path.join(root, "app/apple-icon.png"), await png(standalone, 180));
  writeFileSync(path.join(root, "public/icon-192.png"), await png(standalone, 192));
  writeFileSync(path.join(root, "public/icon-512.png"), await png(standalone, 512));
  writeFileSync(path.join(root, "public/icon-maskable.png"), await png(maskable, 512));
  writeFileSync(path.join(root, "app/favicon.ico"), pngToIco(await png(standalone, 64), 64));

  console.log("icons written");
})();
