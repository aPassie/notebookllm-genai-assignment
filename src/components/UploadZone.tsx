"use client";

// drag-drop or click upload that posts to /api/ingest

import { useCallback, useRef, useState } from "react";
import type { IngestResult } from "@/lib/types";
import { readJson } from "@/lib/fetch";

type Props = { onIndexed: (result: IngestResult) => void };

const ACCEPTED = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

export function UploadZone({ onIndexed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState("");

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setProgress("uploading");
      try {
        const form = new FormData();
        form.append("file", file);
        setProgress("chunking & embedding");
        const res = await fetch("/api/ingest", { method: "POST", body: form });
        const data = await readJson(res);
        if (!res.ok)
          throw new Error(
            (data as { error?: string })?.error ??
              `Upload failed (${res.status} ${res.statusText})`,
          );
        onIndexed(data as IngestResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress("");
      }
    },
    [onIndexed],
  );

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`group relative w-full rounded-[36px] border-2 border-dashed transition-all px-8 py-14 flex flex-col items-center justify-center gap-4 text-center overflow-hidden
          ${dragOver
            ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
            : "border-[var(--border-strong)] bg-[var(--bg-elev)]/40 hover:bg-[var(--bg-elev)] hover:border-[var(--accent)]/50"}
          ${busy ? "opacity-80 cursor-wait" : "cursor-pointer"}`}
      >
        <span className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[var(--accent-soft)] blur-3xl pointer-events-none" />
        <span className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-[var(--accent-soft)] blur-3xl pointer-events-none" />

        <div className={`relative w-16 h-16 rounded-full bg-[var(--bg-elev-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] ${busy ? "" : "drift"}`}>
          {busy ? (
            <span className="flex gap-1">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m6 10 6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          )}
        </div>
        <div className="relative">
          <div className="text-base sm:text-lg font-medium text-[var(--fg)]">
            {busy ? progress || "working" : "drop a file here"}
          </div>
          <div className="text-sm text-[var(--fg-subtle)] mt-1">
            {busy ? "this can take a moment" : "or click to browse · pdf, txt, md · up to 25 mb"}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </button>
      {error && (
        <p className="mt-3 text-sm text-[var(--danger)] text-center">{error}</p>
      )}
    </div>
  );
}
