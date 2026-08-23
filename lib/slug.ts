/** FNV-1a — stable across builds, used only when the id has no usable ASCII tail. */
function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(6, "0").slice(0, 8);
}

const MAX_SLUG_BASE_LEN = 60;

/**
 * URL-safe, stable slug.
 * Thai keywords in the URL are indexed and ranked normally by Google (the
 * browser/Next.js router percent-encodes them automatically) and are worth
 * far more for Thai ข่าว SEO than forcing ASCII — so Thai codepoints are kept,
 * never stripped. Only genuine punctuation, symbols and whitespace collapse
 * to hyphens; Unicode combining marks (Thai tone/vowel signs are category
 * "Mark", not "Letter") stay attached to their base letter instead of being
 * cut out, so words aren't shredded mid-syllable. Latin/digit titles behave
 * exactly as before — plain ASCII punctuation was already the only thing
 * stripped there too. Always suffixed with a stable id tail so slugs stay
 * unique and stable even for a pure-Thai title.
 */
export function toSlug(title: string, id: string): string {
  const base = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_BASE_LEN)
    .replace(/-+$/g, "");
  const ascii = id.replace(/[^a-zA-Z0-9]/g, "");
  const tail = ascii.length >= 4 ? ascii.slice(-8).toLowerCase() : shortHash(id + title);
  return `${base || "hot"}-${tail}`;
}
