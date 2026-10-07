// The WRF pipeline's run stamp, parsed from the `wrf-run` dataset (run.json on
// Vercel Blob). The "WRF 1 km" field option appears only while a run is fresh:
// missing, older than 9 h, or a status other than "ok" all hide the option and
// leave the views on the HRRR field.

export type WrfRun = {
  cycle: string;
  /** Short display stamp, e.g. "Oct 6 12Z". */
  label: string;
  status: string;
  generatedAt: string | null;
  initTime: string | null;
};

export const WRF_RUN_MAX_AGE_MS = 9 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20261006T12Z" → "Oct 6 12Z"; anything unexpected is returned as-is. */
export function cycleLabel(cycle: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})Z$/.exec(cycle);
  if (!match) return cycle;
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])} ${match[4]}Z`;
}

export function parseWrfRun(payload: unknown): WrfRun | null {
  if (typeof payload !== "object" || payload === null) return null;
  const run = payload as Record<string, unknown>;
  if (typeof run.cycle !== "string" || typeof run.status !== "string") return null;
  return {
    cycle: run.cycle,
    label: cycleLabel(run.cycle),
    status: run.status,
    generatedAt: typeof run.generated_at === "string" ? run.generated_at : null,
    initTime: typeof run.init_time === "string" ? run.init_time : null,
  };
}

/** Fresh and ok — the only state in which the WRF option is offered. */
export function wrfRunFresh(run: WrfRun | null, now: number): boolean {
  if (!run || run.status !== "ok") return false;
  const stamp = run.generatedAt ?? run.initTime;
  if (stamp === null) return false;
  const parsed = Date.parse(stamp);
  if (Number.isNaN(parsed)) return false;
  const age = now - parsed;
  return age >= -CLOCK_SKEW_MS && age <= WRF_RUN_MAX_AGE_MS;
}
