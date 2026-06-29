import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIRequest, AIResponse } from "./types";

function messagesToPrompt(messages: AIRequest["messages"]) {
  return messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
}

export class GeminiProvider {
  static providerName = "gemini";

  static async generate(request: AIRequest): Promise<AIResponse> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return {
          ok: false,
          text: "",
          provider: "gemini",
          model: request.model || "gemini-2.5-flash",
          error: "GEMINI_API_KEY tanımlı değil.",
        };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = request.model || "gemini-2.5-flash";
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(messagesToPrompt(request.messages));
      const text = result.response.text();

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
