export type HolidayKind =
  | "national"
  | "official"
  | "religious"
  | "administrative"
  | "custom";

export type HolidayDuration =
  | "full_day"
  | "half_day_afternoon";

export type HolidayDefinition = {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  duration: HolidayDuration;
  recurring: boolean;
  source?: string;
};

export type DayStatus = {
  date: string;
  dayOfWeek: number;
  weekdayName: string;

  isWeekend: boolean;
  isHoliday: boolean;
  isFullDayHoliday: boolean;
  isHalfDayHoliday: boolean;
  isBusinessDay: boolean;

  holiday: HolidayDefinition | null;
};

export type DeadlineDayType =
  | "calendar_days"
  | "business_days";

export type DeadlineShiftRule =
  | "none"
  | "next_business_day"
  | "previous_business_day";

export type DeadlineCalculationInput = {
  startDate: string;
  duration: number;
  dayType: DeadlineDayType;

  includeStartDate?: boolean;
  shiftRule?: DeadlineShiftRule;

  treatHalfDayAsNonBusiness?: boolean;
};

export type DeadlineCalculationResult = {
  startDate: string;
  rawDeadline: string;
  finalDeadline: string;

  duration: number;
  dayType: DeadlineDayType;
  shiftRule: DeadlineShiftRule;

  shifted: boolean;
  shiftReason: string;

  rawDayStatus: DayStatus;
  finalDayStatus: DayStatus;

  countedDates: string[];
};

export type BusinessCalendarOptions = {
  additionalHolidays?: HolidayDefinition[];
  treatSaturdayAsWeekend?: boolean;
  treatSundayAsWeekend?: boolean;
};

const WEEKDAY_NAMES = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function createUtcDate(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, 12, 0, 0)
  );
}

function toIsoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

function parseIsoDate(value: string): Date {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    throw new Error(
      `Geçersiz tarih biçimi: ${value}. YYYY-MM-DD bekleniyor.`
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = createUtcDate(
    year,
    month,
    day
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Geçersiz takvim tarihi: ${value}.`
    );
  }

  return date;
}

function addDays(
  value: string,
  amount: number
): string {
  const date = parseIsoDate(value);

  date.setUTCDate(
    date.getUTCDate() + amount
  );

  return toIsoDate(date);
}

function createFixedHoliday(
  year: number,
  month: number,
  day: number,
  id: string,
  name: string,
  kind: HolidayKind,
  duration: HolidayDuration = "full_day"
): HolidayDefinition {
  return {
    id: `${id}-${year}`,
    date: `${year}-${pad(month)}-${pad(day)}`,
    name,
    kind,
    duration,
    recurring: true,
    source:
      "2429 sayılı Ulusal Bayram ve Genel Tatiller Hakkında Kanun",
  };
}

function getFixedTurkishHolidays(
  year: number
): HolidayDefinition[] {
  return [
    createFixedHoliday(
      year,
      1,
      1,
      "new-year",
      "Yılbaşı",
      "official"
    ),

    createFixedHoliday(
      year,
      4,
      23,
      "national-sovereignty",
      "Ulusal Egemenlik ve Çocuk Bayramı",
      "national"
    ),

    createFixedHoliday(
      year,
      5,
      1,
      "labour-day",
      "Emek ve Dayanışma Günü",
      "official"
    ),

    createFixedHoliday(
      year,
      5,
      19,
      "commemoration-youth-sports",
      "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
      "national"
    ),

    createFixedHoliday(
      year,
      7,
      15,
      "democracy-national-unity",
      "Demokrasi ve Millî Birlik Günü",
      "official"
    ),

    createFixedHoliday(
      year,
      8,
      30,
      "victory-day",
      "Zafer Bayramı",
      "national"
    ),

    createFixedHoliday(
      year,
      10,
      28,
      "republic-eve",
      "Cumhuriyet Bayramı Arifesi",
      "national",
      "half_day_afternoon"
    ),

    createFixedHoliday(
      year,
      10,
      29,
      "republic-day",
      "Cumhuriyet Bayramı",
      "national"
    ),
  ];
}

function uniqueHolidays(
  holidays: HolidayDefinition[]
): HolidayDefinition[] {
  const map = new Map<
    string,
    HolidayDefinition
  >();

  for (const holiday of holidays) {
    const key = `${holiday.date}:${holiday.id}`;
    map.set(key, holiday);
  }

  return Array.from(map.values()).sort(
    (left, right) =>
      left.date.localeCompare(right.date)
  );
}

export class BusinessCalendarEngine {
  private readonly additionalHolidays: HolidayDefinition[];
  private readonly treatSaturdayAsWeekend: boolean;
  private readonly treatSundayAsWeekend: boolean;

  constructor(
    options: BusinessCalendarOptions = {}
  ) {
    this.additionalHolidays =
      options.additionalHolidays || [];

    this.treatSaturdayAsWeekend =
      options.treatSaturdayAsWeekend !== false;

    this.treatSundayAsWeekend =
      options.treatSundayAsWeekend !== false;
  }

  getHolidaysForYear(
    year: number
  ): HolidayDefinition[] {
    const fixed =
      getFixedTurkishHolidays(year);

    const additional =
      this.additionalHolidays.filter(
        (holiday) =>
          holiday.date.startsWith(
            `${year}-`
          )
      );

    return uniqueHolidays([
      ...fixed,
      ...additional,
    ]);
  }

  getHoliday(
    value: string
  ): HolidayDefinition | null {
    const date = parseIsoDate(value);
    const year = date.getUTCFullYear();

    const holidays =
      this.getHolidaysForYear(year);

    return (
      holidays.find(
        (holiday) =>
          holiday.date === value
      ) || null
    );
  }

  getDayStatus(
    value: string,
    treatHalfDayAsNonBusiness = false
  ): DayStatus {
    const date = parseIsoDate(value);
    const dayOfWeek =
      date.getUTCDay();

    const isSaturday =
      dayOfWeek === 6;

    const isSunday =
      dayOfWeek === 0;

    const isWeekend =
      (isSaturday &&
        this.treatSaturdayAsWeekend) ||
      (isSunday &&
        this.treatSundayAsWeekend);

    const holiday =
      this.getHoliday(value);

    const isFullDayHoliday =
      holiday?.duration === "full_day";

    const isHalfDayHoliday =
      holiday?.duration ===
      "half_day_afternoon";

    const holidayBlocksBusinessDay =
      isFullDayHoliday ||
      (isHalfDayHoliday &&
        treatHalfDayAsNonBusiness);

    return {
      date: value,
      dayOfWeek,
      weekdayName:
        WEEKDAY_NAMES[dayOfWeek],

      isWeekend,
      isHoliday: Boolean(holiday),
      isFullDayHoliday,
      isHalfDayHoliday,

      isBusinessDay:
        !isWeekend &&
        !holidayBlocksBusinessDay,

      holiday,
    };
  }

  isBusinessDay(
    value: string,
    treatHalfDayAsNonBusiness = false
  ): boolean {
    return this.getDayStatus(
      value,
      treatHalfDayAsNonBusiness
    ).isBusinessDay;
  }

  nextBusinessDay(
    value: string,
    includeCurrentDate = false,
    treatHalfDayAsNonBusiness = false
  ): string {
    let cursor = includeCurrentDate
      ? value
      : addDays(value, 1);

    let guard = 0;

    while (
      !this.isBusinessDay(
        cursor,
        treatHalfDayAsNonBusiness
      )
    ) {
      cursor = addDays(cursor, 1);
      guard += 1;

      if (guard > 370) {
        throw new Error(
          "Sonraki iş günü hesaplanamadı."
        );
      }
    }

    return cursor;
  }

  previousBusinessDay(
    value: string,
    includeCurrentDate = false,
    treatHalfDayAsNonBusiness = false
  ): string {
    let cursor = includeCurrentDate
      ? value
      : addDays(value, -1);

    let guard = 0;

    while (
      !this.isBusinessDay(
        cursor,
        treatHalfDayAsNonBusiness
      )
    ) {
      cursor = addDays(cursor, -1);
      guard += 1;

      if (guard > 370) {
        throw new Error(
          "Önceki iş günü hesaplanamadı."
        );
      }
    }

    return cursor;
  }

  addCalendarDays(
    startDate: string,
    duration: number,
    includeStartDate = false
  ): {
    result: string;
    countedDates: string[];
  } {
    parseIsoDate(startDate);

    if (
      !Number.isInteger(duration) ||
      duration < 0
    ) {
      throw new Error(
        "Takvim günü süresi sıfır veya pozitif tam sayı olmalıdır."
      );
    }

    if (duration === 0) {
      return {
        result: startDate,
        countedDates: [],
      };
    }

    const countedDates: string[] = [];
    let cursor = startDate;
    let remaining = duration;

    if (includeStartDate) {
      countedDates.push(cursor);
      remaining -= 1;
    }

    while (remaining > 0) {
      cursor = addDays(cursor, 1);
      countedDates.push(cursor);
      remaining -= 1;
    }

    return {
      result: cursor,
      countedDates,
    };
  }

  addBusinessDays(
    startDate: string,
    duration: number,
    includeStartDate = false,
    treatHalfDayAsNonBusiness = false
  ): {
    result: string;
    countedDates: string[];
  } {
    parseIsoDate(startDate);

    if (
      !Number.isInteger(duration) ||
      duration < 0
    ) {
      throw new Error(
        "İş günü süresi sıfır veya pozitif tam sayı olmalıdır."
      );
    }

    if (duration === 0) {
      return {
        result: startDate,
        countedDates: [],
      };
    }

    const countedDates: string[] = [];
    let cursor = startDate;
    let counted = 0;
    let guard = 0;

    if (
      includeStartDate &&
      this.isBusinessDay(
        cursor,
        treatHalfDayAsNonBusiness
      )
    ) {
      countedDates.push(cursor);
      counted += 1;
    }

    while (counted < duration) {
      cursor = addDays(cursor, 1);
      guard += 1;

      if (
        this.isBusinessDay(
          cursor,
          treatHalfDayAsNonBusiness
        )
      ) {
        countedDates.push(cursor);
        counted += 1;
      }

      if (guard > 5000) {
        throw new Error(
          "İş günü süresi hesaplanamadı."
        );
      }
    }

    return {
      result: cursor,
      countedDates,
    };
  }

  calculateDeadline(
    input: DeadlineCalculationInput
  ): DeadlineCalculationResult {
    parseIsoDate(input.startDate);

    const duration =
      input.duration;

    if (
      !Number.isInteger(duration) ||
      duration < 0
    ) {
      throw new Error(
        "Süre sıfır veya pozitif tam sayı olmalıdır."
      );
    }

    const includeStartDate =
      input.includeStartDate === true;

    const shiftRule =
      input.shiftRule ||
      "next_business_day";

    const treatHalfDayAsNonBusiness =
      input.treatHalfDayAsNonBusiness ===
      true;

    const calculation =
      input.dayType === "business_days"
        ? this.addBusinessDays(
            input.startDate,
            duration,
            includeStartDate,
            treatHalfDayAsNonBusiness
          )
        : this.addCalendarDays(
            input.startDate,
            duration,
            includeStartDate
          );

    const rawDeadline =
      calculation.result;

    const rawDayStatus =
      this.getDayStatus(
        rawDeadline,
        treatHalfDayAsNonBusiness
      );

    let finalDeadline =
      rawDeadline;

    let shiftReason = "";

    if (
      shiftRule ===
        "next_business_day" &&
      !rawDayStatus.isBusinessDay
    ) {
      finalDeadline =
        this.nextBusinessDay(
          rawDeadline,
          false,
          treatHalfDayAsNonBusiness
        );

      shiftReason =
        rawDayStatus.holiday?.name ||
        (rawDayStatus.isWeekend
          ? "Hafta sonu"
          : "İş günü dışı");
    }

    if (
      shiftRule ===
        "previous_business_day" &&
      !rawDayStatus.isBusinessDay
    ) {
      finalDeadline =
        this.previousBusinessDay(
          rawDeadline,
          false,
          treatHalfDayAsNonBusiness
        );

      shiftReason =
        rawDayStatus.holiday?.name ||
        (rawDayStatus.isWeekend
          ? "Hafta sonu"
          : "İş günü dışı");
    }

    const finalDayStatus =
      this.getDayStatus(
        finalDeadline,
        treatHalfDayAsNonBusiness
      );

    return {
      startDate: input.startDate,
      rawDeadline,
      finalDeadline,

      duration,
      dayType: input.dayType,
      shiftRule,

      shifted:
        rawDeadline !== finalDeadline,

      shiftReason,

      rawDayStatus,
      finalDayStatus,

      countedDates:
        calculation.countedDates,
    };
  }

  getMonthDays(
    year: number,
    month: number,
    treatHalfDayAsNonBusiness = false
  ): DayStatus[] {
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2200
    ) {
      throw new Error(
        "Geçersiz yıl değeri."
      );
    }

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new Error(
        "Geçersiz ay değeri."
      );
    }

    const lastDay = new Date(
      Date.UTC(
        year,
        month,
        0,
        12,
        0,
        0
      )
    ).getUTCDate();

    const days: DayStatus[] = [];

    for (
      let day = 1;
      day <= lastDay;
      day += 1
    ) {
      const date = `${year}-${pad(
        month
      )}-${pad(day)}`;

      days.push(
        this.getDayStatus(
          date,
          treatHalfDayAsNonBusiness
        )
      );
    }

    return days;
  }
}

export function createTurkishBusinessCalendar(
  additionalHolidays: HolidayDefinition[] = []
): BusinessCalendarEngine {
  return new BusinessCalendarEngine({
    additionalHolidays,
    treatSaturdayAsWeekend: true,
    treatSundayAsWeekend: true,
  });
}
