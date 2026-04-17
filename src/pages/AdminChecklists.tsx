import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ListChecks, Pencil, Copy } from "lucide-react";
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

type Template = { id: string; name: string; sort_order: number };
type Item = { id: string; template_id: string; text: string; sort_order: number };
type ShiftLink = { template_id: string; shift_type: string };

const SHIFT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "morning", label: "Morgon" },
  { value: "day", label: "Dag" },
  { value: "evening", label: "Kväll" },
  { value: "busy", label: "Ej tillg." },
  { value: "fishing", label: "Fiske" },
  { value: "clearing", label: "Röja" },
];

const AdminChecklists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [editShiftTypes, setEditShiftTypes] = useState<string[]>([]);
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
    setEditing(tpl);
    setEditName(tpl.name);
    setEditItems(items);
    setEditShiftTypes(shiftTypes);
    setNewItemText("");
  };

  const handleOpenExisting = (tpl: Template) => {
    const items = allItems.filter((i) => i.template_id === tpl.id);
    openEdit(tpl, items, shiftTypesFor(tpl.id));
  };

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    setEditItems((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}-${Math.random()}`, template_id: editing!.id, text, sort_order: prev.length },
    ]);
    setNewItemText("");
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

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const name = editName.trim() || "Namnlös mall";
      const { error: nameErr } = await supabase
        .from("checklist_templates")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (nameErr) throw nameErr;

      // Replace all items: delete + insert
      const { error: delErr } = await supabase
        .from("checklist_template_items")
        .delete()
        .eq("template_id", editing.id);
      if (delErr) throw delErr;

      const filtered = editItems.map((i, idx) => ({ text: i.text.trim(), sort_order: idx, template_id: editing.id }))
        .filter((i) => i.text.length > 0);

      if (filtered.length > 0) {
        const { error: insErr } = await supabase.from("checklist_template_items").insert(filtered);
        if (insErr) throw insErr;
      }

      // Sync shift type links
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      setEditing(null);
      toast({ title: "Mall sparad" });
    },
    onError: () => toast({ title: "Kunde inte spara", variant: "destructive" }),
  });

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

        <ShiftTypeChecklistOrder />

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
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera mall</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Namn</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Mallnamn" />
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
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setEditShiftTypes((prev) =>
                            v === true ? [...prev, opt.value] : prev.filter((s) => s !== opt.value),
                          );
                        }}
                      />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
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
                          <Input
                            value={item.text}
                            onChange={(e) => updateItemText(item.id, e.target.value)}
                            placeholder="Punkt..."
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

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  placeholder="Lägg till ny punkt..."
                />
                <Button variant="outline" onClick={handleAddItem} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Lägg till
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => deleteTemplate.mutate()}
              disabled={deleteTemplate.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort mall
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Avbryt</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>
              {saveTemplate.isPending ? "Sparar..." : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminMobileBottomNav active="mer" />
    </div>
  );
};

export default AdminChecklists;
