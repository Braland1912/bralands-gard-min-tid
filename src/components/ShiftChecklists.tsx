import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListChecks, ChevronDown, BookmarkPlus, Minus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";

export type ShiftChecklist = {
  id: string;
  shift_id: string;
  name: string;
  sort_order: number;
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (id: string) =>
    setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const { data: lists = [] } = useQuery({
    queryKey: ["shift-checklists", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("*")
        .eq("shift_id", shiftId)
        .order("sort_order", { ascending: true })
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

  const templateIds = (templates as any[]).map((t) => t.id);
  const { data: allTemplateItems = [] } = useQuery({
    queryKey: ["checklist-template-items-all", templateIds.join(",")],
    queryFn: async () => {
      if (templateIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("template_id, text, sort_order")
        .in("template_id", templateIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: mode === "admin" && templateIds.length > 0,
  });

  const sigOf = (texts: string[]) =>
    texts.map((t) => t.trim().toLowerCase()).sort().join("|");

  const isDuplicateOfTemplate = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return false;
    const listSig = sigOf(
      items.filter((i) => i.shift_checklist_id === listId).map((i) => i.text),
    );
    const listName = list.name.trim().toLowerCase();
    return (templates as any[]).some((t: any) => {
      if (t.name.trim().toLowerCase() !== listName) return false;
      const tplSig = sigOf(
        (allTemplateItems as any[])
          .filter((it: any) => it.template_id === t.id)
          .map((it: any) => it.text),
      );
      return tplSig === listSig;
    });
  };

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

      const nextSort = lists.length;
      const { data: newList, error: listErr } = await supabase
        .from("shift_checklists")
        .insert({ shift_id: shiftId, name: tpl.name, sort_order: nextSort })
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

  const createBlank = useMutation({
    mutationFn: async () => {
      if (!shiftId) throw new Error("Inget pass valt");
      const nextSort = lists.length;
      const { error } = await supabase
        .from("shift_checklists")
        .insert({ shift_id: shiftId, name: "Ny checklista", sort_order: nextSort });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
    },
    onError: () => toast({ title: "Kunde inte skapa checklista", variant: "destructive" }),
  });

  const renameList = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("shift_checklists").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] }),
  });

  const saveAsTemplate = useMutation({
    mutationFn: async (listId: string) => {
      const list = lists.find((l) => l.id === listId);
      if (!list) throw new Error("Lista hittades inte");
      const listItems = items
        .filter((i) => i.shift_checklist_id === listId)
        .sort((a, b) => a.sort_order - b.sort_order);

      const { data: newTpl, error: tplErr } = await supabase
        .from("checklist_templates")
        .insert({ name: list.name })
        .select()
        .single();
      if (tplErr) throw tplErr;

      if (listItems.length > 0) {
        const payload = listItems.map((it, idx) => ({
          template_id: newTpl.id,
          text: it.text,
          sort_order: idx,
        }));
        const { error: itemsErr } = await supabase
          .from("checklist_template_items")
          .insert(payload);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast({ title: "Sparad som mall" });
    },
    onError: () => toast({ title: "Kunde inte spara som mall", variant: "destructive" }),
  });

  const reorderLists = useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("shift_checklists")
          .update({ sort_order: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["shift-checklists", shiftId] });
      const key = ["shift-checklists", shiftId];
      const prev = queryClient.getQueryData<ShiftChecklist[]>(key);
      queryClient.setQueryData<ShiftChecklist[]>(key, (old) =>
        (old ?? []).map((l) => ({ ...l, sort_order: orderedIds.indexOf(l.id) })),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      toast({ title: "Kunde inte ändra ordning", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] }),
  });

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...lists].sort((a, b) => a.sort_order - b.sort_order);
    const oldIdx = sorted.findIndex((l) => l.id === active.id);
    const newIdx = sorted.findIndex((l) => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const orderedIds = arrayMove(sorted, oldIdx, newIdx).map((l) => l.id);
    reorderLists.mutate({ orderedIds });
  };

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

  const reorderItems = useMutation({
    mutationFn: async ({ listId, orderedIds }: { listId: string; orderedIds: string[] }) => {
      // Update each item's sort_order to its new index
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("shift_checklist_items")
          .update({ sort_order: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onMutate: async ({ listId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["shift-checklist-items"] });
      const key = ["shift-checklist-items", listIds.join(",")];
      const prev = queryClient.getQueryData<ShiftChecklistItem[]>(key);
      queryClient.setQueryData<ShiftChecklistItem[]>(key, (old) =>
        (old ?? []).map((i) =>
          i.shift_checklist_id === listId
            ? { ...i, sort_order: orderedIds.indexOf(i.id) }
            : i,
        ),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      toast({ title: "Kunde inte ändra ordning", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleItemDragEnd = (listId: string, listItems: ShiftChecklistItem[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = listItems.findIndex((i) => i.id === active.id);
    const newIdx = listItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const orderedIds = arrayMove(listItems, oldIdx, newIdx).map((i) => i.id);
    reorderItems.mutate({ listId, orderedIds });
  };

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Checklistor</span>
        </div>
        {mode === "admin" && (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={addFromTemplate.isPending}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Från mall
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => createBlank.mutate()}
              disabled={createBlank.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Skapa ny
            </Button>
          </div>
        )}
      </div>

      {lists.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Inga checklistor på detta pass.</p>
      ) : mode === "admin" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleListDragEnd}
        >
          <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {lists.map((list) => {
                const listItems = items.filter((i) => i.shift_checklist_id === list.id);
                const doneCount = listItems.filter((i) => i.is_checked).length;
                const totalCount = listItems.length;
                const allDone = totalCount > 0 && doneCount === totalCount;
                const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
                return (
                  <SortableItem key={list.id} id={list.id}>
                    <div className="border border-border rounded-xl p-3 space-y-2 bg-background flex-1 min-w-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            defaultValue={list.name}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== list.name) renameList.mutate({ id: list.id, name: v });
                            }}
                            className="h-7 text-sm font-semibold flex-1 min-w-0"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            {totalCount > 0 && (
                              <span
                                className={`text-[11px] font-medium tabular-nums ${
                                  allDone ? "text-emerald-700" : "text-muted-foreground"
                                }`}
                              >
                                {doneCount}/{totalCount}
                              </span>
                            )}
                            {!isDuplicateOfTemplate(list.id) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => saveAsTemplate.mutate(list.id)}
                                disabled={saveAsTemplate.isPending}
                                title="Spara som mall"
                              >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteList.mutate(list.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {totalCount > 0 && (
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                allDone ? "bg-emerald-500" : "bg-primary"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleItemDragEnd(list.id, listItems)}
                      >
                        <SortableContext items={listItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1.5">
                            {listItems.map((item) => (
                              <SortableItem key={item.id} id={item.id}>
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => removeItem.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </SortableItem>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>

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
                    </div>
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const listItems = items.filter((i) => i.shift_checklist_id === list.id);
            const doneCount = listItems.filter((i) => i.is_checked).length;
            const totalCount = listItems.length;
            const allDone = totalCount > 0 && doneCount === totalCount;
            const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
            return (
              <div key={list.id} className="border border-border rounded-xl p-3 space-y-2 bg-background">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{list.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {totalCount > 0 && (
                        <span
                          className={`text-[11px] font-medium tabular-nums ${
                            allDone ? "text-emerald-700" : "text-muted-foreground"
                          }`}
                        >
                          {doneCount}/{totalCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {totalCount > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          allDone ? "bg-emerald-500" : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShiftChecklists;
