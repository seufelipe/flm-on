// A curated editorial tag (e.g. "classic!") shown after a film's title + year as a small
// fixed-width dark sticker whose text scrolls on a seamless marquee loop. Purely decorative
// emphasis — deliberately not the accent colour and not a count/badge (CLAUDE.md decisions
// #7, #8). Curated in data/film-labels.json; see decision #11.
export default function FilmLabel({ text }: { text: string }) {
  return (
    <span
      role="img"
      aria-label={text}
      className="flm-marquee ml-3 rounded-[3px] bg-fg text-bg align-middle text-xs font-bold uppercase tracking-wide"
    >
      {/* Two copies on one track — the loop translates -50% so copy 2 lands exactly where
          copy 1 started, with no visible jump. Hidden from AT; aria-label carries the text. */}
      <span className="flm-marquee-track" aria-hidden="true">
        <span className="flm-marquee-item">{text}</span>
        <span className="flm-marquee-item">{text}</span>
      </span>
    </span>
  );
}
