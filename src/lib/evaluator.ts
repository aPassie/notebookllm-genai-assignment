// CRAG retrieval evaluator — one batched LLM call scores all retrieved chunks 0-1
// uses a cheap free-tier model separate from the answer model

import { getChatClient, evalModelChain, isTransient } from "./llm";
import type { CragAction, EvalResult } from "./types";

// ── thresholds (tunable) ────────────────────────────────────────────────

/** avg of top-3 eval scores ≥ this → CORRECT */
const CORRECT_THRESHOLD = 0.7;
/** avg of top-3 eval scores ≤ this → INCORRECT */
const INCORRECT_THRESHOLD = 0.3;

// ── evaluator ───────────────────────────────────────────────────────────

type ScoredChunk = { text: string; page: number; score: number };

const EVAL_SYSTEM_PROMPT = `You are a relevance evaluator. You will receive a user QUERY and a numbered list of CHUNKS retrieved from a document.

For each chunk, output a JSON array of objects with these fields:
- "idx": the chunk number (0-indexed)
- "score": a float between 0.0 and 1.0 indicating how relevant the chunk is to answering the query (1.0 = directly answers it, 0.0 = completely irrelevant)
- "reason": a brief one-sentence explanation of your score

Output ONLY a valid JSON array, no markdown fences, no extra text. Example:
[{"idx":0,"score":0.9,"reason":"Directly defines the term asked about"},{"idx":1,"score":0.1,"reason":"Discusses an unrelated topic"}]`;

export async function evaluateChunks(
  query: string,
  chunks: ScoredChunk[],
): Promise<EvalResult[]> {
  const numbered = chunks
    .map((c, i) => `[CHUNK ${i}] (page ${c.page})\n${c.text}`)
    .join("\n\n---\n\n");

  const userMsg = `QUERY: ${query}\n\nCHUNKS:\n${numbered}`;

  const client = getChatClient();
  const models = evalModelChain();

  let lastErr: unknown;
  for (const model of models) {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: EVAL_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
      return parseEvalResponse(raw, chunks.length);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      console.warn(`[evaluator] model ${model} transient error, falling back`);
    }
  }
  throw lastErr;
}

// ── response parsing with fallback ──────────────────────────────────────

function parseEvalResponse(raw: string, chunkCount: number): EvalResult[] {
  // strip markdown fences if the model wraps them anyway
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // some models return an object wrapper; try to find the array inside
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    cleaned = cleaned.slice(arrStart, arrEnd + 1);
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn("[evaluator] JSON parse failed, falling back to neutral scores");
    return Array.from({ length: chunkCount }, (_, i) => ({
      idx: i,
      score: 0.5,
      reason: "eval parse error — neutral score assigned",
    }));
  }

  if (!Array.isArray(parsed)) {
    return Array.from({ length: chunkCount }, (_, i) => ({
      idx: i,
      score: 0.5,
      reason: "eval returned non-array — neutral score assigned",
    }));
  }

  // normalise and fill any missing indices
  const map = new Map<number, EvalResult>();
  for (const item of parsed) {
    const obj = item as Record<string, unknown>;
    const idx = typeof obj.idx === "number" ? obj.idx : -1;
    const score = Math.max(0, Math.min(1, Number(obj.score) || 0.5));
    const reason = typeof obj.reason === "string" ? obj.reason : "";
    if (idx >= 0 && idx < chunkCount) {
      map.set(idx, { idx, score, reason });
    }
  }

  return Array.from({ length: chunkCount }, (_, i) =>
    map.get(i) ?? { idx: i, score: 0.5, reason: "not scored by evaluator" },
  );
}

// ── classification ──────────────────────────────────────────────────────

export function classifyRetrieval(results: EvalResult[]): CragAction {
  if (results.length === 0) return "INCORRECT";

  // take top-3 scores
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, Math.min(3, sorted.length));
  const avg = top3.reduce((sum, r) => sum + r.score, 0) / top3.length;

  if (avg >= CORRECT_THRESHOLD) return "CORRECT";
  if (avg <= INCORRECT_THRESHOLD) return "INCORRECT";
  return "AMBIGUOUS";
}
