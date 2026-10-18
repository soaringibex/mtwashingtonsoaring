/**
 * The four stages of a wave camp, and the calendar that decides which one the
 * draft pilot page opens on.
 *
 * The camp runs from the Saturday before the second Monday of October through
 * the Sunday after that Monday (Columbus Day weekend). The rest of the year
 * divides into the fortnight after camp, the months between camps, and the
 * run-up from September 1.
 *
 * Dates are plain calendar days and all arithmetic is UTC so a daylight-saving
 * change cannot move a boundary by an hour.
 */

export type WaveCampStage = "before" | "during" | "after" | "between";

export const stageOrder: WaveCampStage[] = ["before", "during", "after", "between"];

export const stageLabels: Record<WaveCampStage, string> = {
  before: "Before",
  during: "During",
  after: "After",
  between: "Between camps",
};

export type CalendarDate = {
  year: number;
  /** 1–12. */
  month: number;
  /** 1–31. */
  day: number;
};

export type WaveCampDates = {
  year: number;
  start: CalendarDate;
  end: CalendarDate;
};

const MS_PER_DAY = 86_400_000;
const NEW_YORK_TIME_ZONE = "America/New_York";

const newYorkDay = new Intl.DateTimeFormat("en-US", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const monthAndDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
});

const dayOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "numeric",
});

export function isWaveCampStage(value: string): value is WaveCampStage {
  return stageOrder.includes(value as WaveCampStage);
}

/** Today's calendar date in the camp's own time zone. */
export function newYorkDate(now: Date = new Date()): CalendarDate {
  const parts = newYorkDay.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

function utcValue(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function fromUtcValue(value: number): CalendarDate {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcValue(utcValue(date) + days * MS_PER_DAY);
}

export function compareDates(left: CalendarDate, right: CalendarDate): number {
  return utcValue(left) - utcValue(right);
}

/** The camp's dates for one October: the second Monday, less two days and plus six. */
export function waveCampDates(year: number): WaveCampDates {
  const octoberFirst = new Date(Date.UTC(year, 9, 1));
  const firstMonday = 1 + ((1 - octoberFirst.getUTCDay() + 7) % 7);
  const secondMonday = firstMonday + 7;
  return {
    year,
    start: { year, month: 10, day: secondMonday - 2 },
    end: { year, month: 10, day: secondMonday + 6 },
  };
}

/** The camp a pilot is preparing for, or waiting for, on a given day. */
export function nextWaveCamp(today: CalendarDate): WaveCampDates {
  const thisYear = waveCampDates(today.year);
  return compareDates(today, thisYear.end) > 0 ? waveCampDates(today.year + 1) : thisYear;
}

/**
 * The camp the Between stage points at. Once this year's camp has started, the
 * next one to wait for is next October; before it starts, it is this October.
 */
export function nextCampAfter(today: CalendarDate): WaveCampDates {
  const thisYear = waveCampDates(today.year);
  return compareDates(today, thisYear.start) >= 0 ? waveCampDates(today.year + 1) : thisYear;
}

export function stageForDate(today: CalendarDate): WaveCampStage {
  const camp = waveCampDates(today.year);

  if (compareDates(today, camp.start) < 0) {
    // September 1 opens the run-up. Before that, the previous camp is still
    // the one being talked about.
    return today.month >= 9 ? "before" : "between";
  }

  if (compareDates(today, camp.end) <= 0) return "during";

  // The 14 days following camp end, inclusive: camp end + 1 through + 14.
  if (compareDates(today, addDays(camp.end, 14)) <= 0) return "after";

  return "between";
}

/** `October 10 to 18, 2026` — plain words, no dash to argue about. */
export function formatWaveCampDates(camp: WaveCampDates): string {
  const start = monthAndDay.format(
    new Date(Date.UTC(camp.start.year, camp.start.month - 1, camp.start.day)),
  );
  const end =
    camp.start.month === camp.end.month
      ? dayOnly.format(new Date(Date.UTC(camp.end.year, camp.end.month - 1, camp.end.day)))
      : monthAndDay.format(
          new Date(Date.UTC(camp.end.year, camp.end.month - 1, camp.end.day)),
        );
  return `${start} to ${end}, ${camp.year}`;
}
