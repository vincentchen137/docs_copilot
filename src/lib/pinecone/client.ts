import { Pinecone } from "@pinecone-database/pinecone";

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX_NAME;
const cloud = process.env.PINECONE_CLOUD ?? "aws";
const region = process.env.PINECONE_REGION ?? "us-east-1";

if (!apiKey) {
  throw new Error("PINECONE_API_KEY is not set");
}

if (!indexName) {
  throw new Error("PINECONE_INDEX_NAME is not set");
}

const INDEX_NAME = indexName as string;

export const pinecone = new Pinecone({
  apiKey
});

const EMBEDDING_DIMENSION = 384; // sentence-transformers/all-MiniLM-L6-v2

export async function getOrCreateIndex() {
  const existing = await pinecone.listIndexes();
  const alreadyExists = existing.indexes?.some((idx) => idx.name === INDEX_NAME);

  if (!alreadyExists) {
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: cloud as "aws" | "gcp",
          region
        }
      }
    });

    let ready = false;
    while (!ready) {
      const described = await pinecone.describeIndex(INDEX_NAME);
      if (described.status?.ready) {
        ready = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  return pinecone.Index(INDEX_NAME);
}

