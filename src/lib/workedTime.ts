/**
 * Shared worked-time calculation.
 *
 * Returns worked minutes between `clockIn` and `endOrNow`, minus the sum of
 * all break intervals that overlap that window. A break is any activity log
 * row flagged as `is_break` (or with `category_label === "Rast"` as a fallback).
 * Open breaks (ended_at = null) are counted up to `endOrNow`.
 */

export interface BreakInterval {
  started_at: string;
  ended_at: string | null;
  is_break?: boolean | null;
  category_label?: string | null;
}

const toMs = (iso: string | Date) =>
  typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();

export const isBreakLog = (log: {
  is_break?: boolean | null;
  category_label?: string | null;
}) => log.is_break === true || log.category_label === "Rast";

export const overlapMs = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) => Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

export const sumBreakMinutes = (
  clockIn: string | Date,
  endOrNow: string | Date,
  logs: BreakInterval[],
) => {
  const start = toMs(clockIn);
  const end = toMs(endOrNow);
  if (end <= start) return 0;
  let totalMs = 0;
  for (const log of logs) {
    if (!isBreakLog(log)) continue;
    const ls = toMs(log.started_at);
    const le = log.ended_at ? toMs(log.ended_at) : end;
    totalMs += overlapMs(start, end, ls, le);
  }
  return Math.round(totalMs / 60000);
};

export const calcWorkedMinutes = (
  clockIn: string | Date,
  endOrNow: string | Date,
  logs: BreakInterval[] = [],
) => {
  const start = toMs(clockIn);
  const end = toMs(endOrNow);
  if (end <= start) return 0;
  const total = Math.round((end - start) / 60000);
  const breakMin = sumBreakMinutes(clockIn, endOrNow, logs);
  return Math.max(0, total - breakMin);
};
