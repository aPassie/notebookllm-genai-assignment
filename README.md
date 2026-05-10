# NotebookLM RAG

Upload a PDF or text file, ask questions, get answers grounded in the file with page citations. Same idea as Google's NotebookLM, smaller scope.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- **Embeddings**: Jina `jina-embeddings-v3` (free tier)
- **Vector DB**: Qdrant Cloud
- **LLM**: OpenRouter, defaults to `openai/gpt-oss-120b:free` with a fallback chain on rate limits

## Pipeline

```
upload → extract text → chunk → embed → upsert to Qdrant (filtered by docId)
                                                  │
                       query → embed ─────────────┴──> top-5 retrieval → grounded prompt → LLM → answer + sources
```

Every uploaded file gets a fresh `docId`. All chunks live in one Qdrant collection but every query is filtered by that `docId`, so files never bleed into each other.

### Chunking

`RecursiveCharacterTextSplitter`, chunk size 1000, overlap 200, separators `["\n\n", "\n", ". ", " ", ""]`. Splits on the largest natural boundary first (paragraph → line → sentence) and only falls back to finer ones when needed. The 20% overlap keeps definitions or references that straddle a chunk boundary intact in at least one chunk. Each chunk's payload carries the source page so the LLM can cite `[#n] page X`.

### Generation

System prompt explicitly tells the model to use only the retrieved context and to refuse if the answer isn't there. Temperature 0.1. If the chosen model returns 429/503, the request retries on the next free model in the chain.

## Run it locally

You need an OpenRouter key, a Jina key, and a Qdrant Cloud cluster. All free.

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

## Deploy

Push to GitHub, import in Vercel, paste the same env vars, deploy. API routes run on Node (pdf-parse needs it) with `maxDuration = 60` to fit Vercel's Hobby tier.

## Limits

PDF or text/markdown only, 25 MB per upload.
