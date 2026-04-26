import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, Wand2, X, Plus, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";

const SHIFT_TYPES: { value: string; label: string; emoji: string; bg: string; border: string; text: string }[] = [
  { value: "morning", label: "Morgon", emoji: "🌅", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  { value: "day", label: "Dag", emoji: "☀️", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { value: "evening", label: "Kväll", emoji: "🌙", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  { value: "fishing", label: "Fiske", emoji: "🎣", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { value: "clearing", label: "Röja", emoji: "🌲", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
];

type Link = { id: string; template_id: string; shift_type: string; sort_order: number };
type Template = { id: string; name: string };

const ShiftTypeChecklistOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: ["checklist-template-shift-types-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_shift_types")
        .select("id, template_id, shift_type, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Link[];
    },
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_templates").select("id, name");
      if (error) throw error;
      return data as Template[];
    },
  });

  // Local order state per shift type, synced from server
  const [orders, setOrders] = useState<Record<string, Link[]>>({});

  useEffect(() => {
    const grouped: Record<string, Link[]> = {};
    SHIFT_TYPES.forEach((s) => {
      grouped[s.value] = links
        .filter((l) => l.shift_type === s.value)
        .sort((a, b) => a.sort_order - b.sort_order);
    });
    setOrders(grouped);
  }, [links]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: async ({ orderedIds }: { shiftType: string; orderedIds: string[] }) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("checklist_template_shift_types")
          .update({ sort_order: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
    },
    onError: () => toast({ title: "Kunde inte spara ordning", variant: "destructive" }),
  });

  const handleDragEnd = (shiftType: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = orders[shiftType] ?? [];
    const oldIdx = list.findIndex((l) => l.id === active.id);
    const newIdx = list.findIndex((l) => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(list, oldIdx, newIdx);
    setOrders((prev) => ({ ...prev, [shiftType]: next }));
    reorder.mutate({ shiftType, orderedIds: next.map((l) => l.id) });
  };

  const removeLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("checklist_template_shift_types")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      toast({ title: "Koppling borttagen" });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      toast({
        title: "Kunde inte ta bort",
        description: "Listan har uppdaterats med senaste tillståndet.",
        variant: "destructive",
      });
    },
  });

  const addLink = useMutation({
    mutationFn: async ({ shiftType, templateId }: { shiftType: string; templateId: string }) => {
      // Refetch live state to avoid race with other admins
      const { data: fresh, error: fetchErr } = await supabase
        .from("checklist_template_shift_types")
        .select("id, template_id, sort_order")
        .eq("shift_type", shiftType);
      if (fetchErr) throw fetchErr;
      if ((fresh ?? []).some((l) => l.template_id === templateId)) {
        throw new Error("ALREADY_LINKED");
      }
      const nextSort = (fresh ?? []).length;
      const { error } = await supabase
        .from("checklist_template_shift_types")
        .insert({ shift_type: shiftType, template_id: templateId, sort_order: nextSort });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      toast({ title: "Mall kopplad" });
    },
    onError: (err: any) => {
      // Always refetch on failure so the UI immediately reflects server state
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      const isDup = err?.message === "ALREADY_LINKED" || err?.code === "23505";
      toast({
        title: isDup ? "Redan kopplad" : "Kunde inte koppla",
        description: isDup
          ? "Den här mallen är redan kopplad till passtypen."
          : "Listan har uppdaterats med senaste tillståndet.",
        variant: "destructive",
      });
    },
  });
  const applyRetroactive = useMutation({
    mutationFn: async () => {
      const usedShiftTypes = Array.from(new Set(links.map((l) => l.shift_type)));
      if (usedShiftTypes.length === 0) return { added: 0, scanned: 0 };

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { data: shifts, error: sErr } = await supabase
        .from("schedules")
        .select("id, shift_type, date")
        .gte("date", todayStr)
        .in("shift_type", usedShiftTypes);
      if (sErr) throw sErr;
      if (!shifts || shifts.length === 0) return { added: 0, scanned: 0 };

      const shiftIds = shifts.map((s: any) => s.id);
      const { data: existingLists } = await supabase
        .from("shift_checklists")
        .select("shift_id, name")
        .in("shift_id", shiftIds);
      const existingByShift = new Map<string, Set<string>>();
      (existingLists ?? []).forEach((r: any) => {
        if (!existingByShift.has(r.shift_id)) existingByShift.set(r.shift_id, new Set());
        existingByShift.get(r.shift_id)!.add(r.name);
      });

      const allTemplateIds = Array.from(new Set(links.map((l) => l.template_id)));
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("template_id, text, sort_order")
        .in("template_id", allTemplateIds)
        .order("sort_order", { ascending: true });

      let added = 0;
      const linksByType: Record<string, Link[]> = {};
      usedShiftTypes.forEach((st) => {
        linksByType[st] = links
          .filter((l) => l.shift_type === st)
          .sort((a, b) => a.sort_order - b.sort_order);
      });

      for (const shift of shifts as any[]) {
        const ordered = linksByType[shift.shift_type] ?? [];
        for (let i = 0; i < ordered.length; i++) {
          const tplId = ordered[i].template_id;
          const tpl = templates.find((t) => t.id === tplId);
          if (!tpl) continue;
          const existing = existingByShift.get(shift.id);
          if (existing && existing.has(tpl.name)) continue;

          const { data: newList, error: clErr } = await supabase
            .from("shift_checklists")
            .insert({ shift_id: shift.id, name: tpl.name, sort_order: i })
            .select("id")
            .single();
          if (clErr || !newList) continue;
          added++;

          const tplItems = (items ?? []).filter((it: any) => it.template_id === tplId);
          if (tplItems.length > 0) {
            await supabase.from("shift_checklist_items").insert(
              tplItems.map((it: any, idx: number) => ({
                shift_checklist_id: newList.id,
                text: it.text,
                sort_order: idx,
              })),
            );
          }
        }
      }

      return { added, scanned: shifts.length };
    },
    onSuccess: ({ added, scanned }) => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklists-viewer"] });
      toast({
        title: "Klart",
        description:
          added === 0
            ? `Inga nya checklistor behövdes (${scanned} pass kontrollerade).`
            : `${added} checklist${added === 1 ? "a" : "or"} tillagda på ${scanned} pass.`,
      });
    },
    onError: () => toast({ title: "Kunde inte applicera", variant: "destructive" }),
  });

  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? "Okänd mall";

  if (linksLoading || tplLoading) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Kopplingar per passtyp</h2>
          <p className="text-[11px] text-muted-foreground">
            Dra för att ändra ordningen som checklistorna läggs till på nya pass.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0" disabled={applyRetroactive.isPending}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              {applyRetroactive.isPending ? "Applicerar..." : "Applicera retroaktivt"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applicera kopplade mallar på befintliga pass?</AlertDialogTitle>
              <AlertDialogDescription>
                Alla kopplade checklistor läggs till på framtida pass (från och med idag) av matchande passtyp. Befintliga checklistor med samma namn hoppas över så inget dubbleras. Tidigare borttagna checklistor kommer tillbaka.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={() => applyRetroactive.mutate()}>Applicera</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="space-y-3">
        {SHIFT_TYPES.map((st) => {
          const list = orders[st.value] ?? [];
          const linkedTemplateIds = new Set(list.map((l) => l.template_id));
          const available = templates.filter((t) => !linkedTemplateIds.has(t.id));
          return (
            <div key={st.value} className={`rounded-lg border ${st.border} ${st.bg} p-3`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className={`text-xs font-semibold flex items-center gap-1.5 ${st.text}`}>
                  <span className="text-sm leading-none">{st.emoji}</span>
                  {st.label}
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-foreground/80 hover:bg-background/70"
                      disabled={available.length === 0 || addLink.isPending}
                      title={available.length === 0 ? "Alla mallar är redan kopplade" : "Lägg till mall"}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Lägg till
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    {available.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Alla mallar är redan kopplade.</p>
                    ) : (
                      <div className="space-y-0.5 max-h-64 overflow-y-auto">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
                          Välj mall
                        </p>
                        {available.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => addLink.mutate({ shiftType: st.value, templateId: t.id })}
                            className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              {list.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Inga kopplade mallar</p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(st.value)}
                >
                  <SortableContext
                    items={list.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {list.map((l) => (
                        <SortableItem key={l.id} id={l.id}>
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 flex-1 min-w-0">
                            <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-sm text-foreground truncate flex-1">
                              {nameOf(l.template_id)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLink.mutate(l.id);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              disabled={removeLink.isPending}
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              aria-label="Ta bort koppling"
                              title="Ta bort koppling"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default ShiftTypeChecklistOrder;
