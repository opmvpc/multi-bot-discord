export interface ProcessedMessage {
  role: "system" | "user" | "assistant";
  content: string;
  author?: string;
  timestamp?: number;
}

export interface LLMResponse {
  type: "text" | "image";
  content: string;
}
