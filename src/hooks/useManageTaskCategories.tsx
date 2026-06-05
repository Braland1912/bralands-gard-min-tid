import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface ManagedTaskCategory {
  id: string;
  label: string;
  requires_note: boolean;
  checklist_items: string[] | null;
  is_break: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const QK = ["manage-task-categories"] as const;

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: QK });
  // Medarbetarnas chip-vy (useTaskCategories)
  qc.invalidateQueries({ queryKey: ["task-categories"] });
};

export const useManageTaskCategories = () => {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<ManagedTaskCategory[]> => {
      const { data, error } = await db
        .from("task_categories")
        .select("*")
        .order("is_active", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) {
        toast.error("Kunde inte hämta uppgifter");
        throw error;
      }
      return (data ?? []) as ManagedTaskCategory[];
    },
  });
};

export interface UpsertTaskCategoryInput {
  id?: string;
  label: string;
  requires_note: boolean;
  is_break: boolean;
  checklist_items: string[];
}

export const useCreateTaskCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTaskCategoryInput) => {
      // sort_order sist bland alla
      const { data: maxRow } = await db
        .from("task_categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.sort_order ?? 0) + 1;
      const { error } = await db.from("task_categories").insert({
        label: input.label,
        requires_note: input.requires_note,
        is_break: input.is_break,
        checklist_items: input.checklist_items.length ? input.checklist_items : null,
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Uppgift tillagd");
      invalidateAll(qc);
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara"),
  });
};

export const useUpdateTaskCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTaskCategoryInput & { id: string }) => {
      const { error } = await db
        .from("task_categories")
        .update({
          label: input.label,
          requires_note: input.requires_note,
          is_break: input.is_break,
          checklist_items: input.checklist_items.length ? input.checklist_items : null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Uppgift uppdaterad");
      invalidateAll(qc);
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara"),
  });
};

export const useSetTaskCategoryActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db
        .from("task_categories")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.is_active ? "Uppgift återställd" : "Uppgift arkiverad");
      invalidateAll(qc);
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte uppdatera"),
  });
};

export const useSwapTaskCategoryOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      a,
      b,
    }: {
      a: { id: string; sort_order: number };
      b: { id: string; sort_order: number };
    }) => {
      // Två separata updates; PostgREST har ingen transaktion här men race är
      // ofarlig (max temporär dubblett av sort_order, ingen unique constraint).
      const { error: e1 } = await db
        .from("task_categories")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await db
        .from("task_categories")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => invalidateAll(qc),
    onError: (e: any) => toast.error(e.message ?? "Kunde inte flytta"),
  });
};
