import PreferencesButton from "./PreferencesButton";
import ActivePreferenceNote from "./ActivePreferenceNote";

// The "FLM ON" title + tagline. On desktop this sits at the top of the right-rail card, above the
// pinned plan panel (it scrolls away as you go down the film list — CLAUDE.md decision #5); on
// mobile it's the page header, with the Preferences button top-right (on desktop that button
// lives in the filter bar).
export function MastheadTitle() {
  return (
    <div>
      {/* relative + w-fit: the anchor for <ActivePreferenceNote>'s layered stickers — the kids
          marquee sits absolutely over the title's top edge, the language tag tucks under it
          like a subtitle. */}
      <div className="relative w-fit">
        <h1 className="text-4xl md:text-6xl lg:text-5xl font-black uppercase tracking-tighter">FLM ON</h1>
        <ActivePreferenceNote />
      </div>
      <p className="mt-3 font-bold text-dim uppercase text-sm tracking-widest">
        See what&rsquo;s on, make a plan. Updated every Thursday morning
      </p>
    </div>
  );
}

export default function Masthead() {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <MastheadTitle />
      <div className="lg:hidden shrink-0">
        <PreferencesButton />
      </div>
    </header>
  );
}
