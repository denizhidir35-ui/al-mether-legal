"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  CalendarService,
  type CalendarServiceEvent,
  type CalendarServiceFilters,
} from "@/lib/services/CalendarService";

type CalendarContextValue = {
  events: CalendarServiceEvent[];
  loading: boolean;
  error: string;
  filters: CalendarServiceFilters;
  setFilters: (filters: CalendarServiceFilters) => void;
  refresh: () => Promise<void>;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarServiceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CalendarServiceFilters>({});

  async function refresh() {
    setLoading(true);
    setError("");

    const result = await CalendarService.listEvents(filters);

    if (!result.ok) {
      setEvents([]);
      setError(result.error || "Takvim kayıtları alınamadı.");
      setLoading(false);
      return;
    }

    setEvents(result.events);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [JSON.stringify(filters)]);

  const value = useMemo(
    () => ({
      events,
      loading,
      error,
      filters,
      setFilters,
      refresh,
    }),
    [events, loading, error, filters]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);

  if (!context) {
    throw new Error("useCalendar CalendarProvider içinde kullanılmalı.");
  }

  return context;
}
