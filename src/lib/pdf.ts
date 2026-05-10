// pull text out of pdf or plain-text uploads, page by page

import { extractText } from "unpdf";
import type { PageText } from "./chunking";

export async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: false,
  });
  const pages = Array.isArray(text) ? text : [text];
  return pages
    .map((t, i) => ({ page: i + 1, text: t ?? "" }))
    .filter((p) => p.text.trim().length > 0);
}

export function extractTextPages(buffer: Buffer): PageText[] {
  return [{ page: 1, text: buffer.toString("utf8") }];
}
