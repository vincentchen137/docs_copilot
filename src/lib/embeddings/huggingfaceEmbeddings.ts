import { InferenceClient } from "@huggingface/inference";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL =
  process.env.HUGGINGFACE_EMBEDDING_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";

if (!HF_API_KEY) {
  throw new Error("HUGGINGFACE_API_KEY is not set");
}

const client = new InferenceClient(HF_API_KEY);

function normalizeEmbeddings(
  result: (number | number[] | number[][])[]
): number[][] {
  if (!Array.isArray(result) || result.length === 0) return [];

  const out: number[][] = [];
  for (const item of result) {
    if (typeof item === "number") {
      out.push([item]);
    } else if (Array.isArray(item) && item.length > 0) {
      if (typeof item[0] === "number") {
        out.push(item as number[]);
      } else {
        out.push(...(item as number[][]));
      }
    }
  }
  return out;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const result = await client.featureExtraction({
    model: HF_MODEL,
    inputs: texts,
    provider: "hf-inference",
  });

  return normalizeEmbeddings(result);
}
