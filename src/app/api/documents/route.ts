import { NextResponse } from "next/server";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, docsBucket } from "@/lib/storage/s3Client";

export const runtime = "nodejs";

const UPLOADS_PREFIX = "uploads/";
const PRESIGN_EXPIRES_IN = 3600; // 1 hour

export async function GET() {
  try {
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: docsBucket,
        Prefix: UPLOADS_PREFIX,
      })
    );

    const contents = listResult.Contents ?? [];
    const documents: { key: string; name: string; viewUrl: string }[] = [];

    for (const obj of contents) {
      if (!obj.Key) continue;
      const key = obj.Key;
      const name = (key.replace(UPLOADS_PREFIX, "").replace(/^\d+-/, "") || key.split("/").pop()) ?? key;

      const viewUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: docsBucket, Key: key }),
        { expiresIn: PRESIGN_EXPIRES_IN }
      );

      documents.push({ key, name, viewUrl });
    }

    documents.sort((a, b) => b.key.localeCompare(a.key));

    return NextResponse.json({ documents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to list documents", details: message }, { status: 500 });
  }
}
