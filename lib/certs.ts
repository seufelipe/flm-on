// IFCO age-classification colours (ifco.ie/en/ifco/pages/guidelines), lightly muted so they
// sit on FLM ON's warm cream palette instead of vibrating against it — same hues as the
// official symbols, ~10-15% less saturation. PG is pulled further than the rest: the official
// pure-green (#00ff00) is unreadable on a light page at any text size.
//
// Keyed by the cert string as scraped (already upper-cased by the adapters). Both the
// "A"-suffixed and bare forms map to the same colour. Anything not listed (e.g. "TBC") has no
// entry and renders as a plain neutral badge.
export const CERT_COLORS: Record<string, string> = {
  G: "#1f7ae8",
  PG: "#3cae4a",
  "12A": "#f2861a",
  "12": "#f2861a",
  "15A": "#e42ec6",
  "15": "#e42ec6",
  "16": "#8a3ee6",
  "18": "#e62828",
};

export function certColor(cert: string): string | undefined {
  return CERT_COLORS[cert.toUpperCase()];
}
