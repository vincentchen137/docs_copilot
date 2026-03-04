"use client";

import { useState, useRef } from "react";
import { Citation } from "@/components/Citation";

type CitationItem = {
  id: string;
  number?: number;
  sourcePath: string;
  startLine: number;
  endLine: number;
  content?: string;
  viewUrl?: string | null;
  heading?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  /** Raw stream (reasoning + final answer) before done; shown in collapsible. */
  streamedContent?: string;
  citations?: CitationItem[];
};

function CollapsibleStream({
  streamedContent,
  isExpanded,
  onToggle,
  isComplete,
}: {
  streamedContent: string;
  isExpanded: boolean;
  onToggle: () => void;
  isComplete: boolean;
}) {
  return (
    <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100/80 focus:outline-none focus:ring-2 focus:ring-primary-600/20 rounded-t-lg"
        aria-expanded={isExpanded}
      >
        <span>{isComplete ? "Reasoning" : "Thinking…"}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words text-sm text-gray-600 font-sans">
            {streamedContent}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedStreamIndex, setExpandedStreamIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function sendQuestion() {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setQuestion("");
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "", streamedContent: "", citations: [] },
    ]);
    setExpandedStreamIndex(assistantIndex);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: "No response from the assistant.",
          };
          return next;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed) as {
              type: string;
              content?: string;
              answer?: string;
              citations?: CitationItem[];
            };
            if (data.type === "chunk" && data.content) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  streamedContent: (last.streamedContent ?? "") + data.content,
                };
                return next;
              });
            } else if (data.type === "done") {
              setExpandedStreamIndex(null);
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: data.answer ?? "",
                  citations: data.citations ?? [],
                };
                return next;
              });
            }
          } catch {
            // skip invalid JSON lines
          }
        }
      }
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as {
            type: string;
            answer?: string;
            citations?: CitationItem[];
          };
          if (data.type === "done") {
            setExpandedStreamIndex(null);
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: data.answer ?? "",
                citations: data.citations ?? [],
              };
              return next;
            });
          }
        } catch {
          // ignore
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: "There was an error talking to the assistant.",
        };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function clearInput() {
    setQuestion("");
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Centered hero + input */}
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-8 pb-12">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-gray-900">
          Docs Copilot
        </h1>
        <p className="mt-2 text-center text-base text-gray-500">
          {/* Use natural language to search through your internal docs. */}
        </p>

        <div className="mt-8 flex w-full max-w-xl items-center gap-2">
          <div className="relative flex flex-1 items-center rounded-xl bg-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendQuestion();
              }}
              placeholder="Ask about our internal docs: APIs, setup, known errors, etc."
              className={`w-full rounded-xl border-0 bg-transparent py-3 pl-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-600/30 ${question.length > 0 ? "pr-10" : "pr-4"}`}
              aria-label="Search"
            />
            {question.length > 0 && (
              <button
                type="button"
                onClick={clearInput}
                className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
                aria-label="Clear"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={sendQuestion}
            disabled={sending}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
            aria-label="Submit"
          >
            {sending ? (
              <span className="text-sm">…</span>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            )}
          </button>
        </div>
      </section>

      {/* Answers below the chatbox */}
      <section className="mx-auto max-w-2xl px-4 pb-16">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            Your questions and answers will appear here.
          </p>
        ) : (
          <ul className="space-y-6">
            {messages.map((m, idx) => (
              <li key={idx} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                {m.role === "assistant" &&
                  (m.streamedContent ?? "") !== "" && (
                    <CollapsibleStream
                      streamedContent={m.streamedContent ?? ""}
                      isExpanded={expandedStreamIndex === idx}
                      onToggle={() =>
                        setExpandedStreamIndex((prev) => (prev === idx ? null : idx))
                      }
                      isComplete={m.content !== ""}
                    />
                  )}
                {m.role === "assistant" && m.content && (
                  <div className="whitespace-pre-wrap break-words text-gray-900">{m.content}</div>
                )}
                {m.role === "user" && (
                  <div className="whitespace-pre-wrap break-words text-gray-900">{m.content}</div>
                )}
                {m.role === "assistant" && !m.content && (m.streamedContent ?? "") !== "" && (
                  <p className="mt-1 text-sm text-gray-400">Thinking…</p>
                )}
                {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-200 pt-3">
                    <span className="text-xs text-gray-500">Sources:</span>
                    {m.citations.map((c, i) => (
                      <Citation key={c.id ?? i} citation={c} index={i} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
