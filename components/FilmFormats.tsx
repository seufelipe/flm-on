import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayFilmFormats, type FilmFormat } from "@/lib/formats";

// Two renderings of a film-format descriptor (35mm / 70mm / IMAX), parallel to
// components/ScreeningTags.tsx:
//  - <FilmFormatTag>  — a small solid box holding the label, on the film card's meta line
//    (after the duration, before the Letterboxd link). Sized to the format: same width for all,
//    height stepping up 35mm → 70mm → IMAX ("bigger format = taller"). For a print format
//    (35mm / 70mm) the label rides a vertical reel that scrolls on a seamless loop
//    (`.flm-filmstrip-*` in globals.css) so the box reads as a frame of film advancing through
//    a gate; IMAX (digital) is a static plaque in the IMAX brand blue instead.
//  - <FilmFormatMarks> — a bare ratio-shaped rectangle after the time on a pill / plan row,
//    the format equivalent of the special-screening ☻ mark (IMAX blue, others ink). The pill/row
//    button carries the hover tooltip (via lib/screeningTooltip.ts), not the mark itself.
// Decorative, so per CLAUDE.md decision #7 the print boxes use --color-fg / --color-bg, never
// the gold accent; IMAX's blue is a third-party brand colour, the one allowed exception here
// (like the Letterboxd mark).

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
// format's ratio — so the box reads as a single frame of film strip. The dots scroll upward
// too (`.flm-filmstrip-rail` in globals.css, its background/animation), roughly locked to the
// label reel's speed, so the whole box reads as one moving strip.
function Perforations({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`flm-filmstrip-rail pointer-events-none absolute inset-y-[3px] w-[3px] ${
        side === "left" ? "left-[3px]" : "right-[3px]"
      }`}
    />
  );
}

// The box explains only its own format — unlike a pill or a plan row, which merge strand +
// format + language into one string (lib/screeningTooltip.ts). Radix rather than a native
// `title`, same as everywhere else; the `aria-label` still carries the text for touch and AT.
function Box({ format }: { format: FilmFormat }) {
  const tip = `${format.title} — ${format.description}`;
  const size = { width: `${TAG_WIDTH_REM}rem`, height: `${TAG_WIDTH_REM / format.ratio}rem` };

  // IMAX (and any future digital large-format): a static plaque in the brand colour — it's a
  // normal digital projection, so no film-strip treatment. Same size/ratio as the print boxes.
  if (!format.print) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={tip}
            className="inline-flex shrink-0 cursor-default items-center justify-center rounded-[3px] px-0.5 text-center text-[0.58rem] font-black uppercase leading-none tracking-tight text-white"
            style={{ ...size, background: format.brandColor ?? "var(--color-fg)" }}
          >
            {format.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={tip}
          className="relative inline-flex shrink-0 cursor-default overflow-hidden rounded-[3px] bg-fg text-bg text-[0.58rem] font-black uppercase leading-none tracking-tight"
          style={size}
        >
          {/* The label rides a two-copy vertical reel scrolling on a seamless loop, so the box
              reads as a frame of film advancing through the gate. The perforation rails stay
              put. */}
          <span className="flm-filmstrip-reel" aria-hidden="true">
            <span className="flm-filmstrip-frame">{format.label}</span>
            <span className="flm-filmstrip-frame">{format.label}</span>
          </span>
          <Perforations side="left" />
          <Perforations side="right" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
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
            className="block shrink-0 rounded-[1.5px]"
            style={{
              width: `${MARK_WIDTH_REM}rem`,
              height: `${MARK_WIDTH_REM / f.ratio}rem`,
              background: f.brandColor ?? "var(--color-fg)",
            }}
          />
          <span className="sr-only">{f.label} format</span>
        </span>
      ))}
    </>
  );
}
