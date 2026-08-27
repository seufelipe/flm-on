/**
 * Regenerates the app icons from a single source design.
 *
 *   npx tsx scripts/gen-icons.tsx
 *
 * Outputs (committed):
 *   app/icon.png             512, browser tab / rel="icon"
 *   app/apple-icon.png       180, iOS home-screen (Next auto-links as apple-touch-icon)
 *   app/favicon.ico          64,  legacy /favicon.ico requests (PNG wrapped in an ICO container)
 *   public/icon-192.png      manifest, purpose "any"
 *   public/icon-512.png      manifest, purpose "any"
 *   public/icon-maskable.png 512, manifest, purpose "maskable" (content inside the safe circle)
 *
 * Design: the FLM ON wordmark (Elms Sans 900, "flm" cream over "on" gold) on a cream-framed
 * ink card, sitting on the gold accent field — the app's three brand colours, chunky.
 */
import { ImageResponse } from "next/og";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const elms = readFileSync(path.join(process.cwd(), "scripts/elms-sans-900.ttf"));

const BG = "#fdc732"; // --color-accent
const CREAM = "#fafafa"; // --color-surface
const INK = "#2f2525"; // --color-fg

function Line({ text, size, color, ls }: { text: string; size: number; color: string; ls: number }) {
  return (
    <div style={{ display: "flex", height: Math.round(size * 0.72), alignItems: "center", fontSize: size, letterSpacing: ls, color }}>
      {text}
    </div>
  );
}

/** `inset` = gold margin around the card as a fraction of the 512 canvas. */
function Icon({ inset }: { inset: number }) {
  const pad = Math.round(512 * inset);
  const w = 512 - pad * 2;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: BG, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: pad,
          top: pad,
          width: w,
          height: w,
          background: INK,
          border: `16px solid ${CREAM}`,
          borderRadius: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Elms Sans",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Line text="flm" size={168} color={CREAM} ls={-7} />
          <Line text="on" size={168} color={BG} ls={2} />
        </div>
      </div>
    </div>
  );
}

async function render(inset: number, size: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const res = new ImageResponse(<Icon inset={inset} />, {
    width: 512,
    height: 512,
    fonts: [{ name: "Elms Sans", data: elms, weight: 900, style: "normal" }],
  });
  return sharp(Buffer.from(await res.arrayBuffer())).resize(size, size).png().toBuffer();
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
  const root = process.cwd();
  // Standalone icon: a little gold breathing room around the framed card.
  const standalone = 0.09;
  // Maskable: more inset so the card + text stay inside the safe circle after a round mask.
  const maskable = 0.16;

  writeFileSync(path.join(root, "app/icon.png"), await render(standalone, 512));
  writeFileSync(path.join(root, "app/apple-icon.png"), await render(standalone, 180));
  writeFileSync(path.join(root, "public/icon-192.png"), await render(standalone, 192));
  writeFileSync(path.join(root, "public/icon-512.png"), await render(standalone, 512));
  writeFileSync(path.join(root, "public/icon-maskable.png"), await render(maskable, 512));
  writeFileSync(path.join(root, "app/favicon.ico"), pngToIco(await render(standalone, 64), 64));

  console.log("icons written");
})();
