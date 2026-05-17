// CRAG chunk-level refinement — drop any chunk that scored below the relevance floor

import type { EvalResult } from "./types";

const RELEVANCE_FLOOR = 0.4;

type ScoredChunk = { text: string; page: number; score: number };

export type RefinedChunk = ScoredChunk & {
  evalScore: number;
  evalReason: string;
};

export function refineChunks(
  evalResults: EvalResult[],
  chunks: ScoredChunk[],
): RefinedChunk[] {
  const refined: RefinedChunk[] = [];

  for (const result of evalResults) {
    if (result.score >= RELEVANCE_FLOOR && result.idx < chunks.length) {
      const chunk = chunks[result.idx];
      refined.push({
        ...chunk,
        evalScore: result.score,
        evalReason: result.reason,
      });
    }
  }

  return refined.sort((a, b) => b.evalScore - a.evalScore);
}
