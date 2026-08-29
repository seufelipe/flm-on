import { CINEMA_LABEL, CINEMA_LOCATION, CINEMA_ORDER } from "@/lib/cinemas";
import { TIMEFRAMES, formatTimeframeRange } from "@/lib/timeframe";
import { SHORT_FILM_MAX_MINS } from "@/lib/duration";
import { DEFAULT_PREFERENCES, isDefault, type Preferences } from "@/lib/preferences";
import { SEGMENT_BASE, controlSegmentClass } from "./controlSegment";

// The settings overlay: a centered modal on desktop, a bottom sheet on mobile (pure CSS via the
// `sm:` breakpoint). Standing viewing preferences — see CLAUDE.md decision #14. No hooks: Escape
// / scroll-lock are handled by PreferencesButton's effect; the close button just autoFocuses.
//
// Each option is a toggle button in the same accent-fill / hard-press style as the filter-bar
// segments (`controlSegment.ts`) — "on" reads the same as a selected filter.

interface Props {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
  onClose: () => void;
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
    <fieldset className="border-0 p-0 m-0">
      <legend className="font-bold uppercase text-xs tracking-widest text-fg">{legend}</legend>
      {description && <p className="mt-0.5 text-xs text-dim">{description}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export default function SettingsPanel({ prefs, onChange, onClose }: Props) {
  const cinemasOn = CINEMA_ORDER.filter((id) => prefs.cinemas[id]).length;
  const timeframesOn = TIMEFRAMES.filter((tf) => prefs.timeframes[tf.id]).length;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close preferences"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-fg/35 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preferences"
        className="relative w-full max-h-full overflow-y-auto border-4 border-border bg-surface shadow-card-lg rounded-card p-6 sm:w-auto sm:max-w-xl sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-black uppercase text-xl tracking-tight">Preferences</h2>
            <p className="mt-1 text-xs text-dim">
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
            </p>
          </div>
          {/* autoFocus gives the dialog a sensible initial focus target without needing a hook. */}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close preferences"
            className="-m-2 shrink-0 p-2 text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
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
        </div>
      </div>
    </div>
  );
}
