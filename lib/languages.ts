// Language / international-feature descriptors — the original (non-English) language a film is
// in, and whether a given session is subtitled or dubbed. These ride the same per-session
// carrier as the special-screening tags and film formats (Screening.screeningTags, raw strings),
// but they're their own concept with their own rendering: the language name as a chip on the
// film card (beside the duration), and the subtitled/dubbed state as a compact mark on each
// showtime pill. See lib/screeningTags.ts and lib/formats.ts for the other two readers.
//
// Sources (see CLAUDE.md decision #17):
//  - the *language* is per-film, from Letterboxd's "Primary Language" field, folded into every
//    screening's `screeningTags` by lib/aggregate.ts (Cineworld's `Localization.Language.*`
//    showtime tag is a fallback when the film doesn't resolve on Letterboxd). Manual fixes live
//    in data/language-overrides.json (lib/languageOverrides.ts).
//  - subtitled / dubbed is per-session: Cineworld's `Showtime.Accessibility.Subtitled`, and
//    Light House's long-captured "Subtitled" / "Dubbed" / "Open Captioned" from em.additional.

export interface LanguageInfo {
  language?: string; // display-cased original language, e.g. "Tamil" — only when non-English
  subtitled: boolean; // English subtitles (includes open captions)
  dubbed: boolean; // dubbed into English (usually the kids' matinee version)
}

// Recognised language names, keyed lower-cased; the value is the display casing. Matched against
// Letterboxd's "Primary Language" text and Cineworld's `Localization.Language.*` token. A name
// not listed here still rides in `screeningTags` but won't surface — it shows up in the
// `fetch:batch` "unrecognised screening tags" section, one line to add.
const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  [
    // South Asian
    "Tamil", "Telugu", "Hindi", "Malayalam", "Kannada", "Punjabi", "Marathi", "Bengali",
    "Gujarati", "Urdu", "Odia", "Assamese", "Bhojpuri", "Nepali", "Sinhala", "Sinhalese",
    "Dhivehi",
    // European (non-English)
    "French", "Spanish", "Italian", "German", "Portuguese", "Dutch", "Flemish", "Polish",
    "Ukrainian", "Russian", "Romanian", "Greek", "Turkish", "Hungarian", "Czech", "Slovak",
    "Slovenian", "Slovene", "Croatian", "Serbian", "Serbo-Croatian", "Bosnian", "Bulgarian",
    "Macedonian", "Albanian", "Swedish", "Norwegian", "Danish", "Finnish", "Icelandic",
    "Estonian", "Latvian", "Lithuanian", "Catalan", "Basque", "Galician", "Welsh", "Irish",
    "Scottish Gaelic", "Luxembourgish", "Maltese", "Yiddish", "Latin", "Esperanto",
    // Caucasus / Central Asia / Middle East
    "Georgian", "Armenian", "Azerbaijani", "Kazakh", "Uzbek", "Turkmen", "Kyrgyz", "Tajik",
    "Mongolian", "Tibetan", "Arabic", "Hebrew", "Farsi", "Persian", "Dari", "Pashto", "Kurdish",
    // East / South-East Asia
    "Japanese", "Korean", "Mandarin", "Cantonese", "Chinese", "Thai", "Vietnamese", "Khmer",
    "Lao", "Burmese", "Indonesian", "Malay", "Tagalog", "Filipino", "Javanese",
    // Africa
    "Swahili", "Amharic", "Yoruba", "Hausa", "Igbo", "Zulu", "Xhosa", "Afrikaans", "Wolof",
    "Somali", "Bambara", "Lingala",
  ].map((name) => [name.toLowerCase(), name]),
);

// Whether a bare word is one of the recognised language names (used by the Cineworld adapter to
// strip a trailing "(Tamil)" that duplicates the language tag).
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

// The per-showtime caption mark shown on a pill / plan row — "ST" (subtitled) or "Dub". The
// language name itself lives on the film card, not repeated on every pill.
export function captionMark(info: LanguageInfo): "ST" | "Dub" | null {
  if (info.subtitled) return "ST";
  if (info.dubbed) return "Dub";
  return null;
}

// The "Language" preference filter (lib/preferences.ts): does this screening's film match?
// A film is "non-English" when displayLanguage found an original language name (English never
// yields one). `"any"` passes everything.
export function matchesLanguagePref(
  pref: "any" | "english" | "non-english",
  tags?: string[],
): boolean {
  if (pref === "any") return true;
  const nonEnglish = displayLanguage(tags)?.language != null;
  return pref === "non-english" ? nonEnglish : !nonEnglish;
}
