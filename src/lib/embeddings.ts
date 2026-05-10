// embed text via jina with task-specific tags so passages and queries get optimized vectors

const EMBEDDING_MODEL = "jina-embeddings-v3";
export const EMBEDDING_DIMENSIONS = 1024;
const JINA_URL = "https://api.jina.ai/v1/embeddings";
const PASSAGE_BATCH = 64;

type JinaTask = "retrieval.passage" | "retrieval.query";

type JinaResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

async function jinaEmbed(input: string[], task: JinaTask): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not set");

  const res = await fetch(JINA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      task,
      dimensions: EMBEDDING_DIMENSIONS,
      input,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Jina embeddings failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as JinaResponse;
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += PASSAGE_BATCH) {
    const batch = texts.slice(i, i + PASSAGE_BATCH);
    const vectors = await jinaEmbed(batch, "retrieval.passage");
    out.push(...vectors);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await jinaEmbed([text], "retrieval.query");
  return vector;
}
