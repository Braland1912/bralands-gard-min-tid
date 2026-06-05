import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  requires_note: boolean;
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
          "id, time_entry_id, category_id, category_label, note, checklist_state, started_at, ended_at, task_categories(is_break, requires_note)",
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
        requires_note: row.task_categories?.requires_note === true,
      }));
    },
  });
};

/**
 * Uppdaterar note på en activity_logs-rad. Optimistisk uppdatering mot
 * ["entry-activity-logs", timeEntryId].
 */
export const useUpdateEntryLogNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      logId,
      note,
    }: {
      logId: string;
      note: string;
      timeEntryId: string;
    }) => {
      const trimmed = note.trim();
      const { error } = await db
        .from("activity_logs")
        .update({ note: trimmed.length > 0 ? trimmed : null })
        .eq("id", logId);
      if (error) throw error;
    },
    onMutate: async ({ logId, note, timeEntryId }) => {
      const key = ["entry-activity-logs", timeEntryId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EntryActivityLogRow[]>(key);
      const trimmed = note.trim();
      if (prev) {
        qc.setQueryData<EntryActivityLogRow[]>(
          key,
          prev.map((r) =>
            r.id === logId ? { ...r, note: trimmed.length > 0 ? trimmed : null } : r,
          ),
        );
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("Kunde inte spara noteringen");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["entry-activity-logs", vars.timeEntryId] });
      qc.invalidateQueries({ queryKey: ["activity-logs", vars.timeEntryId] });
    },
  });
};

/**
 * Uppdaterar checklist_state på en activity_logs-rad. Optimistisk uppdatering.
 */
export const useUpdateEntryLogChecklist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      logId,
      state,
    }: {
      logId: string;
      state: Array<{ item: string; done: boolean }>;
      timeEntryId: string;
    }) => {
      const { error } = await db
        .from("activity_logs")
        .update({ checklist_state: state })
        .eq("id", logId);
      if (error) throw error;
    },
    onMutate: async ({ logId, state, timeEntryId }) => {
      const key = ["entry-activity-logs", timeEntryId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EntryActivityLogRow[]>(key);
      if (prev) {
        qc.setQueryData<EntryActivityLogRow[]>(
          key,
          prev.map((r) => (r.id === logId ? { ...r, checklist_state: state } : r)),
        );
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("Kunde inte spara checklistan");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["entry-activity-logs", vars.timeEntryId] });
      qc.invalidateQueries({ queryKey: ["activity-logs", vars.timeEntryId] });
    },
  });
};
