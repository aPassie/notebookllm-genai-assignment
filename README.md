# NotebookLM RAG + CRAG

Upload a PDF or text file, ask questions, get answers grounded in the file with page citations. Same idea as Google's NotebookLM, smaller scope — now with a **Corrective RAG (CRAG)** pipeline that evaluates, refines, and self-corrects retrieval before generation.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- **Embeddings**: Jina `jina-embeddings-v3` (free tier)
- **Vector DB**: Qdrant Cloud
- **LLM (answer)**: OpenRouter, defaults to `openai/gpt-oss-120b:free` with a fallback chain
- **LLM (evaluator)**: `meta-llama/llama-3.1-8b-instruct:free` — cheap model for CRAG chunk grading
- **Web search**: Tavily (free tier, optional) — fallback for CRAG Incorrect/Ambiguous branches

## Pipeline — CRAG (Yan et al., 2024)

```
upload → extract text → chunk → embed → upsert to Qdrant (filtered by docId)
                                                  │
                       query → embed ─────────────┴──► top-8 retrieval
                                                             │
                                                    ┌────────▼────────┐
                                                    │  CRAG Evaluator │  ◄── cheap LLM (8B)
                                                    │  scores 0-1     │
                                                    └────────┬────────┘
                                                             │
                                              avg(top-3) against thresholds
                                                             │
                                          ┌──────────────────┼──────────────────┐
                                          │                  │                  │
                                     ≥ 0.7 CORRECT     AMBIGUOUS          ≤ 0.3 INCORRECT
                                          │                  │                  │
                                   refine chunks      refine chunks +      web search
                                   (drop < 0.4)       web search           (Tavily)
                                          │                  │                  │
                                          └──────────────────┴──────────────────┘
                                                             │
                                                    context with provenance
                                                    tags [DOC] / [WEB]
                                                             │
                                                    grounded LLM → answer
                                                    + sources + CRAG metadata
```

### How CRAG improves vanilla RAG

1. **Retrieval evaluation** — a lightweight LLM scores each chunk's relevance (0-1) before the answer model ever sees it
2. **Self-correction** — if retrieved chunks are irrelevant, the system falls back to web search instead of hallucinating
3. **Noise filtering** — chunks scoring below 0.4 are dropped, so only high-quality context reaches the generator
4. **Provenance transparency** — every source is tagged `DOC` or `WEB` so you know where the answer came from

### Chunking

`RecursiveCharacterTextSplitter`, chunk size 1000, overlap 200, separators `["\n\n", "\n", ". ", " ", ""]`. Splits on the largest natural boundary first (paragraph → line → sentence) and only falls back to finer ones when needed. The 20% overlap keeps definitions or references that straddle a chunk boundary intact in at least one chunk. Each chunk's payload carries the source page so the LLM can cite `[DOC #n] page X`.

### Generation

System prompt explicitly tells the model to use only the retrieved context and to refuse if the answer isn't there. Temperature 0.1. If the chosen model returns 429/503, the request retries on the next free model in the chain.

## Run it locally

You need an OpenRouter key, a Jina key, and a Qdrant Cloud cluster. All free. Tavily is optional (needed for web search fallback).

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # paste your keys
npm run dev
```

The Qdrant collection is created on the first ingest.

## Env vars

| name | required | default |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | — |
| `OPENROUTER_CHAT_MODEL` | no | `openai/gpt-oss-120b:free` |
| `OPENROUTER_SITE_URL` | no | `http://localhost:3000` |
| `JINA_API_KEY` | yes | — |
| `QDRANT_URL` | yes | — |
| `QDRANT_API_KEY` | yes | — |
| `QDRANT_COLLECTION` | no | `notebooklm-rag` |
| `TAVILY_API_KEY` | no | — (web search disabled without it) |

## Deploy

Push to GitHub, import in Vercel, paste the same env vars, deploy. API routes run on Node (pdf-parse needs it) with `maxDuration = 60` to fit Vercel's Hobby tier.

## Limits

PDF or text/markdown only, 25 MB per upload.
