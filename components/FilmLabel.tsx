import MarqueeSticker from "@/components/MarqueeSticker";

// A curated editorial tag (e.g. "classic!") shown after a film's title + year as a small
// marquee sticker. Purely decorative emphasis — deliberately not the accent colour and not a
// count/badge (CLAUDE.md decisions #7, #8). Curated in data/film-labels.json; see decision #11.
export default function FilmLabel({ text }: { text: string }) {
  return <MarqueeSticker text={text} />;
}
