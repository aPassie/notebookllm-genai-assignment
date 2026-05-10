"use client";

// drawer contents: new chat button + list of past chats with delete

import type { ChatRecord } from "@/lib/useChats";

type Props = {
  chats: ChatRecord[];
  activeId: string | null;
  creatingNew: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
};

export function Sidebar({
  chats,
  activeId,
  creatingNew,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: Props) {
  return (
    <aside className="w-full h-full p-3 flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNew}
          className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-full border transition ${
            creatingNew
              ? "bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]"
              : "bg-[var(--bg-elev-2)]/60 border-[var(--border)] text-[var(--fg)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          }`}
        >
          <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-base leading-none font-medium shrink-0">
            +
          </span>
          <span className="font-medium text-sm">new chat</span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="w-9 h-9 rounded-full border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] flex items-center justify-center shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {chats.length > 0 && (
        <>
          <div className="px-3 mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
            recent
          </div>
          <ul className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
            {chats.map((chat) => (
              <SidebarItem
                key={chat.doc.docId}
                chat={chat}
                active={chat.doc.docId === activeId && !creatingNew}
                onSelect={() => onSelect(chat.doc.docId)}
                onDelete={() => onDelete(chat.doc.docId)}
              />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function SidebarItem({
  chat,
  active,
  onSelect,
  onDelete,
}: {
  chat: ChatRecord;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`group cursor-pointer text-left px-3.5 py-2.5 rounded-2xl border flex items-center gap-2.5 transition ${
          active
            ? "bg-[var(--accent-soft)] border-[var(--accent)]/40"
            : "border-transparent hover:bg-[var(--bg-elev)]/60 hover:border-[var(--border)]"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-[var(--accent)]" : "bg-[var(--fg-subtle)]"}`}
        />
        <div className="flex-1 min-w-0">
          <div
            className={`truncate text-sm ${active ? "text-[var(--fg)] font-medium" : "text-[var(--fg-muted)]"}`}
          >
            {chat.doc.fileName}
          </div>
          <div className="text-[11px] text-[var(--fg-subtle)] truncate">
            {chat.doc.chunks} chunks
            {chat.messages.length > 0 ? ` · ${chat.messages.length} msg` : ""}
          </div>
        </div>
        <span
          role="button"
          tabIndex={0}
          aria-label="delete chat"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--fg-subtle)] hover:text-[var(--accent)] text-base px-1 leading-none"
        >
          ×
        </span>
      </div>
    </li>
  );
}
