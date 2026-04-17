import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListChecks, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export type ShiftChecklist = {
  id: string;
  shift_id: string;
  name: string;
};

export type ShiftChecklistItem = {
  id: string;
  shift_checklist_id: string;
  text: string;
  is_checked: boolean;
  sort_order: number;
};

type Props = {
  shiftId: string | null;
  /** "admin" enables creating, deleting, editing items. "worker" only allows toggling is_checked. */
  mode: "admin" | "worker";
};

export const ShiftChecklists = ({ shiftId, mode }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItemFor, setNewItemFor] = useState<Record<string, string>>({});

  const { data: lists = [] } = useQuery({
    queryKey: ["shift-checklists", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("*")
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ShiftChecklist[];
    },
    enabled: !!shiftId,
  });

  const listIds = lists.map((l) => l.id);

  const { data: items = [] } = useQuery({
    queryKey: ["shift-checklist-items", listIds.join(",")],
    queryFn: async () => {
      if (listIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shift_checklist_items")
        .select("*")
        .in("shift_checklist_id", listIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ShiftChecklistItem[];
    },
    enabled: listIds.length > 0,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: mode === "admin" && !!shiftId,
  });

  const addFromTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!shiftId) throw new Error("Inget pass valt");
      const tpl = templates.find((t: any) => t.id === templateId);
      if (!tpl) throw new Error("Mall hittades inte");

      const { data: tplItems, error: tplItemsErr } = await supabase
        .from("checklist_template_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true });
      if (tplItemsErr) throw tplItemsErr;

      const { data: newList, error: listErr } = await supabase
        .from("shift_checklists")
        .insert({ shift_id: shiftId, name: tpl.name })
        .select()
        .single();
      if (listErr) throw listErr;

      if (tplItems && tplItems.length > 0) {
        const payload = tplItems.map((it: any, idx: number) => ({
          shift_checklist_id: newList.id,
          text: it.text,
          sort_order: idx,
        }));
        const { error: itemsErr } = await supabase.from("shift_checklist_items").insert(payload);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
    },
    onError: () => toast({ title: "Kunde inte lägga till checklista", variant: "destructive" }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("shift_checklists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ listId, text }: { listId: string; text: string }) => {
      const sort = items.filter((i) => i.shift_checklist_id === listId).length;
      const { error } = await supabase
        .from("shift_checklist_items")
        .insert({ shift_checklist_id: listId, text, sort_order: sort });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] }),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("shift_checklist_items")
        .update({ is_checked: checked })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey: ["shift-checklist-items"] });
      const prev = queryClient.getQueryData<ShiftChecklistItem[]>([
        "shift-checklist-items",
        listIds.join(","),
      ]);
      queryClient.setQueryData<ShiftChecklistItem[]>(
        ["shift-checklist-items", listIds.join(",")],
        (old) => (old ?? []).map((i) => (i.id === id ? { ...i, is_checked: checked } : i)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["shift-checklist-items", listIds.join(",")], ctx.prev);
      }
      toast({ title: "Kunde inte spara", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] }),
  });

  if (!shiftId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Checklistor</span>
        </div>
        {mode === "admin" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={addFromTemplate.isPending}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Lägg till checklista
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {templates.length === 0 ? (
                <DropdownMenuItem disabled>Inga mallar än</DropdownMenuItem>
              ) : (
                templates.map((t: any) => (
                  <DropdownMenuItem key={t.id} onClick={() => addFromTemplate.mutate(t.id)}>
                    {t.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {lists.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Inga checklistor på detta pass.</p>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const listItems = items.filter((i) => i.shift_checklist_id === list.id);
            const doneCount = listItems.filter((i) => i.is_checked).length;
            const totalCount = listItems.length;
            const allDone = totalCount > 0 && doneCount === totalCount;
            return (
              <div key={list.id} className="border border-border rounded-xl p-3 space-y-2 bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{list.name}</span>
                    {totalCount > 0 && (
                      <span
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                          allDone
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {doneCount}/{totalCount} klara
                      </span>
                    )}
                  </div>
                  {mode === "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteList.mutate(list.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {listItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={item.is_checked}
                        onCheckedChange={(v) =>
                          toggleItem.mutate({ id: item.id, checked: v === true })
                        }
                      />
                      <span
                        className={`flex-1 text-sm ${
                          item.is_checked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {item.text}
                      </span>
                      {mode === "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem.mutate(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {mode === "admin" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newItemFor[list.id] ?? ""}
                      onChange={(e) =>
                        setNewItemFor((p) => ({ ...p, [list.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const text = (newItemFor[list.id] ?? "").trim();
                          if (text) {
                            addItem.mutate(
                              { listId: list.id, text },
                              {
                                onSuccess: () =>
                                  setNewItemFor((p) => ({ ...p, [list.id]: "" })),
                              },
                            );
                          }
                        }
                      }}
                      placeholder="Lägg till punkt..."
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const text = (newItemFor[list.id] ?? "").trim();
                        if (text) {
                          addItem.mutate(
                            { listId: list.id, text },
                            {
                              onSuccess: () =>
                                setNewItemFor((p) => ({ ...p, [list.id]: "" })),
                            },
                          );
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShiftChecklists;
