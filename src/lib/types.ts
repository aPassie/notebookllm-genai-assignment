// shared types passed between server routes and client components

export type IngestResult = {
  docId: string;
  fileName: string;
  pages: number;
  chunks: number;
};

export type Source = {
  page: number;
  snippet: string;
  score: number;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export type ChatTurn = Pick<Message, "role" | "content">;
