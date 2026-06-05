import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface EntryActivityLogRow {
  id: string;
  time_entry_id: string;
  category_id: string | null;
  category_label: string;
  note: string | null;
  checklist_state: Array<{ item: string; done: boolean }> | null;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
}

/**
 * Hämtar activity_logs för ett pass (time_entry_id), inkl. om kategorin är rast.
 * Endast aktiverad när `enabled = true` (lazy vid utfällning).
 */
export const useEntryActivityLogs = (
  timeEntryId: string | null | undefined,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: ["entry-activity-logs", timeEntryId],
    enabled: !!timeEntryId && enabled,
    queryFn: async (): Promise<EntryActivityLogRow[]> => {
      const { data, error } = await db
        .from("activity_logs")
        .select(
          "id, time_entry_id, category_id, category_label, note, checklist_state, started_at, ended_at, task_categories(is_break)",
        )
        .eq("time_entry_id", timeEntryId)
        .order("started_at", { ascending: true });
      if (error) {
        toast.error("Kunde inte hämta arbetsloggen");
        throw error;
      }
      return (data ?? []).map((row: any) => ({
        id: row.id,
        time_entry_id: row.time_entry_id,
        category_id: row.category_id,
        category_label: row.category_label,
        note: row.note,
        checklist_state: row.checklist_state ?? null,
        started_at: row.started_at,
        ended_at: row.ended_at,
        is_break:
          row.task_categories?.is_break === true ||
          row.category_label === "Rast",
      }));
    },
  });
};
