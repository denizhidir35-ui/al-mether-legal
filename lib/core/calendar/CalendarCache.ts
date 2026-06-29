import type { CoreCalendarEvent } from "./types";

const CACHE_KEY = "al_mether_core_calendar_events";

export class CalendarCache {
  static getEvents(): CoreCalendarEvent[] {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static setEvents(events: CoreCalendarEvent[]) {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(events));
    } catch {
      return;
    }
  }

  static clear() {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      return;
    }
  }
}
