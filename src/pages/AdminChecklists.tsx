import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Plus, Trash2, ListChecks, Pencil, Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";
import { Checkbox } from "@/components/ui/checkbox";
import ShiftTypeChecklistOrder from "@/components/ShiftTypeChecklistOrder";
import EveningRoundChecklistPicker from "@/components/EveningRoundChecklistPicker";

type Template = { id: string; name: string; sort_order: number; lodge_unit?: string | null };
type Item = { id: string; template_id: string; text: string; sort_order: number };
type ShiftLink = { template_id: string; shift_type: string };

const LODGE_UNITS: { value: string; label: string; chip: string }[] = [
  { value: "Öringen",       label: "Nr. 1 Öringen",       chip: "bg-amber-50 text-amber-800 border-amber-300" },
  { value: "Laxen",         label: "Nr. 2 Laxen",         chip: "bg-rose-50 text-rose-800 border-rose-300" },
  { value: "Kungsfiskaren", label: "Nr. 3 Kungsfiskaren", chip: "bg-sky-50 text-sky-800 border-sky-300" },
  { value: "Strömstaren",   label: "Nr. 4 Strömstaren",   chip: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  { value: "Husvagnen",     label: "Nr. 5 Husvagnen",     chip: "bg-violet-50 text-violet-800 border-violet-300" },
];

const SHIFT_TYPE_OPTIONS: { value: string; label: string; emoji: string; bg: string; border: string; text: string }[] = [
  { value: "morning", label: "Morgon", emoji: "🌅", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  { value: "day", label: "Dag", emoji: "☀️", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { value: "evening", label: "Kväll", emoji: "🌙", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  { value: "fishing", label: "Guidning", emoji: "🎣", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { value: "clearing", label: "Gården", emoji: "🚜", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
];

const AdminChecklists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [editShiftTypes, setEditShiftTypes] = useState<string[]>([]);
  const [editLodgeUnit, setEditLodgeUnit] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!user,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["checklist-template-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
    enabled: !!user,
  });

  const { data: allShiftLinks = [] } = useQuery({
    queryKey: ["checklist-template-shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_shift_types")
        .select("template_id, shift_type");
      if (error) throw error;
      return data as ShiftLink[];
    },
    enabled: !!user,
  });

  const countFor = (id: string) => allItems.filter((i) => i.template_id === id).length;
  const shiftTypesFor = (id: string) =>
    allShiftLinks.filter((l) => l.template_id === id).map((l) => l.shift_type);

  const trimmedEditName = editName.trim().toLowerCase();
  const nameTaken =
    !!editing &&
    trimmedEditName.length > 0 &&
    templates.some((t) => t.id !== editing.id && t.name.trim().toLowerCase() === trimmedEditName);

  const createTemplate = useMutation({
    mutationFn: async () => {
      // Bump existing templates down so the new one appears first
      const ids = templates.map((t) => t.id);
      if (ids.length > 0) {
        for (const t of templates) {
          await supabase
            .from("checklist_templates")
            .update({ sort_order: (t.sort_order ?? 0) + 1 })
            .eq("id", t.id);
        }
      }
      const { data, error } = await supabase
        .from("checklist_templates")
        .insert({ name: "Ny mall", sort_order: 0 })
        .select()
        .single();
      if (error) throw error;
      return data as Template;
    },
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      openEdit(tpl, [], []);
    },
    onError: () => toast({ title: "Kunde inte skapa mall", variant: "destructive" }),
  });

  const reorderTemplates = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("checklist_templates")
          .update({ sort_order: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["checklist-templates"] });
      const prev = queryClient.getQueryData<Template[]>(["checklist-templates"]);
      queryClient.setQueryData<Template[]>(["checklist-templates"], (old) => {
        if (!old) return old;
        const map = new Map(old.map((t) => [t.id, t]));
        return orderedIds.map((id, idx) => ({ ...(map.get(id) as Template), sort_order: idx }));
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["checklist-templates"], ctx.prev);
      toast({ title: "Kunde inte ändra ordning", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
  });

  const handleTemplateDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = templates.findIndex((t) => t.id === active.id);
    const newIdx = templates.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const orderedIds = arrayMove(templates, oldIdx, newIdx).map((t) => t.id);
    reorderTemplates.mutate(orderedIds);
  };

  const openEdit = (tpl: Template, items: Item[], shiftTypes: string[]) => {
    skipNextSaveRef.current = true;
    setEditing(tpl);
    setEditName(tpl.name);
    setEditItems(items);
    setEditShiftTypes(shiftTypes);
    setEditLodgeUnit((tpl.lodge_unit ?? null) as string | null);
    setNewItemText("");
    setAutoSaveState("idle");
  };

  const handleOpenExisting = (tpl: Template) => {
    const items = allItems.filter((i) => i.template_id === tpl.id);
    openEdit(tpl, items, shiftTypesFor(tpl.id));
  };

  const handleAddItem = () => {
    const newId = `tmp-${Date.now()}-${Math.random()}`;
    setEditItems((prev) => [
      ...prev,
      { id: newId, template_id: editing!.id, text: "", sort_order: prev.length },
    ]);
    setNewItemText("");
    // focus next render
    setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-item-id="${newId}"]`);
      el?.focus();
    }, 50);
  };

  const updateItemText = (id: string, text: string) => {
    setEditItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const removeItem = (id: string) => {
    setEditItems((prev) => prev.filter((i) => i.id !== id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const skipNextSaveRef = useRef(false);

  const persistTemplate = async () => {
    if (!editing) return;
    const name = editName.trim() || "Namnlös mall";

    const { error: nameErr } = await supabase
      .from("checklist_templates")
      .update({ name, lodge_unit: editLodgeUnit, updated_at: new Date().toISOString() } as any)
      .eq("id", editing.id);
    if (nameErr) throw nameErr;

    const { error: delErr } = await supabase
      .from("checklist_template_items")
      .delete()
      .eq("template_id", editing.id);
    if (delErr) throw delErr;

    const filtered = editItems
      .map((i, idx) => ({ text: i.text.trim(), sort_order: idx, template_id: editing.id }))
      .filter((i) => i.text.length > 0);

    if (filtered.length > 0) {
      const { error: insErr } = await supabase.from("checklist_template_items").insert(filtered);
      if (insErr) throw insErr;
    }

    const { error: delLinkErr } = await supabase
      .from("checklist_template_shift_types")
      .delete()
      .eq("template_id", editing.id);
    if (delLinkErr) throw delLinkErr;
    if (editShiftTypes.length > 0) {
      const { error: linkErr } = await supabase
        .from("checklist_template_shift_types")
        .insert(editShiftTypes.map((st) => ({ template_id: editing.id, shift_type: st })));
      if (linkErr) throw linkErr;
    }
  };

  // Autosave debounce
  useEffect(() => {
    if (!editing) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (nameTaken) return;
    setAutoSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await persistTemplate();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
          queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] }),
          queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] }),
        ]);
        setAutoSaveState("saved");
      } catch {
        setAutoSaveState("error");
        toast({ title: "Kunde inte spara automatiskt", variant: "destructive" });
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editName, editItems, editShiftTypes, editing?.id]);

  const deleteTemplate = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("checklist_templates").delete().eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] });
      setEditing(null);
      toast({ title: "Mall borttagen" });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (tpl: Template) => {
      const items = allItems.filter((i) => i.template_id === tpl.id);
      const linkedTypes = shiftTypesFor(tpl.id);
      const { data: newTpl, error } = await supabase
        .from("checklist_templates")
        .insert({ name: `${tpl.name} (kopia)` })
        .select()
        .single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: insErr } = await supabase
          .from("checklist_template_items")
          .insert(
            items.map((i, idx) => ({
              template_id: newTpl.id,
              text: i.text,
              sort_order: idx,
            })),
          );
        if (insErr) throw insErr;
      }
      return { tpl: newTpl as Template, items, linkedTypes };
    },
    onSuccess: ({ tpl, items, linkedTypes }) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] });
      openEdit(
        tpl,
        items.map((i, idx) => ({ ...i, id: `tmp-${Date.now()}-${idx}`, template_id: tpl.id, sort_order: idx })),
        linkedTypes,
      );
      toast({ title: "Mall kopierad", description: "Döp om den och spara." });
    },
    onError: () => toast({ title: "Kunde inte kopiera", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Checklistor</h1>
            <p className="text-xs text-muted-foreground">Mallar för återkommande uppgifter</p>
          </div>
          <Button onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ny mall
          </Button>
        </div>
        <EveningRoundChecklistPicker />

        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-10 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Inga mallar ännu. Skapa din första mall.</p>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTemplateDragEnd}
          >
            <SortableContext items={templates.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <SortableItem key={tpl.id} id={tpl.id}>
                    <Card className="p-4 hover:bg-muted/30 transition-colors h-full relative flex-1 min-w-0">
                      <button
                        onClick={() => handleOpenExisting(tpl)}
                        className="text-left w-full"
                      >
                        <div className="flex items-start justify-between gap-3 pr-8">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <ListChecks className="h-4 w-4 text-primary shrink-0" />
                              <h3 className="text-sm font-semibold text-foreground truncate">{tpl.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {countFor(tpl.id)} {countFor(tpl.id) === 1 ? "punkt" : "punkter"}
                            </p>
                          </div>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateTemplate.mutate(tpl);
                        }}
                        disabled={duplicateTemplate.isPending}
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label="Kopiera mall"
                        title="Kopiera mall"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </Card>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <ShiftTypeChecklistOrder />
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent
          side="right"
          className="w-full p-0 flex flex-col gap-0 sm:max-w-none md:max-w-2xl md:rounded-l-2xl"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border bg-card">
            <SheetTitle className="text-base font-semibold pr-8">Redigera mall</SheetTitle>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pr-8">
              {autoSaveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" />Sparar…</>)}
              {autoSaveState === "saved" && (<><Check className="h-3 w-3 text-primary" />Sparat</>)}
              {autoSaveState === "error" && (<span className="text-destructive">Kunde inte spara</span>)}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Namn</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Mallnamn"
                maxLength={100}
                className={nameTaken ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
              {nameTaken && (
                <p className="text-xs text-destructive">Namnet används redan av en annan mall.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Punkter</label>
              <div className="space-y-2">
                {editItems.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Inga punkter än.</p>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={editItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {editItems.map((item) => (
                        <SortableItem key={item.id} id={item.id}>
                          <Textarea
                            data-item-id={item.id}
                            value={item.text}
                            onChange={(e) => updateItemText(item.id, e.target.value)}
                            placeholder="Punkt..."
                            rows={1}
                            className="min-h-[40px] resize-none overflow-hidden py-2"
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = "auto";
                              el.style.height = el.scrollHeight + "px";
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = el.scrollHeight + "px";
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            className="text-destructive hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              <Button
                variant="outline"
                onClick={handleAddItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ny punkt
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Lägg till automatiskt på passtyper</label>
              <p className="text-[11px] text-muted-foreground">
                Mallen läggs till automatiskt när ett nytt pass av vald typ schemaläggs. Kan tas bort på enskilt pass vid behov.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {SHIFT_TYPE_OPTIONS.map((opt) => {
                  const checked = editShiftTypes.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition ${
                        checked ? `${opt.bg} ${opt.border}` : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setEditShiftTypes((prev) =>
                            v === true ? [...prev, opt.value] : prev.filter((s) => s !== opt.value),
                          );
                        }}
                      />
                      <span className="text-base leading-none">{opt.emoji}</span>
                      <span className={`text-sm ${checked ? opt.text : "text-foreground"}`}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer — sticky */}
          <div className="flex-shrink-0 flex gap-2 p-4 border-t border-border bg-card">
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => deleteTemplate.mutate()}
              disabled={deleteTemplate.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ta bort mall
            </Button>
            <Button
              className="flex-1"
              onClick={() => setEditing(null)}
              disabled={autoSaveState === "saving" || nameTaken}
            >
              {autoSaveState === "saving" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sparar...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Klar</>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AdminMobileBottomNav active="mer" />
    </div>
  );
};

export default AdminChecklists;

