import { describe, it, expect } from "vitest";
import { parsePrimaryLanguage, parseOriginalTitle } from "@/lib/letterboxd";

// Snippets mirror Letterboxd's real details-panel markup (server HTML, `hidden="until-found"`).
const multiLang = `
  <h3><span>Countries</span></h3> <div class="text-sluglist"> <a href="/films/country/france/" class="text-slug"> France </a> </div>
  <h3><span>Primary Language</span></h3>
  <div class="text-sluglist"> <a href="/films/language/french/" class="text-slug">French</a> </div>
  <h3><span>Spoken Languages</span></h3>
  <div class="text-sluglist"> <a href="/films/language/english/" class="text-slug">English</a> <a href="/films/language/french/" class="text-slug">French</a> </div>`;

const singleLang = `
  <h3><span>Language</span></h3>
  <div class="text-sluglist"> <a href="/films/language/tamil/" class="text-slug">Tamil</a> </div>
  <h3><span>Alternative Titles</span></h3>`;

const englishSingle = `
  <h3><span>Language</span></h3>
  <div class="text-sluglist"> <a href="/films/language/english/" class="text-slug">English</a> </div>`;

const silent = `
  <h3><span>Primary Language</span></h3>
  <div class="text-sluglist"> <a href="/films/language/no-spoken-language/" class="text-slug">No spoken language</a> </div>`;

describe("parsePrimaryLanguage", () => {
  it("reads the 'Primary Language' header (multi-language film)", () => {
    expect(parsePrimaryLanguage(multiLang)).toBe("French");
  });

  it("reads the plain 'Language' header (single-language film)", () => {
    expect(parsePrimaryLanguage(singleLang)).toBe("Tamil");
  });

  it("returns undefined for English", () => {
    expect(parsePrimaryLanguage(englishSingle)).toBeUndefined();
  });

  it("returns undefined for a silent film / no-language placeholder", () => {
    expect(parsePrimaryLanguage(silent)).toBeUndefined();
  });

  it("returns undefined when there's no language block at all", () => {
    expect(parsePrimaryLanguage("<h3><span>Countries</span></h3><div>...</div>")).toBeUndefined();
  });

  it("does not mistake 'Spoken Languages' for the primary", () => {
    const spokenOnly = `<h3><span>Spoken Languages</span></h3> <div class="text-sluglist"> <a href="/films/language/german/" class="text-slug">German</a> </div>`;
    expect(parsePrimaryLanguage(spokenOnly)).toBeUndefined();
  });
});

describe("parseOriginalTitle", () => {
  it("reads the masthead <h2 class=originalname>, stripping the inner <em> and decoding entities", () => {
    expect(
      parseOriginalTitle(
        `<h2 class="originalname" lang="ja"><em class="quoted-creative-work-title">ドライブ・マイ・カー</em></h2>`,
      ),
    ).toBe("ドライブ・マイ・カー");
    expect(
      parseOriginalTitle(
        `<h2 class="originalname" lang="fr">La bataille de Gaulle: L&#039;âge de fer</h2>`,
      ),
    ).toBe("La bataille de Gaulle: L'âge de fer");
  });

  it("returns undefined when the film has no original-name heading", () => {
    expect(parseOriginalTitle(`<h1 class="headline-1 primaryname"><span>Trainspotting</span></h1>`)).toBeUndefined();
  });
});
