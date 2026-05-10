"use client";

// localStorage-backed multi-chat store for the workspace

import { useCallback, useEffect, useState } from "react";
import type { IngestResult, Message } from "./types";

const STORAGE_KEY = "notebooklm-rag:chats:v1";

export type ChatRecord = {
  doc: IngestResult;
  messages: Message[];
};

type Store = {
  byId: Record<string, ChatRecord>;
  order: string[];
  activeId: string | null;
};

const EMPTY: Store = { byId: {}, order: [], activeId: null };

function load(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      byId: parsed.byId ?? {},
      order: parsed.order ?? [],
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return EMPTY;
  }
}

export function useChats() {
  const [store, setStore] = useState<Store>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {}
  }, [store, hydrated]);

  const createChat = useCallback((doc: IngestResult) => {
    setStore((prev) => ({
      byId: { ...prev.byId, [doc.docId]: { doc, messages: [] } },
      order: [doc.docId, ...prev.order.filter((id) => id !== doc.docId)],
      activeId: doc.docId,
    }));
  }, []);

  const setActive = useCallback((id: string | null) => {
    setStore((prev) => ({ ...prev, activeId: id }));
  }, []);

  const deleteChat = useCallback((id: string) => {
    setStore((prev) => {
      const byId = { ...prev.byId };
      delete byId[id];
      const order = prev.order.filter((x) => x !== id);
      const activeId = prev.activeId === id ? (order[0] ?? null) : prev.activeId;
      return { byId, order, activeId };
    });
  }, []);

  const appendMessage = useCallback((id: string, msg: Message) => {
    setStore((prev) => {
      const chat = prev.byId[id];
      if (!chat) return prev;
      return {
        ...prev,
        byId: { ...prev.byId, [id]: { ...chat, messages: [...chat.messages, msg] } },
      };
    });
  }, []);

  const chats = store.order
    .map((id) => store.byId[id])
    .filter((c): c is ChatRecord => Boolean(c));
  const activeChat =
    store.activeId !== null ? (store.byId[store.activeId] ?? null) : null;

  return {
    hydrated,
    chats,
    activeId: store.activeId,
    activeChat,
    createChat,
    setActive,
    deleteChat,
    appendMessage,
  };
}
