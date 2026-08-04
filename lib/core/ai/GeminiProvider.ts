import { GoogleGenAI } from "@google/genai";
import type { AIRequest, AIResponse } from "./types";

function messagesToPrompt(messages: AIRequest["messages"]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

export class GeminiProvider {
  static providerName = "gemini";

  static async generate(request: AIRequest): Promise<AIResponse> {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      if (!apiKey) {
        return {
          ok: false,
          text: "",
          provider: "gemini",
          model: request.model || "gemini-2.5-flash",
          error: "GEMINI_API_KEY tanımlı değil.",
        };
      }

      const modelName = request.model || "gemini-2.5-flash";
      const ai = new GoogleGenAI({ apiKey });

      const result = await ai.models.generateContent({
        model: modelName,
        contents: messagesToPrompt(request.messages),
      });

      const text = result.text || "";

      return {
        ok: true,
        text,
        provider: "gemini",
        model: modelName,
        raw: result,
      };
    } catch (error: any) {
      return {
        ok: false,
        text: "",
        provider: "gemini",
        model: request.model || "gemini-2.5-flash",
        error: error?.message || "GeminiProvider hata verdi.",
      };
    }
  }
}
