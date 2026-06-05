import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskCategory {
  id: string;
  label: string;
  requires_note: boolean;
  checklist_items: string[] | null;
  sort_order: number;
  is_active: boolean;
  is_break: boolean;
}

export interface ChecklistStateItem {
  item: string;
  done: boolean;
}

export interface ActivityLog {
  id: string;
  time_entry_id: string;
  worker_id: string;
  category_id: string | null;
  category_label: string;
  note: string | null;
  checklist_state: ChecklistStateItem[] | null;
  started_at: string;
  ended_at: string | null;
}

const db = supabase as any;

export const useTaskCategories = () => {
  return useQuery({
    queryKey: ["task-categories"],
    queryFn: async (): Promise<TaskCategory[]> => {
      const { data, error } = await db
        .from("task_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskCategory[];
    },
  });
};

export const useActivityLogs = (timeEntryId: string | null | undefined) => {
  return useQuery({
    queryKey: ["activity-logs", timeEntryId],
    queryFn: async (): Promise<ActivityLog[]> => {
      if (!timeEntryId) return [];
      const { data, error } = await db
        .from("activity_logs")
        .select("*")
        .eq("time_entry_id", timeEntryId)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
    enabled: !!timeEntryId,
    refetchInterval: 30000,
  });
};

interface SwitchTaskArgs {
  timeEntryId: string;
  workerId: string;
  category: TaskCategory;
  note?: string | null;
  currentOpenId?: string | null;
}

export const useSwitchTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      timeEntryId,
      workerId,
      category,
      note,
      currentOpenId,
    }: SwitchTaskArgs) => {
      const now = new Date().toISOString();

      if (currentOpenId) {
        const { error: closeErr } = await db
          .from("activity_logs")
          .update({ ended_at: now })
          .eq("id", currentOpenId)
          .is("ended_at", null);
        if (closeErr) throw closeErr;
      }

      const checklist_state =
        category.checklist_items && category.checklist_items.length > 0
          ? category.checklist_items.map((item) => ({ item, done: false }))
          : null;

      const { error: insErr } = await db.from("activity_logs").insert({
        time_entry_id: timeEntryId,
        worker_id: workerId,
        category_id: category.id,
        category_label: category.label,
        note: note ?? null,
        checklist_state,
        started_at: now,
      });
      if (insErr) throw insErr;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["activity-logs", vars.timeEntryId] });
    },
  });
};

export const useUpdateChecklistState = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      logId,
      state,
    }: {
      logId: string;
      state: ChecklistStateItem[];
      timeEntryId: string;
    }) => {
      const { error } = await db
        .from("activity_logs")
        .update({ checklist_state: state })
        .eq("id", logId);
      if (error) throw error;
    },
    onMutate: async ({ logId, state, timeEntryId }) => {
      await qc.cancelQueries({ queryKey: ["activity-logs", timeEntryId] });
      const prev = qc.getQueryData<ActivityLog[]>(["activity-logs", timeEntryId]);
      if (prev) {
        qc.setQueryData<ActivityLog[]>(
          ["activity-logs", timeEntryId],
          prev.map((l) => (l.id === logId ? { ...l, checklist_state: state } : l)),
        );
      }
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["activity-logs", vars.timeEntryId], ctx.prev);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["activity-logs", vars.timeEntryId] });
    },
  });
};

export const useUpdateActivityNote = () => {
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
      const { error } = await db
        .from("activity_logs")
        .update({ note: note.length > 0 ? note : null })
        .eq("id", logId);
      if (error) throw error;
    },
    onMutate: async ({ logId, note, timeEntryId }) => {
      await qc.cancelQueries({ queryKey: ["activity-logs", timeEntryId] });
      const prev = qc.getQueryData<ActivityLog[]>(["activity-logs", timeEntryId]);
      if (prev) {
        qc.setQueryData<ActivityLog[]>(
          ["activity-logs", timeEntryId],
          prev.map((l) => (l.id === logId ? { ...l, note: note.length > 0 ? note : null } : l)),
        );
      }
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["activity-logs", vars.timeEntryId], ctx.prev);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["activity-logs", vars.timeEntryId] });
    },
  });
};

export const useCloseOpenActivityLog = () => {
  return useMutation({
    mutationFn: async (workerId: string) => {
      const now = new Date().toISOString();
      const { error } = await db
        .from("activity_logs")
        .update({ ended_at: now })
        .eq("worker_id", workerId)
        .is("ended_at", null);
      if (error) throw error;
    },
  });
};
