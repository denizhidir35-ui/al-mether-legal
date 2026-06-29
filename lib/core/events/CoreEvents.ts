import { EventBus } from "./EventBus";
import { EventStore } from "./EventStore";
import type { CoreEventResult } from "./types";

export class CoreEvents {
  static async publish(input: Parameters<typeof EventBus.emit>[0]): Promise<CoreEventResult> {
    const emitted = await EventBus.emit(input);

    if (!emitted.ok || !emitted.event) {
      return emitted;
    }

    await EventStore.save(emitted.event);

    return emitted;
  }
}
