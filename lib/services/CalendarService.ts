export type CalendarServiceEvent = {
  id: string;
  legalEventId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  risk: string;
  source: string;
  sourceId: string;
  raw?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarServiceResponse = {
  ok: boolean;
  count: number;
  events: CalendarServiceEvent[];
  error?: string;
};

export type CalendarServiceFilters = {
  from?: string;
  to?: string;
  risk?: string;
  source?: string;
};

function buildQuery(filters: CalendarServiceFilters = {}) {
  const params = new URLSearchParams();

  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.risk) params.set("risk", filters.risk);
  if (filters.source) params.set("source", filters.source);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export class CalendarService {
  static async listEvents(
    filters: CalendarServiceFilters = {}
  ): Promise<CalendarServiceResponse> {
    try {
      const response = await fetch(`/api/calendar-events${buildQuery(filters)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          count: 0,
          events: [],
          error: data?.error || "Takvim kayıtları alınamadı.",
        };
      }

      return {
        ok: Boolean(data?.ok),
        count: Number(data?.count || 0),
        events: Array.isArray(data?.events) ? data.events : [],
        error: data?.error,
      };
    } catch (error: any) {
      return {
        ok: false,
        count: 0,
        events: [],
        error: error?.message || "CalendarService hata verdi.",
      };
    }
  }
}
