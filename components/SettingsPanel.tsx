import { X } from "lucide-react";
import { CINEMA_LABEL, CINEMA_LOCATION, CINEMA_ORDER } from "@/lib/cinemas";
import { TIMEFRAMES, formatTimeframeRange } from "@/lib/timeframe";
import { SHORT_FILM_MAX_MINS } from "@/lib/duration";
import { DEFAULT_PREFERENCES, isDefault, type LanguagePref, type Preferences } from "@/lib/preferences";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DrawerContent } from "@/components/ui/drawer";
import { SEGMENT_BASE, controlSegmentClass } from "./controlSegment";

// The settings overlay: a vaul drawer below `sm:`, a centred <DialogContent> modal above it
// (CLAUDE.md decision #24). `compact` is decided once by PreferencesButton and passed down, so the
// Root it opens and the Content rendered here can never disagree. DialogTitle / DialogDescription
// are used in BOTH shells deliberately — vaul builds on the same Radix Dialog primitives and we
// have one deduped copy, so the context is shared. Standing
// viewing preferences — see decision #14. Escape, scroll-lock, the backdrop press, the focus trap
// and focus restore all come from Radix; PreferencesButton no longer runs an effect for any of
// it, and there is no hand-rolled backdrop <button> here any more.
//
// Each option is a toggle button in the same accent-fill / hard-press style as the filter-bar
// segments (`controlSegment.ts`) — "on" reads the same as a selected filter.

interface Props {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
  /** Decided by PreferencesButton so both halves pick the same shell. */
  compact: boolean;
}

function Toggle({
  label,
  sublabel,
  on,
  locked = false,
  onChange,
}: {
  label: string;
  sublabel: string;
  on: boolean;
  // The last remaining "on" option in a group that requires at least one (Cinemas, Times) —
  // stays selected, just can't be turned off. Not the greyed "disabled" segment (decision #7):
  // it keeps the accent-fill selected look, only the cursor and the click change.
  locked?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) onChange(!on);
      }}
      className={`${SEGMENT_BASE} rounded-[10px] ${locked ? "cursor-default" : "cursor-pointer"} ${controlSegmentClass(on)}`}
    >
      <span className="font-bold uppercase text-sm tracking-wide">{label}</span>
      <span className="text-xs text-dim uppercase tracking-widest">{sublabel}</span>
    </button>
  );
}

// A single-select segmented control, flush like the filter-bar groups in ScreeningBrowser: each
// segment carries its own border + shadow, `-ml-0.5` merges adjacent borders into one line, only
// the ends round outward, and every segment gets an explicit ascending z-index so the active
// segment's `translate` (a new stacking context) doesn't paint over its right-hand neighbour.
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; sublabel?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex">
      {options.map((opt, i) => {
        const first = i === 0;
        const last = i === options.length - 1;
        const radius = first ? "rounded-l-[10px]" : last ? "rounded-r-[10px]" : "";
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            style={{ zIndex: i + 1 }}
            className={`relative shrink-0 border-2 px-3 py-1 flex flex-col items-center justify-center gap-0.5 transition-[translate,box-shadow] duration-100 cursor-pointer ${
              first ? "" : "-ml-0.5"
            } ${radius} ${controlSegmentClass(value === opt.value)}`}
          >
            <span className="font-bold uppercase text-sm tracking-wide">{opt.label}</span>
            {opt.sublabel && (
              <span className="text-xs text-dim uppercase tracking-widest">{opt.sublabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Group({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    // `min-w-0`: a <fieldset> defaults to min-width: min-content and refuses to shrink below it,
    // and the option strip inside is deliberately 48px wider than this box (`-mx-6 px-6`
    // full-bleed). Without it the fieldset props the panel open a few px and the whole thing
    // scrolls sideways. The computed min-width still reads 0px, which is what makes it a puzzle.
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <legend className="font-bold uppercase text-xs tracking-widest text-fg">{legend}</legend>
      {description && <p className="mt-0.5 text-sm text-dim">{description}</p>}
      {/* One non-wrapping row that scrolls sideways on overflow rather than stacking the options
          onto several lines (same idiom as the film-card pill strip). `-mx-6 px-6 sm:-mx-8 sm:px-8`
          cancels the modal's padding so the strip is full-bleed — options sit flush under the
          legend at rest but scroll right to the dialog's inner edge. `pb-2 -mb-2` keeps the
          segments' chunky down-right shadow inside the scroll box without adding visible gap. */}
      <div className="mt-2 -mx-6 px-6 sm:-mx-8 sm:px-8 pb-2 -mb-2 flex flex-nowrap gap-2 overflow-x-auto scrollbar-none">
        {children}
      </div>
    </fieldset>
  );
}

export default function SettingsPanel({ prefs, onChange, compact }: Props) {
  const cinemasOn = CINEMA_ORDER.filter((id) => prefs.cinemas[id]).length;
  const timeframesOn = TIMEFRAMES.filter((tf) => prefs.timeframes[tf.id]).length;

  const body = (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <DialogTitle className="text-xl">Preferences</DialogTitle>
          <DialogDescription className="mt-1">
            Saved on this device — kept across sessions.
            {!isDefault(prefs) && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => onChange(DEFAULT_PREFERENCES)}
                  className="underline underline-offset-2 cursor-pointer"
                >
                  Reset to defaults
                </button>
              </>
            )}
          </DialogDescription>
        </div>
        {/* Modal only. The drawer is dismissed by dragging it down or pressing the scrim, so a ×
            is redundant there — and it sits exactly where the thumb starts the drag. autoFocus
            gives the modal a sensible initial focus target without needing a hook. Dismissal is
            Radix's <DialogClose>, not a hand-rolled onClick: one path for the ×, Escape and the
            scrim, so they can't drift apart. */}
        {!compact && (
          <DialogClose asChild>
            <button
              type="button"
              autoFocus
              aria-label="Close preferences"
              className="-m-2 shrink-0 p-2 cursor-pointer"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </DialogClose>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {/* Cinemas and Times each require at least one on — the last remaining one locks
            rather than letting you empty the whole view. */}
        <Group legend="Available cinemas" description="Only see your favourite places">
          {CINEMA_ORDER.map((id) => (
            <Toggle
              key={id}
              label={CINEMA_LABEL[id]}
              sublabel={CINEMA_LOCATION[id]}
              on={prefs.cinemas[id]}
              locked={prefs.cinemas[id] && cinemasOn === 1}
              onChange={(value) => onChange({ ...prefs, cinemas: { ...prefs.cinemas, [id]: value } })}
            />
          ))}
        </Group>

        <Group legend="Times of day" description="When you normally go">
          {TIMEFRAMES.map((tf) => (
            <Toggle
              key={tf.id}
              label={tf.label}
              sublabel={formatTimeframeRange(tf)}
              on={prefs.timeframes[tf.id]}
              locked={prefs.timeframes[tf.id] && timeframesOn === 1}
              onChange={(value) =>
                onChange({ ...prefs, timeframes: { ...prefs.timeframes, [tf.id]: value } })
              }
            />
          ))}
        </Group>

        <Group legend="General">
          <Toggle
            label="Hide shorts *"
            sublabel={`* films under ${SHORT_FILM_MAX_MINS} min`}
            on={prefs.hideShortFilms}
            onChange={(value) => onChange({ ...prefs, hideShortFilms: value })}
          />
          <Toggle
            label="Only kid-friendly"
            sublabel="g, pg & 12a"
            on={prefs.kidsOnly}
            onChange={(value) => onChange({ ...prefs, kidsOnly: value })}
          />
        </Group>

        <Group legend="Language" description="By the film's original language">
          <Segmented<LanguagePref>
            value={prefs.language}
            // Same gesture as a filter-bar control: pressing the option you're already on
            // clears it back to the default ("any") rather than being a no-op.
            onChange={(value) =>
              onChange({ ...prefs, language: value === prefs.language ? "any" : value })
            }
            options={[
              { value: "any", label: "Any language" },
              { value: "english", label: "English", sublabel: "only" },
              { value: "non-english", label: "Non-English", sublabel: "only" },
            ]}
          />
        </Group>
      </div>
    </>
  );

  // The drawer is scrolled by its own body: DrawerContent is a flex column capped at 85vh, so the
  // content pane takes the remaining height rather than the sheet growing past the screen.
  if (compact) {
    return (
      <DrawerContent className="pb-6">
        {/* `px-6` belongs on the SCROLLING element, not on DrawerContent: the Group option strips
            full-bleed themselves with `-mx-6 px-6`, and that only cancels out when the padding is
            on the same box that clips them. Split across two elements it left ~29px of sideways
            overflow — which is how the modal gets away with `overflow-y-auto p-6` on one node. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2">{body}</div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent className="overflow-y-auto p-6 sm:w-auto sm:max-w-xl sm:p-8">{body}</DialogContent>
  );
}
