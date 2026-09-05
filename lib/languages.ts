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
  subtitled: boolean; // a separate English subtitle track
  // Captions burned into the print, always on screen, carrying speaker IDs and sound effects.
  // Kept apart from `subtitled` because they are a different thing for a different audience: on
  // a non-English film subtitles are translation, while open captions on an English film are an
  // accessibility screening for deaf and hard-of-hearing viewers. Collapsing the two (as this
  // did) made those two screenings describe themselves identically.
  openCaptioned: boolean;
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
  let openCaptioned = false;
  let dubbed = false;

  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (LANGUAGE_NAMES[tag] && !language) language = LANGUAGE_NAMES[tag];
    else if (tag === "subtitled") subtitled = true;
    else if (tag === "open captioned") openCaptioned = true;
    else if (tag === "dubbed") dubbed = true;
  }

  if (!language && !subtitled && !openCaptioned && !dubbed) return null;
  return { language, subtitled, openCaptioned, dubbed };
}

// A short human sentence for the hover tooltip on the pill / plan-row button, merged alongside
// screeningTagsTooltip / filmFormatsTooltip by lib/screeningTooltip.ts.
//
// Every sentence opens with a preposition, so a row of pills reads as one voice — which is why
// the dubbed case is "Originally in Spanish…" rather than the "Spanish film…" it used to be.
//
// Open captions get their own two sentences, and the pair deliberately says different things.
// On a non-English film they are the translation, so the language leads and "open" only notes
// that they can't be switched off. On an English film they are an accessibility screening, so
// the sentence names what they carry beyond dialogue — that is the whole reason to pick that
// session, and it is exactly what the old shared "With English subtitles" hid.
export function languageTooltip(tags?: string[]): string | undefined {
  const info = displayLanguage(tags);
  if (!info) return undefined;
  if (info.language && info.openCaptioned) return `In ${info.language}, with open captions`;
  if (info.language && info.subtitled) return `In ${info.language}, with English subtitles`;
  if (info.language && info.dubbed) return `Originally in ${info.language}, dubbed into English`;
  if (info.language) return `In ${info.language}`;
  if (info.dubbed) return "Dubbed into English";
  if (info.openCaptioned) return "With open captions, including sound descriptions";
  return "With English subtitles";
}

// The per-showtime caption mark shown on a pill / plan row — "OC" (open captions), "ST"
// (subtitles) or "Dub". The language name itself lives on the film card, not repeated on every
// pill. "OC" leads because it is the more specific claim: an open-captioned session is always
// captioned, where "ST" only promises a subtitle track.
export function captionMark(info: LanguageInfo): "OC" | "ST" | "Dub" | null {
  if (info.openCaptioned) return "OC";
  if (info.subtitled) return "ST";
  if (info.dubbed) return "Dub";
  return null;
}

// Whether a session carries open captions — burned into the print, always on screen. Its own
// predicate because it feeds the Highlights lens (lib/highlights.ts): an open-captioned session
// is something people actively seek out and there are only a handful a week, so it belongs in
// "Specials, etc" the way a 35mm print does. A plain subtitle track on an English film is NOT
// in that bracket — it's neither scarce nor sought (CLAUDE.md decision #14).
export function hasOpenCaptions(tags?: string[]): boolean {
  return displayLanguage(tags)?.openCaptioned === true;
}

// The "Language" preference filter (lib/preferences.ts): does this screening's film match?
// A film is "non-English" when displayLanguage found an original language name (English never
// yields one). This — NOT the presence of subtitles — is what makes a screening a "highlight":
// an English film with a subtitled/open-captioned session still shows the per-pill "ST" mark but
// isn't a special.
export function hasNonEnglishLanguage(tags?: string[]): boolean {
  return displayLanguage(tags)?.language != null;
}

// The "Language" preference filter (lib/preferences.ts). `"any"` passes everything.
export function matchesLanguagePref(
  pref: "any" | "english" | "non-english",
  tags?: string[],
): boolean {
  if (pref === "any") return true;
  const nonEnglish = hasNonEnglishLanguage(tags);
  return pref === "non-english" ? nonEnglish : !nonEnglish;
}
