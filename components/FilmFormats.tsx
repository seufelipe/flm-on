import { displayFilmFormats, type FilmFormat } from "@/lib/formats";

// Two renderings of a film-format descriptor (35mm / 70mm / IMAX), parallel to
// components/ScreeningTags.tsx:
//  - <FilmFormatTag>  — a small solid box holding the label, on the film card's meta line
//    (after the duration, before the Letterboxd link). Sized to the format: same width for all,
//    height stepping up 35mm → 70mm → IMAX ("bigger format = taller").
//  - <FilmFormatMarks> — a bare ratio-shaped rectangle after the time on a pill / plan row,
//    the format equivalent of the special-screening ☻ mark. The pill/row button carries the
//    hover tooltip (via filmFormatsTooltip), not the mark itself.
// Decorative, so per CLAUDE.md decision #7 these use --color-fg / --color-bg, never the accent.

const TAG_WIDTH_REM = 2.9;
const MARK_WIDTH_REM = 0.6;

export function FilmFormatTag({ tags }: { tags?: string[] }) {
  const formats = displayFilmFormats(tags);
  if (formats.length === 0) return null;
  return (
    <span className="flex items-center gap-1.5">
      {formats.map((f) => (
        <Box key={f.id} format={f} />
      ))}
    </span>
  );
}

// A column of cream sprocket dots down one edge, tiled to fill the box height whatever the
// format's ratio — so the box reads as a single frame of film strip.
function Perforations({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-[3px] w-[3px] ${
        side === "left" ? "left-[3px]" : "right-[3px]"
      }`}
      style={{
        backgroundImage: "radial-gradient(circle, var(--color-bg) 1.3px, transparent 1.6px)",
        backgroundSize: "3px 5px",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center",
      }}
    />
  );
}

function Box({ format }: { format: FilmFormat }) {
  const tip = `${format.title} — ${format.description}`;
  return (
    <span
      role="img"
      aria-label={tip}
      title={tip}
      className="relative inline-flex shrink-0 cursor-default items-center justify-center rounded-[3px] bg-fg text-bg px-2 text-[0.58rem] font-black uppercase leading-none tracking-tight"
      style={{ width: `${TAG_WIDTH_REM}rem`, height: `${TAG_WIDTH_REM / format.ratio}rem` }}
    >
      <Perforations side="left" />
      {format.label}
      <Perforations side="right" />
    </span>
  );
}

export function FilmFormatMarks({ tags }: { tags?: string[] }) {
  const formats = displayFilmFormats(tags);
  if (formats.length === 0) return null;
  return (
    <>
      {formats.map((f) => (
        <span key={f.id} className="inline-flex items-center leading-none">
          <span
            aria-hidden="true"
            className="block shrink-0 rounded-[1.5px] bg-fg"
            style={{ width: `${MARK_WIDTH_REM}rem`, height: `${MARK_WIDTH_REM / f.ratio}rem` }}
          />
          <span className="sr-only">{f.label} format</span>
        </span>
      ))}
    </>
  );
}
