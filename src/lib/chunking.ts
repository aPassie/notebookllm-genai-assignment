// split document text into overlapping chunks that respect paragraph boundaries

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export type PageText = { page: number; text: string };

export type Chunk = {
  text: string;
  page: number;
  index: number;
};

export async function chunkPages(pages: PageText[]): Promise<Chunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const chunks: Chunk[] = [];
  let runningIndex = 0;

  for (const { page, text } of pages) {
    const pieces = await splitter.splitText(text);
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      chunks.push({ text: trimmed, page, index: runningIndex++ });
    }
  }

  return chunks;
}
