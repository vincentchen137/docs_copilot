import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/lib/storage/s3Client";
import { queryChunks } from "@/lib/vectorstore/pineconeStore";

const PRESIGN_EXPIRES_IN = 3600;

const openRouterKey = process.env.OPENROUTER_API_KEY;
const chatModel = process.env.OPENROUTER_CHAT_MODEL ?? "meta-llama/llama-3.2-3b-instruct:free";

if (!openRouterKey) {
  throw new Error("OPENROUTER_API_KEY is not set");
}

const client = new OpenAI({
  apiKey: openRouterKey,
  baseURL: "https://openrouter.ai/api/v1",
});

const ChatSchema = z.object({
  question: z.string().min(1)
});

export const runtime = "nodejs";

type Match = Awaited<ReturnType<typeof queryChunks>>[number];

async function buildDisplayAnswerAndCitations(
  rawAnswer: string,
  matches: Match[]
): Promise<{ displayAnswer: string; citations: Record<string, unknown>[] }> {
  const finalAnswerMarker = /Final answer:\s*/i;
  const displayAnswer = finalAnswerMarker.test(rawAnswer)
    ? rawAnswer.split(finalAnswerMarker)[1]?.trim() ?? rawAnswer
    : rawAnswer;

  const textForCitations = displayAnswer;
  const usedIndices: number[] = [];
  const regex = /\[#(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(textForCitations)) !== null) {
    const idx = Number(match[1]);
    if (!Number.isNaN(idx) && !usedIndices.includes(idx)) {
      usedIndices.push(idx);
    }
  }

  const citationsWithUrls = await Promise.all(
    usedIndices.map(async (n) => {
      const m = matches[n - 1];
      if (!m) return null;
      const md = m.metadata as Record<string, unknown>;
      const bucket = md.s3Bucket as string | undefined;
      const key = md.s3Key as string | undefined;
      let viewUrl: string | null = null;
      if (bucket && key) {
        try {
          viewUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: PRESIGN_EXPIRES_IN }
          );
        } catch {
          viewUrl = null;
        }
      }
      return {
        id: m.id,
        number: n,
        sourcePath: md.sourcePath as string,
        startLine: md.startLine as number,
        endLine: md.endLine as number,
        content: (md.content as string) ?? "",
        viewUrl,
        heading: (md.heading as string) || undefined,
      };
    })
  );
  let citations = citationsWithUrls.filter(Boolean) as Record<string, unknown>[];

  if (!citations.length && !/I don't know/i.test(rawAnswer)) {
    const modelClaimedNoKnowledge = /I don't know|I do not have|not in the context|not provided/i.test(rawAnswer);
    if (modelClaimedNoKnowledge) {
      return { displayAnswer: "I don't know", citations: [] };
    }
    const topMatch = matches[0];
    if (topMatch) {
      const md = topMatch.metadata as Record<string, unknown>;
      const bucket = md.s3Bucket as string | undefined;
      const key = md.s3Key as string | undefined;
      let viewUrl: string | null = null;
      if (bucket && key) {
        try {
          viewUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: PRESIGN_EXPIRES_IN }
          );
        } catch {
          viewUrl = null;
        }
      }
      citations = [
        {
          id: topMatch.id,
          number: 1,
          sourcePath: md.sourcePath as string,
          startLine: md.startLine as number,
          endLine: md.endLine as number,
          content: (md.content as string) ?? "",
          viewUrl,
          heading: (md.heading as string) || undefined,
        },
      ];
    }
  }

  return { displayAnswer, citations };
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = ChatSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { question } = parsed.data;

  const matches = await queryChunks({ query: question, topK: 5 });

  if (!matches.length) {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "done", answer: "I don't know", citations: [] }) + "\n")
        );
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" }
    });
  }

  const contextBlocks = matches.map((m, i) => {
    const md = m.metadata as Record<string, unknown>;
    const sourcePath = (md.sourcePath as string) ?? "";
    const startLine = (md.startLine as number) ?? 0;
    const endLine = (md.endLine as number) ?? 0;
    const heading = (md.heading as string) ?? "";
    const content = (md.content as string) ?? "";
    const lineRange = `${sourcePath}:${startLine}-${endLine}`;
    const sectionLabel = heading
      ? `[#${i + 1}] ${sourcePath} — ${heading}`
      : `[#${i + 1}] ${lineRange}`;
    return `${sectionLabel}\n${content}`;
  });

  const systemPrompt = `
You are an internal developer assistant. Your only source of truth is the provided context from our ingested markdown docs (runbooks, API specs, ADRs, known errors, etc.).

Answer in two steps (chain of thought):

1. **Reasoning (brief):** Note which context blocks ([#1], [#2], ...) are relevant to the question and why. You may infer from context (e.g. if setup only mentions Node.js and pnpm and does not mention Python, you can conclude Python is not required). Only say "I don't know" when the context truly does not address the question at all—not when the answer can be inferred from what is or isn't listed.

2. **Final answer:** After your reasoning, write "Final answer:" on a new line, then give your concise answer. Use only the context; be technical. Cite the blocks you used with [#N] (e.g. "According to [#1], ..."). Only cite blocks that actually contain the information—do not cite a block about a different topic.

Rules:
- Answer ONLY using the provided context. No external or general knowledge.
- Infer when reasonable: e.g. "is X required?" can be answered "No, X is not mentioned in the setup" when the setup only lists other tools.
- Say "I don't know" only when the context does not address the question and you cannot infer (e.g. question is about something completely outside the docs).
- End your response with "Final answer:" followed by your answer and citations.
`.trim();

  const userPrompt = `
Question:
${question}

Context:
${contextBlocks.join("\n\n")}
`.trim();

  const maxRetries = 3;
  const retryDelayMs = 2000;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let rawAnswer = "";
      try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const completion = await client.chat.completions.create({
              model: chatModel,
              temperature: 0,
              max_tokens: 1024,
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ]
            });
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content ?? "";
              if (delta) {
                rawAnswer += delta;
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: "chunk", content: delta }) + "\n")
                );
              }
            }
            const { displayAnswer, citations } = await buildDisplayAnswerAndCitations(
              rawAnswer.trim(),
              matches
            );
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "done", answer: displayAnswer, citations }) + "\n")
            );
            break;
          } catch (err: unknown) {
            const status = (err as { status?: number })?.status;
            if (status === 429 && attempt < maxRetries - 1) {
              await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
              continue;
            }
            const message =
              status === 429
                ? "The assistant is temporarily rate-limited. Please try again in a moment."
                : "The assistant is temporarily unavailable. Please try again.";
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "done", answer: message, citations: [] }) + "\n")
            );
            break;
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              answer: "The assistant is temporarily unavailable. Please try again.",
              citations: []
            }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" }
  });
}

