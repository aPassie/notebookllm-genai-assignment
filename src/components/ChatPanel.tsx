"use client";

// chat ui for the active document, with CRAG diagnostics and source provenance

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { CragMeta, Message, Source } from "@/lib/types";
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
      const payload = data as { answer: string; sources: Source[]; cragMeta?: CragMeta };
      onAppend({
        role: "assistant",
        content: payload.answer,
        sources: payload.sources,
        cragMeta: payload.cragMeta,
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
          enter to send · shift+enter for newline · powered by CRAG pipeline
        </p>
      </div>
    </div>
  );
}

// ── empty state ─────────────────────────────────────────────────────────

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

// ── message bubble ──────────────────────────────────────────────────────

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
      {message.cragMeta && <CragBadge meta={message.cragMeta} />}
      {message.sources && message.sources.length > 0 && (
        <SourceList sources={message.sources} />
      )}
    </div>
  );
}

// ── CRAG diagnostics badge ──────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CORRECT: {
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.35)",
    text: "#4ade80",
    label: "CORRECT",
  },
  INCORRECT: {
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.35)",
    text: "#f87171",
    label: "INCORRECT",
  },
  AMBIGUOUS: {
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    text: "#fbbf24",
    label: "AMBIGUOUS",
  },
};

function CragBadge({ meta }: { meta: CragMeta }) {
  const [open, setOpen] = useState(false);
  const style = ACTION_STYLES[meta.action] ?? ACTION_STYLES.AMBIGUOUS;

  return (
    <div className="ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors"
        style={{
          background: style.bg,
          borderColor: style.border,
          color: style.text,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.text }} />
        <span className="font-semibold tracking-wide">{style.label}</span>
        <span style={{ color: "var(--fg-muted)" }}>· CRAG pipeline</span>
        <span
          className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          style={{ color: style.text }}
        >
          ▸
        </span>
      </button>

      {open && (
        <div
          className="mt-2 rounded-2xl border p-3 text-xs grid grid-cols-2 gap-x-6 gap-y-1.5"
          style={{ background: style.bg, borderColor: style.border }}
        >
          <Stat label="Retrieved" value={meta.totalRetrieved} />
          <Stat label="Relevant" value={meta.relevantCount} accent />
          <Stat label="Filtered out" value={meta.filteredOut} />
          <Stat label="Web search" value={meta.webSearchUsed ? `${meta.webResultCount} results` : "skipped"} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className={accent ? "text-[var(--accent)] font-medium" : "text-[var(--fg)]"}>{value}</span>
    </div>
  );
}

// ── source list with provenance ─────────────────────────────────────────

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const docCount = sources.filter((s) => s.origin === "doc").length;
  const webCount = sources.filter((s) => s.origin === "web").length;

  const summary = [
    docCount > 0 ? `${docCount} doc` : "",
    webCount > 0 ? `${webCount} web` : "",
  ].filter(Boolean).join(" + ");

  return (
    <div className="ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--fg-muted)] hover:text-[var(--accent)] flex items-center gap-1.5 px-2 py-1 rounded-full"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {summary} source{sources.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {sources.map((s, i) => (
            <li
              key={i}
              className="text-xs bg-[var(--bg-elev)]/60 border border-[var(--border)] rounded-2xl p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <OriginBadge origin={s.origin} />
                  <span className="text-[var(--accent)] font-medium">
                    {s.origin === "doc" ? `[#${i + 1}] page ${s.page}` : `[#${i + 1}]`}
                  </span>
                </div>
                {s.origin === "doc" && (
                  <span className="text-[var(--fg-subtle)]">
                    {(s.score * 100).toFixed(0)}% relevant
                  </span>
                )}
              </div>
              {s.origin === "web" && s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline text-[11px] block mb-1.5 truncate"
                >
                  {s.url}
                </a>
              )}
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

function OriginBadge({ origin }: { origin: "doc" | "web" }) {
  const isDoc = origin === "doc";
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
      style={{
        background: isDoc ? "rgba(34,197,94,0.15)" : "rgba(96,165,250,0.15)",
        color: isDoc ? "#4ade80" : "#60a5fa",
        border: `1px solid ${isDoc ? "rgba(34,197,94,0.30)" : "rgba(96,165,250,0.30)"}`,
      }}
    >
      {origin}
    </span>
  );
}

// ── thinking indicator ──────────────────────────────────────────────────

function AssistantThinking() {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 rounded-[24px] rounded-bl-md bg-[var(--bg-elev)]/60 border border-[var(--border)] w-fit">
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="ml-1 text-sm text-[var(--fg-muted)]">evaluating & searching</span>
    </div>
  );
}
