import { MarkdownTextSplitter } from "@langchain/textsplitters";
import crypto from "crypto";

export type ChunkMetadata = {
  docId: string;
  sourcePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  contentSha: string;
  /** Section path from markdown headings, e.g. "Known Errors > 409 Conflict" */
  heading?: string;
};

export type ChunkResult = {
  chunks: string[];
  metadata: ChunkMetadata[];
};

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Build heading path at a given character offset by scanning backward
 * and collecting the most recent heading at each level (e.g. ## then ###).
 */
function getHeadingPathAtOffset(text: string, offset: number): string {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  const stack: { level: number; title: string }[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const m = line.match(HEADING_REGEX);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].trim();
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack.push({ level, title });
  }

  stack.reverse();
  return stack.map((h) => h.title).join(" > ") || "";
}

export async function chunkMarkdown(opts: {
  text: string;
  sourcePath: string;
}): Promise<ChunkResult> {
  const { text, sourcePath } = opts;

  const splitter = new MarkdownTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200
  });

  const chunks = await splitter.splitText(text);

  const lines = text.split(/\r?\n/);
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  const docId = sha256(sourcePath);
  const metadata: ChunkMetadata[] = [];

  let searchFrom = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startOffset = text.indexOf(chunk, searchFrom);
    const endOffset = startOffset + chunk.length;
    searchFrom = endOffset;

    const heading = getHeadingPathAtOffset(text, startOffset);

    let startLineIdx = 0;
    let endLineIdx = lines.length - 1;

    for (let li = 0; li < lineOffsets.length; li++) {
      const lineStart = lineOffsets[li];
      const lineEnd =
        li + 1 < lineOffsets.length ? lineOffsets[li + 1] : text.length;

      if (startOffset >= lineStart && startOffset < lineEnd) {
        startLineIdx = li;
      }

      if (endOffset > lineStart && endOffset <= lineEnd) {
        endLineIdx = li;
        break;
      }
    }

    metadata.push({
      docId,
      sourcePath,
      chunkIndex: i,
      startLine: startLineIdx + 1,
      endLine: endLineIdx + 1,
      contentSha: sha256(chunk),
      heading: heading || undefined
    });
  }

  return { chunks, metadata };
}
