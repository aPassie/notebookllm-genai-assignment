"use client";

// chat ui for the active document, with grounded answers and source citations

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message, Source } from "@/lib/types";
import type { ChatRecord } from "@/lib/useChats";
import { readJson } from "@/lib/fetch";

type Props = {
  chat: ChatRecord;
  onAppend: (msg: Message) => void;
};

export function ChatPanel({ chat, onAppend }: Props) {
  const { doc, messages } = chat;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, busy]);

  async function send(text?: string) {
    const query = (text ?? input).trim();
    if (!query || busy) return;
    setError(null);
    if (!text) setInput("");

    const userMsg: Message = { role: "user", content: query };
    onAppend(userMsg);

    const history = [...messages, userMsg]
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docId: doc.docId, query, history }),
      });
      const data = await readJson(res);
      if (!res.ok)
        throw new Error(
          (data as { error?: string })?.error ??
            `Chat failed (${res.status} ${res.statusText})`,
        );
      const payload = data as { answer: string; sources: Source[] };
      onAppend({
        role: "assistant",
        content: payload.answer,
        sources: payload.sources,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {messages.length === 0 && (
            <EmptyHint fileName={doc.fileName} onPick={(q) => send(q)} />
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {busy && <AssistantThinking />}
          {error && (
            <p className="text-sm text-[var(--danger)] rounded-2xl bg-[var(--bg-elev)] border border-[var(--danger)]/30 px-4 py-2">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-5 pt-2">
        <div className="max-w-3xl mx-auto rounded-[28px] border border-[var(--border)] bg-[var(--bg-elev)]/80 backdrop-blur p-2 flex items-end gap-2 focus-within:border-[var(--accent)]/50 focus-within:shadow-[0_8px_30px_-12px_var(--accent-glow)] transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`ask about ${doc.fileName}…`}
            rows={1}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-[var(--fg-subtle)] max-h-40"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            aria-label="send"
            className="h-11 w-11 rounded-full bg-[var(--accent)] text-black font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 shadow-[0_8px_24px_-8px_var(--accent-glow)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-[11px] text-[var(--fg-subtle)] text-center">
          enter to send · shift+enter for newline
        </p>
      </div>
    </div>
  );
}

function EmptyHint({
  fileName,
  onPick,
}: {
  fileName: string;
  onPick: (q: string) => void;
}) {
  const suggestions = [
    "summarize this document",
    "what are the key points?",
    "explain the first section",
  ];
  return (
    <div className="text-center py-12">
      <p className="text-[var(--fg-muted)]">
        ready · ask anything about{" "}
        <span className="text-[var(--fg)] font-medium">{fileName}</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
        {suggestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)]/60 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[24px] rounded-br-md bg-[var(--accent-soft)] border border-[var(--accent)]/30 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-[var(--fg)]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 max-w-[92%]">
      <div className="rounded-[24px] rounded-bl-md bg-[var(--bg-elev)]/60 border border-[var(--border)] px-5 py-3.5">
        <div className="prose-doc text-[15px] leading-relaxed text-[var(--fg)]">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
      {message.sources && message.sources.length > 0 && (
        <SourceList sources={message.sources} />
      )}
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--fg-muted)] hover:text-[var(--accent)] flex items-center gap-1.5 px-2 py-1 rounded-full"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {sources.map((s, i) => (
            <li
              key={i}
              className="text-xs bg-[var(--bg-elev)]/60 border border-[var(--border)] rounded-2xl p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[var(--accent)] font-medium">
                  [#{i + 1}] page {s.page}
                </span>
                <span className="text-[var(--fg-subtle)]">
                  {(s.score * 100).toFixed(1)}% match
                </span>
              </div>
              <p className="text-[var(--fg-muted)] line-clamp-4 whitespace-pre-wrap">
                {s.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssistantThinking() {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 rounded-[24px] rounded-bl-md bg-[var(--bg-elev)]/60 border border-[var(--border)] w-fit">
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="ml-1 text-sm text-[var(--fg-muted)]">searching the document</span>
    </div>
  );
}
