export type AIProviderName =
  | "gemini"
  | "openai"
  | "claude"
  | "deepseek"
  | "local"
  | string;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  provider?: AIProviderName;
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  jsonMode?: boolean;
  product?: string;
  task?: string;
  metadata?: Record<string, unknown>;
};

export type AIResponse = {
  ok: boolean;
  text: string;
  provider: AIProviderName;
  model: string;
  error?: string;
  raw?: unknown;
};
