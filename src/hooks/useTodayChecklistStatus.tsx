import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UncheckedItem = {
  id: string;
  text: string;
  list: string;
};

/**
 * Returns the count of unchecked checklist items across all of today's shifts
 * for the given user, plus a preview list of the unchecked item names so we
 * can show them in the early-clockout dialog.
 */
export const useTodayChecklistStatus = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["today-checklist-status", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      const empty = { unchecked: 0, total: 0, hasShifts: false, items: [] as UncheckedItem[] };
      if (!userId) return empty;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { data: shifts, error: sErr } = await supabase
        .from("schedules")
        .select("id")
        .eq("user_id", userId)
        .eq("date", dateStr);
      if (sErr) throw sErr;
      if (!shifts || shifts.length === 0) return empty;

      const shiftIds = shifts.map((s) => s.id);
      const { data: lists, error: lErr } = await supabase
        .from("shift_checklists")
        .select("id, name")
        .in("shift_id", shiftIds);
      if (lErr) throw lErr;
      if (!lists || lists.length === 0) {
        return { unchecked: 0, total: 0, hasShifts: true, items: [] };
      }

      const listMap = new Map(lists.map((l) => [l.id, l.name as string]));
      const listIds = lists.map((l) => l.id);
      const { data: items, error: iErr } = await supabase
        .from("shift_checklist_items")
        .select("id, text, is_checked, shift_checklist_id, sort_order")
        .in("shift_checklist_id", listIds)
        .order("sort_order", { ascending: true });
      if (iErr) throw iErr;

      const total = items?.length ?? 0;
      const uncheckedItems: UncheckedItem[] = (items ?? [])
        .filter((i) => !i.is_checked)
        .map((i) => ({
          id: i.id,
          text: i.text,
          list: listMap.get(i.shift_checklist_id) ?? "",
        }));
      return { unchecked: uncheckedItems.length, total, hasShifts: true, items: uncheckedItems };
    },
  });
};
