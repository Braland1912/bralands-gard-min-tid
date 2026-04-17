import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the count of unchecked checklist items across all of today's shifts
 * for the given user. Used to remind workers to tick off tasks during/after
 * their shift before clocking out.
 */
export const useTodayChecklistStatus = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["today-checklist-status", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!userId) return { unchecked: 0, total: 0, hasShifts: false };
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { data: shifts, error: sErr } = await supabase
        .from("schedules")
        .select("id")
        .eq("user_id", userId)
        .eq("date", dateStr);
      if (sErr) throw sErr;
      if (!shifts || shifts.length === 0) {
        return { unchecked: 0, total: 0, hasShifts: false };
      }

      const shiftIds = shifts.map((s) => s.id);
      const { data: lists, error: lErr } = await supabase
        .from("shift_checklists")
        .select("id")
        .in("shift_id", shiftIds);
      if (lErr) throw lErr;
      if (!lists || lists.length === 0) {
        return { unchecked: 0, total: 0, hasShifts: true };
      }

      const listIds = lists.map((l) => l.id);
      const { data: items, error: iErr } = await supabase
        .from("shift_checklist_items")
        .select("is_checked")
        .in("shift_checklist_id", listIds);
      if (iErr) throw iErr;

      const total = items?.length ?? 0;
      const unchecked = (items ?? []).filter((i) => !i.is_checked).length;
      return { unchecked, total, hasShifts: true };
    },
  });
};
