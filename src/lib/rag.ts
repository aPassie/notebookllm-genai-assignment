// indexing and CRAG-powered grounded chat orchestration
//
// CRAG flow: embedQuery → Qdrant top-8 → evaluator scores all chunks (1 batched call)
//   → route by avg(top-3) confidence → chunk-level refinement → web search if needed
//   → build context with provenance tags → grounded LLM answer

import { randomUUID } from "node:crypto";
import { chunkPages, type PageText } from "./chunking";
import { embedPassages, embedQuery } from "./embeddings";
import { evaluateChunks, classifyRetrieval } from "./evaluator";
import { getChatClient, chatModelChain, isTransient } from "./llm";
import { COLLECTION, ensureCollection, getQdrant } from "./qdrant";
import { refineChunks, type RefinedChunk } from "./refine";
import { searchWeb } from "./websearch";
import type { ChatTurn, CragMeta, IngestResult, Source, WebResult } from "./types";

const UPSERT_BATCH = 100;
const TOP_K = 8;

// ── indexing (unchanged) ────────────────────────────────────────────────

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

// ── CRAG-powered answer ─────────────────────────────────────────────────

export async function answerQuestion(
  docId: string,
  query: string,
  history: ChatTurn[] = [],
): Promise<{ answer: string; sources: Source[]; cragMeta: CragMeta }> {
  // 1. Retrieve — top-8 from Qdrant
  const queryVec = await embedQuery(query);

  const result = await getQdrant().search(COLLECTION, {
    vector: queryVec,
    limit: TOP_K,
    with_payload: true,
    filter: { must: [{ key: "docId", match: { value: docId } }] },
  });

  const retrieved = result
    .filter((m) => m.payload && typeof m.payload.text === "string")
    .map((m) => ({
      text: String(m.payload!.text),
      page: Number(m.payload!.page ?? 0),
      score: typeof m.score === "number" ? m.score : 0,
    }));

  if (retrieved.length === 0) {
    return {
      answer:
        "I couldn't find anything in the uploaded document that addresses that. Try rephrasing or asking about a different topic from the file.",
      sources: [],
      cragMeta: {
        action: "INCORRECT",
        totalRetrieved: 0,
        relevantCount: 0,
        filteredOut: 0,
        webSearchUsed: false,
        webResultCount: 0,
      },
    };
  }

  // 2. Evaluate — one batched LLM call on cheap model
  const evalResults = await evaluateChunks(query, retrieved);

  // 3. Classify — avg(top-3) against thresholds
  const action = classifyRetrieval(evalResults);
  console.log(`[crag] action=${action}, eval scores=${evalResults.map((r) => r.score.toFixed(2)).join(", ")}`);

  // 4. Corrective action
  let docChunks: RefinedChunk[] = [];
  let webResults: WebResult[] = [];

  switch (action) {
    case "CORRECT":
      docChunks = refineChunks(evalResults, retrieved);
      break;

    case "INCORRECT":
      webResults = await searchWeb(query);
      break;

    case "AMBIGUOUS":
      docChunks = refineChunks(evalResults, retrieved);
      webResults = await searchWeb(query);
      break;
  }

  // 5. Build context with provenance tags
  const contextParts: string[] = [];

  for (let i = 0; i < docChunks.length; i++) {
    const c = docChunks[i];
    contextParts.push(
      `[DOC #${i + 1} | page ${c.page} | relevance ${(c.evalScore * 100).toFixed(0)}%]\n${c.text}`,
    );
  }

  for (let i = 0; i < webResults.length; i++) {
    const w = webResults[i];
    contextParts.push(
      `[WEB #${i + 1} | ${w.url}]\n${w.title}\n${w.content}`,
    );
  }

  // nothing survived — refuse
  if (contextParts.length === 0) {
    return {
      answer:
        "I couldn't find relevant information in the uploaded document to answer that, and web search is not available. Try rephrasing or asking about a different topic from the file.",
      sources: [],
      cragMeta: {
        action,
        totalRetrieved: retrieved.length,
        relevantCount: 0,
        filteredOut: retrieved.length,
        webSearchUsed: false,
        webResultCount: 0,
      },
    };
  }

  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = [
    "You are a NotebookLM-style assistant that answers questions using the provided context.",
    "",
    "Rules:",
    "- Use ONLY the information in the context below. Do not use outside knowledge.",
    "- If the context does not contain the answer, say so plainly. Do not guess.",
    "- Cite the supporting excerpts inline using their tags (e.g. [DOC #1], [WEB #2]).",
    "- When context comes from both DOC and WEB sources, prefer DOC sources and note when citing WEB sources.",
    "- Keep the answer focused and grounded. Quote phrasing from the context when helpful.",
    "",
    "Context:",
    context,
  ].join("\n");

  // 6. Generate — main answer model with fallback chain
  const client = getChatClient();
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: query },
  ];

  let answer = "No response generated.";
  let lastErr: unknown;
  for (const model of chatModelChain()) {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.1,
        messages,
      });
      answer = completion.choices[0]?.message?.content?.trim() ?? answer;
      break;
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      console.warn(`[chat] model ${model} transient error, falling back`);
    }
  }
  if (answer === "No response generated." && lastErr) throw lastErr;

  // 7. Build sources with provenance
  const sources: Source[] = [
    ...docChunks.map((c) => ({
      page: c.page,
      snippet: c.text,
      score: c.evalScore,
      origin: "doc" as const,
    })),
    ...webResults.map((w) => ({
      page: 0,
      snippet: w.content.slice(0, 500),
      score: 0,
      origin: "web" as const,
      url: w.url,
    })),
  ];

  const cragMeta: CragMeta = {
    action,
    totalRetrieved: retrieved.length,
    relevantCount: docChunks.length,
    filteredOut: retrieved.length - docChunks.length,
    webSearchUsed: webResults.length > 0,
    webResultCount: webResults.length,
  };

  return { answer, sources, cragMeta };
}
