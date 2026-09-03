import PreferencesButton from "./PreferencesButton";
import ActivePreferenceNote from "./ActivePreferenceNote";

// The app masthead — title + tagline. Rendered by ScreeningBrowser (not app/page.tsx) so the
// `lg:` two-column grid can place it in the right rail above the sticky plan panel while it still
// stacks on top on mobile (CLAUDE.md decision #5).
//
// The Preferences button lives in the *filter bar* on desktop (FilterControls `layout="bar"` —
// there's room now that Day/Time/Place are menus); on mobile, where the filter bar is the fixed
// bottom dock, it stays here in the masthead.
export default function Masthead() {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
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
      <div className="lg:hidden shrink-0">
        <PreferencesButton />
      </div>
    </header>
  );
}
