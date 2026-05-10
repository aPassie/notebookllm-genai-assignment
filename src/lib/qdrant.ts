// qdrant client that lazily ensures the collection and a docid payload index

import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIMENSIONS } from "./embeddings";

let client: QdrantClient | null = null;
let ensured = false;

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "notebooklm-rag";

export function getQdrant(): QdrantClient {
  if (!client) {
    const url = process.env.QDRANT_URL;
    if (!url) throw new Error("QDRANT_URL is not set");
    client = new QdrantClient({
      url,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }
  return client;
}

export async function ensureCollection(): Promise<void> {
  if (ensured) return;
  const qdrant = getQdrant();
  const list = await qdrant.getCollections();
  const exists = list.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: "docId",
      field_schema: "keyword",
    });
  }
  ensured = true;
}
