"use client";

// top-level layout: floating drawer of past chats, upload screen, or active chat

import { useEffect, useState } from "react";
import { UploadZone } from "./UploadZone";
import { ChatPanel } from "./ChatPanel";
import { Sidebar } from "./Sidebar";
import { useChats } from "@/lib/useChats";
import type { IngestResult } from "@/lib/types";

const DRAWER_TRANSITION_MS = 280;

export function Workspace() {
  const {
    hydrated,
    chats,
    activeId,
    activeChat,
    createChat,
    setActive,
    deleteChat,
    appendMessage,
  } = useChats();

  const [creatingNew, setCreatingNew] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const showUpload = !activeChat || creatingNew;
  const hasChats = hydrated && chats.length > 0;

  useEffect(() => {
    if (drawerOpen) {
      setDrawerMounted(true);
      const raf = requestAnimationFrame(() => setDrawerVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    if (drawerMounted) {
      setDrawerVisible(false);
      const t = setTimeout(() => setDrawerMounted(false), DRAWER_TRANSITION_MS);
      return () => clearTimeout(t);
    }
  }, [drawerOpen, drawerMounted]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleNew = () => {
    setActive(null);
    setCreatingNew(true);
    setDrawerOpen(false);
  };

  const handleSelect = (id: string) => {
    setActive(id);
    setCreatingNew(false);
    setDrawerOpen(false);
  };

  const handleIndexed = (doc: IngestResult) => {
    createChat(doc);
    setCreatingNew(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {hasChats && !drawerOpen && showUpload && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="open chats"
          className="fixed top-4 left-4 z-20 w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--bg-elev)]/80 backdrop-blur flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]/40 transition"
        >
          <HamburgerIcon />
        </button>
      )}

      {drawerMounted && (
        <div className="fixed inset-0 z-30">
          <div
            onClick={() => setDrawerOpen(false)}
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
              drawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute top-4 bottom-4 left-4 w-72 rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)]/95 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] overflow-hidden will-change-transform transition-[transform,opacity] duration-300 ${
              drawerVisible ? "translate-x-0 opacity-100" : "-translate-x-[110%] opacity-0"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <Sidebar
              chats={chats}
              activeId={activeId}
              creatingNew={creatingNew}
              onSelect={handleSelect}
              onNew={handleNew}
              onDelete={deleteChat}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {!showUpload && activeChat && (
        <header className="sticky top-0 z-10 px-4 sm:px-6 pt-4">
          <div className="max-w-3xl mx-auto rounded-full border border-[var(--border)] bg-[var(--bg-elev)]/85 backdrop-blur px-3 py-2 flex items-center gap-3">
            {hasChats && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="open chats"
                className="w-8 h-8 rounded-full hover:bg-[var(--bg-elev-2)] flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] shrink-0"
              >
                <HamburgerIcon />
              </button>
            )}
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]" />
            <span className="text-sm text-[var(--fg)] font-medium truncate flex-1">
              {activeChat.doc.fileName}
            </span>
            <span className="hidden sm:inline text-xs text-[var(--fg-subtle)]">
              {activeChat.doc.pages} page{activeChat.doc.pages === 1 ? "" : "s"} · {activeChat.doc.chunks} chunks
            </span>
          </div>
        </header>
      )}

      {showUpload ? (
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)]/60 px-3 py-1 mb-5 text-xs text-[var(--fg-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] drift" />
                grounded answers, no hallucinations
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fg)]">
                Drop a doc.{" "}
                <span className="text-[var(--accent)]">Ask anything.</span>
              </h2>
              <p className="mt-3 text-[var(--fg-muted)] text-sm sm:text-base max-w-md mx-auto">
                Your file is chunked, embedded, and stored. Then every answer is pulled straight from it — with citations.
              </p>
            </div>
            <UploadZone onIndexed={handleIndexed} />
            <div className="mt-10 grid grid-cols-3 gap-3 text-xs text-[var(--fg-muted)]">
              <Step n={1} title="Chunk" body="Recursive splitter, 1000 / 200 overlap" />
              <Step n={2} title="Embed" body="Jina v3 retrieval into Qdrant" />
              <Step n={3} title="Answer" body="Top-5 chunks via OpenRouter" />
            </div>
          </div>
        </main>
      ) : activeChat ? (
        <ChatPanel
          key={activeChat.doc.docId}
          chat={activeChat}
          onAppend={(m) => appendMessage(activeChat.doc.docId, m)}
        />
      ) : null}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)]/40 p-4 hover:border-[var(--accent)]/30 hover:bg-[var(--bg-elev)]/70 transition">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[11px] flex items-center justify-center text-[var(--accent)] font-semibold">
          {n}
        </span>
        <span className="text-[var(--fg)] font-medium text-xs">{title}</span>
      </div>
      <p className="leading-relaxed">{body}</p>
    </div>
  );
}
