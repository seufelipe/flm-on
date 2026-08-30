import { describe, it, expect } from "vitest";
import { parsePrimaryLanguage, parseOriginalTitle, parseDirector } from "@/lib/letterboxd";

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

describe("parseDirector", () => {
  it("reads the 'Directed by' Twitter meta pair", () => {
    const html = `
      <meta name="twitter:label1" content="Directed by">
      <meta name="twitter:data1" content="Danny Boyle">
      <meta name="twitter:label2" content="Average rating">
      <meta name="twitter:data2" content="4.23 out of 5">`;
    expect(parseDirector(html)).toBe("Danny Boyle");
  });

  it("keeps co-directors comma-joined", () => {
    const html = `
      <meta name="twitter:label1" content="Directed by">
      <meta name="twitter:data1" content="Daniel Scheinert, Daniel Kwan">`;
    expect(parseDirector(html)).toBe("Daniel Scheinert, Daniel Kwan");
  });

  it("matches the label to its own index, not always 1", () => {
    const html = `
      <meta name="twitter:label1" content="Average rating">
      <meta name="twitter:data1" content="3.9 out of 5">
      <meta name="twitter:label2" content="Directed by">
      <meta name="twitter:data2" content="Agnès Varda">`;
    expect(parseDirector(html)).toBe("Agnès Varda");
  });

  it("decodes HTML entities in the name", () => {
    const html = `
      <meta name="twitter:label1" content="Directed by">
      <meta name="twitter:data1" content="Bong Joon-ho &amp; friends">`;
    expect(parseDirector(html)).toBe("Bong Joon-ho & friends");
  });

  it("returns undefined when there's no 'Directed by' pair", () => {
    expect(parseDirector(`<meta name="twitter:label1" content="Average rating">`)).toBeUndefined();
  });
});
