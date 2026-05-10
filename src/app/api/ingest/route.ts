// post handler that takes an uploaded pdf or text file and indexes it

import { NextResponse } from "next/server";
import { extractPdfPages, extractTextPages } from "@/lib/pdf";
import { indexDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_BYTES / 1024 / 1024}MB limit` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name || "document";
    const lower = name.toLowerCase();

    let pages;
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      pages = await extractPdfPages(buffer);
    } else if (
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      file.type.startsWith("text/")
    ) {
      pages = extractTextPages(buffer);
    } else {
      return NextResponse.json(
        { error: "Only PDF and plain text files are supported" },
        { status: 415 },
      );
    }

    const result = await indexDocument(pages, name);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ingest] error", err);
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
