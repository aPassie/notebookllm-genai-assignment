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
  origin: "doc" | "web";
  url?: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  cragMeta?: CragMeta;
};

export type ChatTurn = Pick<Message, "role" | "content">;


export type CragAction = "CORRECT" | "INCORRECT" | "AMBIGUOUS";

export type EvalResult = {
  idx: number;
  score: number;   
  reason: string;
};

export type WebResult = {
  title: string;
  content: string;
  url: string;
};

export type CragMeta = {
  action: CragAction;
  totalRetrieved: number;
  relevantCount: number;
  filteredOut: number;
  webSearchUsed: boolean;
  webResultCount: number;
};
