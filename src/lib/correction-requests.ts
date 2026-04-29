/**
 * Pure helpers for time correction requests filtering & counting.
 * Extracted so we can unit-test that:
 *  - oldCount uses the SAME predicate as the DB DELETE (created_at < cutoff)
 *  - chip counters (Alla/Tidiga/Korrigeringar) match the visible list
 *  - filters compose correctly with the selected worker
 */

export const EARLY_PREFIX = "Tidig utstämpling med obockade punkter";

export type CorrectionRequest = {
  id: string;
  worker_id: string;
  worker_name: string;
  status: "pending" | "approved" | "denied";
  reason: string;
  created_at?: string | null;
  date?: string;
};

export const isEarlyClockout = (r: Pick<CorrectionRequest, "reason">): boolean =>
  typeof r?.reason === "string" && r.reason.startsWith(EARLY_PREFIX);

/** Filter by worker. "all" returns all requests. */
export const filterByWorker = <T extends Pick<CorrectionRequest, "worker_id">>(
  requests: T[],
  workerId: string,
): T[] => (workerId === "all" ? requests : requests.filter((r) => r.worker_id === workerId));

/**
 * Count requests with `created_at < cutoffIso`.
 * MUST match the Supabase `.lt("created_at", cutoffIso)` filter exactly:
 *   - Skips rows where created_at is missing/null/non-string.
 */
export const countOld = <T extends Pick<CorrectionRequest, "created_at">>(
  requests: T[],
  cutoffIso: string,
): number =>
  requests.filter((r) => typeof r.created_at === "string" && (r.created_at as string) < cutoffIso)
    .length;

/** Chip counts derived from worker-filtered list. Alla === Tidiga + Korrigeringar. */
export const chipCounts = <T extends Pick<CorrectionRequest, "reason">>(workerFiltered: T[]) => {
  const totalEarly = workerFiltered.filter(isEarlyClockout).length;
  const totalNormal = workerFiltered.filter((r) => !isEarlyClockout(r)).length;
  return { totalEarly, totalNormal, totalAll: totalEarly + totalNormal };
};
