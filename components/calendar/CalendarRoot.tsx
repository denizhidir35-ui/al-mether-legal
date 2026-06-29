"use client";

import { CalendarProvider } from "@/components/calendar/CalendarProvider";

export function CalendarRoot({ children }: { children: React.ReactNode }) {
  return <CalendarProvider>{children}</CalendarProvider>;
}
