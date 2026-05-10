// indexing and grounded chat orchestration with a free-tier model fallback chain

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { chunkPages, type PageText } from "./chunking";
import { embedPassages, embedQuery } from "./embeddings";
import { COLLECTION, ensureCollection, getQdrant } from "./qdrant";
import type { ChatTurn, IngestResult, Source } from "./types";

const UPSERT_BATCH = 100;

const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b:free";
const FALLBACK_CHAT_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

function getChatClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": "NotebookLM RAG",
    },
  });
}

function chatModelChain(): string[] {
  const primary = process.env.OPENROUTER_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  return [primary, ...FALLBACK_CHAT_MODELS.filter((m) => m !== primary)];
}

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export async function indexDocument(
  pages: PageText[],
  fileName: string,
): Promise<IngestResult> {
  if (pages.length === 0) {
    throw new Error("No extractable text found in document");
  }

  const chunks = await chunkPages(pages);
  if (chunks.length === 0) {
    throw new Error("Document produced zero chunks");
  }

  await ensureCollection();
  const docId = randomUUID();
  const qdrant = getQdrant();
  const vectors = await embedPassages(chunks.map((c) => c.text));

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const slice = chunks.slice(i, i + UPSERT_BATCH);
    const points = slice.map((chunk, j) => ({
      id: randomUUID(),
      vector: vectors[i + j],
      payload: {
        docId,
        text: chunk.text,
        page: chunk.page,
        fileName,
        chunkIndex: chunk.index,
      },
    }));
    await qdrant.upsert(COLLECTION, { wait: true, points });
  }

  return { docId, fileName, pages: pages.length, chunks: chunks.length };
}

export async function answerQuestion(
  docId: string,
  query: string,
  history: ChatTurn[] = [],
): Promise<{ answer: string; sources: Source[] }> {
  const queryVec = await embedQuery(query);

  const result = await getQdrant().search(COLLECTION, {
    vector: queryVec,
    limit: 5,
    with_payload: true,
    filter: { must: [{ key: "docId", match: { value: docId } }] },
  });

  const sources: Source[] = result
    .filter((m) => m.payload && typeof m.payload.text === "string")
    .map((m) => ({
      page: Number(m.payload!.page ?? 0),
      snippet: String(m.payload!.text),
      score: typeof m.score === "number" ? m.score : 0,
    }));

  if (sources.length === 0) {
    return {
      answer:
        "I couldn't find anything in the uploaded document that addresses that. Try rephrasing or asking about a different topic from the file.",
      sources: [],
    };
  }

  const context = sources
    .map((s, i) => `[#${i + 1} | page ${s.page}]\n${s.snippet}`)
    .join("\n\n---\n\n");

  const systemPrompt = [
    "You are a NotebookLM-style assistant that answers questions strictly using the provided document excerpts.",
    "",
    "Rules:",
    "- Use ONLY the information in the context below. Do not use outside knowledge.",
    "- If the context does not contain the answer, say so plainly. Do not guess.",
    "- Cite the supporting excerpts inline using the format [#n] (e.g. [#1], [#2]).",
    "- Keep the answer focused and grounded. Quote phrasing from the document when helpful.",
    "",
    "Context:",
    context,
  ].join("\n");

  const client = getChatClient();
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: query },
  ];

  let lastErr: unknown;
  for (const model of chatModelChain()) {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.1,
        messages,
      });
      const answer =
        completion.choices[0]?.message?.content?.trim() ?? "No response generated.";
      return { answer, sources };
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      console.warn(`[chat] model ${model} transient error, falling back`);
    }
  }
  throw lastErr;
}
