export type ContentBlock = { kind: "heading" | "paragraph" | "list" | "callout"; text?: string; items?: string[] };

export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).flatMap(line => {
    if (line.length < 380) return [line];
    const sentences = line.match(/[^.!?。]+[.!?。]+(?:\s|$)|.+$/g) || [line];
    const result: string[] = []; let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > 320) { result.push(current.trim()); current = ""; }
      current += sentence;
    }
    if (current.trim()) result.push(current.trim());
    return result;
  });
}

/** Read legacy prose without changing stored records; decimal figures are not headings. */
export function legacyBlocks(body: string): ContentBlock[] {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const heading = /(?:^|\s)((?:\d{1,2}\.){1,2}\d{1,2})\s+([^:\n]{2,80}):\s*/g;
  const matches = [...text.matchAll(heading)];
  const blocks: ContentBlock[] = [];
  const add = (chunk: string) => {
    for (const paragraph of paragraphs(chunk)) {
      if (/^(?:[-•]|\d+[.)])\s/.test(paragraph)) {
        const item = paragraph.replace(/^(?:[-•]|\d+[.)])\s*/, "");
        if (blocks.at(-1)?.kind === "list") blocks.at(-1)!.items!.push(item);
        else blocks.push({ kind: "list", items: [item] });
      } else blocks.push({ kind: "paragraph", text: paragraph });
    }
  };
  if (!matches.length) { add(text); return blocks; }
  add(text.slice(0, matches[0].index));
  matches.forEach((match, index) => {
    blocks.push({ kind: "heading", text: `${match[1]} ${match[2].trim()}` });
    add(text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length));
  });
  return blocks;
}

export function documentBlocks(body: string, structured?: ContentBlock[]): ContentBlock[] {
  if (!Array.isArray(structured) || !structured.length) return legacyBlocks(body);
  const valid = structured.filter(block => block && ["heading", "paragraph", "list", "callout"].includes(block.kind) && (block.kind === "list" ? Array.isArray(block.items) && block.items.every(x => typeof x === "string") : typeof block.text === "string"));
  return valid.length === structured.length ? valid : legacyBlocks(body);
}

export function blocksToText(blocks: ContentBlock[]): string {
  return blocks.map(block => block.kind === "list" ? (block.items || []).map(item => `• ${item}`).join("\n") : block.kind === "heading" ? `${block.text}:` : block.text || "").join("\n\n");
}
