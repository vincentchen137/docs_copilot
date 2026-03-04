/* eslint-disable no-console */
import path from "path";
import { loadMarkdownFromDocs } from "../src/lib/ingest/loadMarkdown";
import { chunkMarkdown } from "../src/lib/ingest/chunkMarkdown";
import { upsertChunks } from "../src/lib/vectorstore/pineconeStore";

async function main() {
  const rootDir = process.cwd();
  console.log("Scanning docs in", path.join(rootDir, "docs"));

  const files = loadMarkdownFromDocs(rootDir);

  if (files.length === 0) {
    console.log("No markdown files found under docs/");
    return;
  }

  console.log(`Found ${files.length} markdown file(s).`);

  for (const file of files) {
    console.log(`Processing ${file.relativePath}...`);

    const { chunks, metadata } = await chunkMarkdown({
      text: file.content,
      sourcePath: file.relativePath
    });

    await upsertChunks({
      chunks,
      metadata,
      extraMeta: () => ({ sourcePath: file.relativePath })
    });

    console.log(
      `Upserted ${chunks.length} chunk(s) for ${file.relativePath} into Pinecone.`
    );
  }

  console.log("Ingestion complete.");
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exitCode = 1;
});

