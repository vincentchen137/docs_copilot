import type { PineconeRecord } from "@pinecone-database/pinecone";
import { getOrCreateIndex } from "../pinecone/client";
import { embedTexts } from "../embeddings/huggingfaceEmbeddings";
import type { ChunkMetadata } from "../ingest/chunkMarkdown";

export async function upsertChunks(args: {
  chunks: string[];
  metadata: ChunkMetadata[];
  extraMeta?: (index: number) => Record<string, unknown>;
}) {
  const index = await getOrCreateIndex();
  const embeddings = await embedTexts(args.chunks);

  const vectors = embeddings.map((values, i) => {
    const baseMeta = args.metadata[i];
    return {
      id: `${baseMeta.docId}:${baseMeta.chunkIndex}`,
      values,
      metadata: {
        ...baseMeta,
        content: args.chunks[i],
        ...(args.extraMeta ? args.extraMeta(i) : {})
      }
    };
  });

  await index.upsert(vectors as PineconeRecord[]);
}

export async function queryChunks(args: { query: string; topK?: number }) {
  const index = await getOrCreateIndex();
  const [queryEmbedding] = await embedTexts([args.query]);

  const result = await index.query({
    topK: args.topK ?? 8,
    vector: queryEmbedding,
    includeMetadata: true
  });

  return result.matches ?? [];
}

