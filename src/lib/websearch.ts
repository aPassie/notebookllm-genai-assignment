// tavily web search fallback for CRAG Incorrect / Ambiguous branches
// gracefully returns [] if TAVILY_API_KEY is not set

import { tavily } from "@tavily/core";
import type { WebResult } from "./types";

const MAX_RESULTS = 5;

export async function searchWeb(query: string): Promise<WebResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[websearch] TAVILY_API_KEY not set — skipping web search");
    return [];
  }

  try {
    const client = tavily({ apiKey });
    const res = await client.search(query, {
      maxResults: MAX_RESULTS,
      searchDepth: "basic",
    });

    return (res.results ?? [])
      .filter((r) => r.content && r.content.trim().length > 0)
      .map((r) => ({
        title: r.title ?? "",
        content: r.content,
        url: r.url,
      }));
  } catch (err) {
    console.error("[websearch] Tavily search failed:", err);
    return [];
  }
}
