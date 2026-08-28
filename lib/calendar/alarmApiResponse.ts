export const ALARM_LOAD_ERROR_MESSAGE =
  "Alarm kayıtları şu anda alınamadı.";

type AlarmApiSuccess<T> = {
  ok: true;
  data: T | null;
};

type AlarmApiFailure = {
  ok: false;
  error: string;
};

export async function readAlarmApiResponse<T>(
  response: Response
): Promise<AlarmApiSuccess<T> | AlarmApiFailure> {
  if (response.status === 204) {
    return response.ok
      ? { ok: true, data: null }
      : {
          ok: false,
          error: ALARM_LOAD_ERROR_MESSAGE,
        };
  }

  const body = await response.text();

  if (!body.trim()) {
    return response.ok
      ? { ok: true, data: null }
      : {
          ok: false,
          error: ALARM_LOAD_ERROR_MESSAGE,
        };
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    return {
      ok: false,
      error: ALARM_LOAD_ERROR_MESSAGE,
    };
  }

  try {
    const data = JSON.parse(body) as T & {
      ok?: boolean;
      error?: unknown;
    };

    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        error:
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : ALARM_LOAD_ERROR_MESSAGE,
      };
    }

    return {
      ok: true,
      data,
    };
  } catch {
    return {
      ok: false,
      error: ALARM_LOAD_ERROR_MESSAGE,
    };
  }
}
