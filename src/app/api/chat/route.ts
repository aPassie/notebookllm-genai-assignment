// post handler that turns a query + docId into a grounded answer

import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/rag";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  docId?: string;
  query?: string;
  history?: ChatTurn[];
};

export async function POST(req: Request) {
  try {
    const { docId, query, history = [] } = (await req.json()) as Body;

    if (!docId || typeof docId !== "string") {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const trimmed = history
      .filter(
        (t): t is ChatTurn =>
          (t?.role === "user" || t?.role === "assistant") &&
          typeof t?.content === "string",
      )
      .slice(-6);

    const result = await answerQuestion(docId, query.trim(), trimmed);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[chat] error", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
