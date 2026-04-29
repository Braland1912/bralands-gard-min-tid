import { describe, it, expect } from "vitest";
import {
  isEarlyClockout,
  filterByWorker,
  countOld,
  chipCounts,
  EARLY_PREFIX,
  type CorrectionRequest,
} from "@/lib/correction-requests";

const makeReq = (overrides: Partial<CorrectionRequest> = {}): CorrectionRequest => ({
  id: crypto.randomUUID(),
  worker_id: "w1",
  worker_name: "Anna",
  status: "pending",
  reason: "Glömde stämpla ut",
  created_at: "2026-04-01T08:00:00.000Z",
  date: "2026-04-01",
  ...overrides,
});

describe("correction-requests helpers", () => {
  describe("isEarlyClockout", () => {
    it("identifies early clockout by reason prefix", () => {
      expect(isEarlyClockout({ reason: `${EARLY_PREFIX} (2 st): hej` })).toBe(true);
      expect(isEarlyClockout({ reason: "Glömde stämpla" })).toBe(false);
      expect(isEarlyClockout({ reason: "" })).toBe(false);
    });
  });

  describe("filterByWorker", () => {
    const reqs = [
      makeReq({ worker_id: "w1" }),
      makeReq({ worker_id: "w2" }),
      makeReq({ worker_id: "w1" }),
      makeReq({ worker_id: "w3" }),
    ];

    it("returns all when 'all'", () => {
      expect(filterByWorker(reqs, "all")).toHaveLength(4);
    });

    it("filters per worker id", () => {
      expect(filterByWorker(reqs, "w1")).toHaveLength(2);
      expect(filterByWorker(reqs, "w2")).toHaveLength(1);
      expect(filterByWorker(reqs, "w-missing")).toHaveLength(0);
    });
  });

  describe("countOld — must mirror DB DELETE predicate", () => {
    const cutoff = "2026-04-15T00:00:00.000Z";

    it("counts only rows strictly older than cutoff", () => {
      const reqs = [
        makeReq({ created_at: "2026-04-01T00:00:00.000Z" }), // old
        makeReq({ created_at: "2026-04-14T23:59:59.999Z" }), // old
        makeReq({ created_at: "2026-04-15T00:00:00.000Z" }), // boundary, NOT < cutoff
        makeReq({ created_at: "2026-04-20T00:00:00.000Z" }), // new
      ];
      expect(countOld(reqs, cutoff)).toBe(2);
    });

    it("ignores rows with missing/null/non-string created_at (matches .lt() in supabase-js)", () => {
      const reqs = [
        makeReq({ created_at: undefined }),
        makeReq({ created_at: null }),
        makeReq({ created_at: "2026-04-01T00:00:00.000Z" }),
      ];
      expect(countOld(reqs, cutoff)).toBe(1);
    });

    it("returns 0 when nothing is old", () => {
      const reqs = [makeReq({ created_at: "2026-05-01T00:00:00.000Z" })];
      expect(countOld(reqs, cutoff)).toBe(0);
    });

    it("respects the worker filter when composed (cleanup-per-worker scenario)", () => {
      const reqs = [
        makeReq({ worker_id: "w1", created_at: "2026-04-01T00:00:00.000Z" }),
        makeReq({ worker_id: "w2", created_at: "2026-04-01T00:00:00.000Z" }),
        makeReq({ worker_id: "w1", created_at: "2026-04-20T00:00:00.000Z" }),
      ];
      expect(countOld(filterByWorker(reqs, "w1"), cutoff)).toBe(1);
      expect(countOld(filterByWorker(reqs, "w2"), cutoff)).toBe(1);
      expect(countOld(filterByWorker(reqs, "all"), cutoff)).toBe(2);
    });
  });

  describe("chipCounts — must equal what the list shows", () => {
    it("Alla === Tidiga + Korrigeringar (invariant)", () => {
      const reqs = [
        makeReq({ reason: `${EARLY_PREFIX} (1 st): a` }),
        makeReq({ reason: `${EARLY_PREFIX} (2 st): b` }),
        makeReq({ reason: "Glömde stämpla" }),
        makeReq({ reason: "Fel tid" }),
        makeReq({ reason: "Annan orsak" }),
      ];
      const c = chipCounts(reqs);
      expect(c.totalEarly).toBe(2);
      expect(c.totalNormal).toBe(3);
      expect(c.totalAll).toBe(c.totalEarly + c.totalNormal);
      expect(c.totalAll).toBe(reqs.length);
    });

    it("respects worker filter — counts always match the filtered list", () => {
      const reqs = [
        makeReq({ worker_id: "w1", reason: `${EARLY_PREFIX} (1 st): a` }),
        makeReq({ worker_id: "w1", reason: "Glömde stämpla" }),
        makeReq({ worker_id: "w2", reason: `${EARLY_PREFIX} (1 st): b` }),
        makeReq({ worker_id: "w2", reason: "Fel tid" }),
        makeReq({ worker_id: "w2", reason: "Annan orsak" }),
      ];

      const w1 = filterByWorker(reqs, "w1");
      const c1 = chipCounts(w1);
      expect(c1).toEqual({ totalEarly: 1, totalNormal: 1, totalAll: 2 });
      expect(c1.totalAll).toBe(w1.length);

      const w2 = filterByWorker(reqs, "w2");
      const c2 = chipCounts(w2);
      expect(c2).toEqual({ totalEarly: 1, totalNormal: 2, totalAll: 3 });
      expect(c2.totalAll).toBe(w2.length);

      const all = filterByWorker(reqs, "all");
      const cAll = chipCounts(all);
      expect(cAll.totalAll).toBe(all.length);
      expect(cAll.totalEarly).toBe(c1.totalEarly + c2.totalEarly);
      expect(cAll.totalNormal).toBe(c1.totalNormal + c2.totalNormal);
    });

    it("handles empty input", () => {
      expect(chipCounts([])).toEqual({ totalEarly: 0, totalNormal: 0, totalAll: 0 });
    });
  });

  describe("end-to-end consistency: oldCount == simulated DELETE count", () => {
    it("client-side oldCount equals number of rows a DB DELETE with same predicate would remove", () => {
      const cutoff = "2026-04-15T00:00:00.000Z";
      const reqs = [
        makeReq({ id: "1", created_at: "2026-03-01T00:00:00.000Z" }),
        makeReq({ id: "2", created_at: "2026-04-14T23:59:59.999Z" }),
        makeReq({ id: "3", created_at: "2026-04-15T00:00:00.000Z" }),
        makeReq({ id: "4", created_at: "2026-04-16T00:00:00.000Z" }),
        makeReq({ id: "5", created_at: null }),
      ];

      // Simulate `.lt("created_at", cutoff)` on the DB:
      const wouldDelete = reqs.filter(
        (r) => typeof r.created_at === "string" && (r.created_at as string) < cutoff,
      );

      expect(countOld(reqs, cutoff)).toBe(wouldDelete.length);
      expect(wouldDelete.map((r) => r.id).sort()).toEqual(["1", "2"]);
    });
  });
});
