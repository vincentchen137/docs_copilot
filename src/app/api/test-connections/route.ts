import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

export async function GET() {
  const health: Record<string, string> = {};

  // 1. Test OpenAI
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });
    const res = await embeddings.embedQuery("Health check ping");
    health.openai = res.length === 1536 ? "✅ Success (1536 dimensions)" : "❌ Dimension mismatch";
  } catch (error: any) {
    health.openai = `❌ Error: ${error.message}`;
  }

  // 2. Test Pinecone
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const indexes = await pc.listIndexes();
    const indexNames = indexes.indexes?.map(i => i.name).join(', ') || 'No indexes found';
    health.pinecone = `✅ Success (Connected. Indexes: ${indexNames})`;
  } catch (error: any) {
    health.pinecone = `❌ Error: ${error.message}`;
  }

  // 3. Test AWS S3
  try {
    const s3 = new S3Client({ region: process.env.AWS_REGION! });
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: "diagnostic-test.txt",
      Body: "Ping successful.",
    });
    await s3.send(command);
    health.aws = "✅ Success (Uploaded diagnostic-test.txt to bucket)";
  } catch (error: any) {
    health.aws = `❌ Error: ${error.message}`;
  }

  return NextResponse.json({
    status: "Diagnostic Complete",
    results: health
  });
}
