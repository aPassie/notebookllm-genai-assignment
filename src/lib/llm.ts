// shared openrouter client + model chains used by both the answer generator and the CRAG evaluator

import OpenAI from "openai";

const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b:free";
const FALLBACK_CHAT_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

const EVALUATOR_MODEL = "nvidia/nemotron-nano-9b-v2:free";
const EVALUATOR_FALLBACKS = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
];

let _client: OpenAI | null = null;

export function getChatClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  _client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": "NotebookLM RAG",
    },
  });
  return _client;
}

export function chatModelChain(): string[] {
  const primary = process.env.OPENROUTER_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  return [primary, ...FALLBACK_CHAT_MODELS.filter((m) => m !== primary)];
}

export function evalModelChain(): string[] {
  return [EVALUATOR_MODEL, ...EVALUATOR_FALLBACKS];
}

export function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}
