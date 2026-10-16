/** Pure text parsers for the promo page; kept out of page.tsx so parse.test.ts can import them under tsx. */

/** Hero split: "MEYER Hello Kitty Collection — เครื่องครัว…" → headline + statement. */
export function splitTitle(title: string): [string, string | undefined] {
  const [head, ...rest] = title.split(/\s+[—–-]\s+/);
  return [head, rest.length > 0 ? rest.join(" — ") : undefined];
}

export type Block = { kind: "p"; text: string } | { kind: "list"; heading?: string; items: string[] };

/**
 * Body paragraphs on blank lines. A paragraph whose lines all start with "- "
 * is a list; a single plain first line before those is the list's heading.
 */
export function blocks(body: string): Block[] {
  return body
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      const heading = lines[0]?.startsWith("- ") ? undefined : lines[0];
      const items = heading ? lines.slice(1) : lines;
      if (items.length > 0 && items.every((l) => l.startsWith("- ")))
        return { kind: "list", heading, items: items.map((l) => l.slice(2).trim()) };
      return { kind: "p", text: p };
    });
}
