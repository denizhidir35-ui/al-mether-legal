import type { CoreEvent, CoreEventHandler, CoreEventResult } from "./types";

const handlers = new Map<string, CoreEventHandler[]>();

function createCoreEvent(input: Omit<CoreEvent, "id" | "createdAt">): CoreEvent {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export class EventBus {
  static on(type: string, handler: CoreEventHandler) {
    const current = handlers.get(type) || [];
    handlers.set(type, [...current, handler]);
  }

  static off(type: string, handler: CoreEventHandler) {
    const current = handlers.get(type) || [];
    handlers.set(
      type,
      current.filter((item) => item !== handler)
    );
  }

  static async emit(input: Omit<CoreEvent, "id" | "createdAt">): Promise<CoreEventResult> {
    try {
      const event = createCoreEvent(input);

      const exactHandlers = handlers.get(event.type) || [];
      const wildcardHandlers = handlers.get("*") || [];
      const allHandlers = [...exactHandlers, ...wildcardHandlers];

      await Promise.all(allHandlers.map((handler) => handler(event)));

      return {
        ok: true,
        event,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error?.message || "EventBus emit hatası.",
      };
    }
  }

  static clear() {
    handlers.clear();
  }
}
