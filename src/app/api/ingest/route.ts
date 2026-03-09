import { NextRequest, NextResponse } from "next/server";
import { uploadMarkdownToS3 } from "@/lib/storage/s3Client";
import { chunkMarkdown } from "@/lib/ingest/chunkMarkdown";
import { upsertChunks } from "@/lib/vectorstore/pineconeStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const ingestPassword = process.env.INGEST_PASSWORD;
    if (ingestPassword) {
      const provided = formData.get("password");
      const value = typeof provided === "string" ? provided : "";
      if (value !== ingestPassword) {
        return NextResponse.json(
          { error: "Invalid or missing ingest password" },
          { status: 401 }
        );
      }
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { bucket, key } = await uploadMarkdownToS3({
      fileName: file.name,
      body: buffer
    });

    const text = buffer.toString("utf8");

    const { chunks, metadata } = await chunkMarkdown({
      text,
      sourcePath: `s3://${bucket}/${key}`
    });

    await upsertChunks({
      chunks,
      metadata,
      extraMeta: () => ({
        s3Bucket: bucket,
        s3Key: key
      })
    });

    return NextResponse.json({
      ok: true,
      bucket,
      key,
      chunksUpserted: chunks.length
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    return NextResponse.json(
      { error: "Ingest failed", details: message },
      { status: 500 }
    );
  }
}

