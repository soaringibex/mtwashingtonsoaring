// Where a briefing should look: the summit's local flying day, and the window within it —
// today's remaining hours, or tomorrow's once today's is done.

export type FlyingWindow = {
  /** Local date (YYYY-MM-DD) the briefing covers. */
  date: string;
  tomorrow: boolean;
  /** The summit's current local hour (America/New_York, 0–23). */
  nowHour: number;
  /** First hour to show. */
  startHour: number;
};

const LAST_HOUR = 21;
const ROLL_OVER_HOUR = 20;

export function flyingWindow(times: string[]): FlyingWindow | null {
  if (times.length === 0) return null;
  const dates = Array.from(new Set(times.map((time) => time.slice(0, 10))));
  const nowHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  // Late evening: the flying day is done — brief tomorrow's window instead.
  const tomorrow = nowHour >= ROLL_OVER_HOUR && dates.length > 1;
  const date = tomorrow ? dates[1] : dates[0];
  const startHour = tomorrow ? 6 : Math.max(6, Math.min(nowHour, LAST_HOUR) - 1);
  return { date, tomorrow, nowHour, startHour };
}

export const inWindow = (hour: number, window: FlyingWindow) =>
  hour >= window.startHour && hour <= LAST_HOUR;

export function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
