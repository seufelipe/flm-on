// Language / international-feature descriptors — the original (non-English) language a film is
// in, and whether a given session is subtitled or dubbed. These ride the same per-session
// carrier as the special-screening tags and film formats (Screening.screeningTags, raw strings),
// but they're their own concept with their own rendering: a small chip on the film card and a
// compact mark on each showtime pill. See lib/screeningTags.ts and lib/formats.ts for the other
// two readers of that field.
//
// Sources: Cineworld encodes `Localization.Language.Tamil` etc. and `Showtime.Accessibility.
// Subtitled` as showtime tags (see lib/scrapers/cineworld.ts, which normalises them to a bare
// language name / "Subtitled"). Light House has long emitted "Subtitled" / "Dubbed" /
// "Open Captioned" in em.additional — those were captured but never shown; they surface now too.

export interface LanguageInfo {
  language?: string; // display-cased original language, e.g. "Tamil" — only when non-English
  subtitled: boolean; // English subtitles (includes open captions)
  dubbed: boolean; // dubbed into English (usually the kids' matinee version)
}

// Recognised original-language tags, lower-cased. The value is the display casing.
const LANGUAGE_NAMES: Record<string, string> = {
  tamil: "Tamil",
  telugu: "Telugu",
  hindi: "Hindi",
  malayalam: "Malayalam",
  kannada: "Kannada",
  punjabi: "Punjabi",
  marathi: "Marathi",
  bengali: "Bengali",
  gujarati: "Gujarati",
  urdu: "Urdu",
  french: "French",
  spanish: "Spanish",
  italian: "Italian",
  german: "German",
  portuguese: "Portuguese",
  polish: "Polish",
  ukrainian: "Ukrainian",
  russian: "Russian",
  romanian: "Romanian",
  dutch: "Dutch",
  greek: "Greek",
  turkish: "Turkish",
  arabic: "Arabic",
  farsi: "Farsi",
  persian: "Persian",
  hebrew: "Hebrew",
  japanese: "Japanese",
  korean: "Korean",
  mandarin: "Mandarin",
  cantonese: "Cantonese",
  chinese: "Chinese",
  thai: "Thai",
  vietnamese: "Vietnamese",
  tagalog: "Tagalog",
  filipino: "Filipino",
  hungarian: "Hungarian",
  czech: "Czech",
  swedish: "Swedish",
  norwegian: "Norwegian",
  danish: "Danish",
  finnish: "Finnish",
  icelandic: "Icelandic",
  irish: "Irish",
};

// Whether a bare word is one of the recognised original-language names (used by the Cineworld
// adapter to strip a trailing "(Tamil)" that duplicates the language tag).
export function isLanguageName(word: string): boolean {
  return word.trim().toLowerCase() in LANGUAGE_NAMES;
}

// Reads the language-related tags off a session. Returns null when there's nothing to show
// (an ordinary English-language, non-subtitled screening).
export function displayLanguage(tags?: string[]): LanguageInfo | null {
  if (!tags?.length) return null;

  let language: string | undefined;
  let subtitled = false;
  let dubbed = false;

  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (LANGUAGE_NAMES[tag] && !language) language = LANGUAGE_NAMES[tag];
    else if (tag === "subtitled" || tag === "open captioned") subtitled = true;
    else if (tag === "dubbed") dubbed = true;
  }

  if (!language && !subtitled && !dubbed) return null;
  return { language, subtitled, dubbed };
}

// A short human sentence for the hover `title` on the pill / plan-row button, merged alongside
// screeningTagsTooltip / filmFormatsTooltip.
export function languageTooltip(tags?: string[]): string | undefined {
  const info = displayLanguage(tags);
  if (!info) return undefined;
  if (info.language && info.subtitled) return `In ${info.language}, with English subtitles`;
  if (info.language && info.dubbed) return `${info.language} film, dubbed into English`;
  if (info.language) return `In ${info.language}`;
  if (info.dubbed) return "Dubbed into English";
  return "With English subtitles";
}

// The compact label shown on a pill / plan row — "TAMIL · ST", "ST", "DUB". Kept terse; the
// full sentence is in the tooltip.
export function languageMarkLabel(info: LanguageInfo): string {
  const parts: string[] = [];
  if (info.language) parts.push(info.language);
  if (info.subtitled) parts.push("ST");
  else if (info.dubbed) parts.push("Dub");
  return parts.join(" · ");
}
