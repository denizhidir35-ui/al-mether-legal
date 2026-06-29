import type { AIRequest, AIResponse } from "./types";
import { GeminiProvider } from "./GeminiProvider";

export class AIGateway {
  static async generate(request: AIRequest): Promise<AIResponse> {
    const provider = request.provider || "gemini";

    if (provider === "gemini") {
      return GeminiProvider.generate(request);
    }

    return {
      ok: false,
      text: "",
      provider,
      model: request.model || "",
      error: `${provider} provider henüz aktif değil.`,
    };
  }
}
