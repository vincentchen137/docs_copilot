import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucket = process.env.DOCS_S3_BUCKET;

if (!region) {
  throw new Error("AWS_REGION is not set");
}

if (!bucket) {
  throw new Error("DOCS_S3_BUCKET is not set");
}

export const docsBucket = bucket;

export const s3 = new S3Client({ region });

export async function uploadMarkdownToS3(args: {
  fileName: string;
  body: Buffer | Uint8Array | string;
}) {
  const key = `uploads/${Date.now()}-${args.fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.body,
      ContentType: "text/markdown"
    })
  );

  return { bucket, key };
}

