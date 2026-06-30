import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { ChevronDown, ListChecks, Plus, X, Wand2, Home, RefreshCw } from "lucide-react";
import { UNIT_NUMBER, styleFor, LODGE_UNITS } from "@/lib/lodge-calendar";

type Group = { id: string; name: string; color: string; sort_order: number; lodge_unit: string | null };
type GroupShiftLink = { id: string; group_id: string; shift_type: string; sort_order: number };
type Template = { id: string; name: string; group_id: string | null; sort_order: number; description: string | null; lodge_unit: string | null };
type Item = { id: string; template_id: string; text: string; sort_order: number; description: string | null };

const SHIFT_TYPES: { value: string; label: string; emoji: string; bg: string; border: string; text: string; ring: string }[] = [
  { value: "morning", label: "Morgon", emoji: "🌅", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700", ring: "ring-orange-200" },
  { value: "day", label: "Dag", emoji: "☀️", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", ring: "ring-blue-200" },
  { value: "evening", label: "Kväll", emoji: "🌙", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", ring: "ring-purple-200" },
  { value: "fishing", label: "Guidning", emoji: "🎣", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700", ring: "ring-cyan-200" },
  { value: "clearing", label: "Gården", emoji: "🚜", bg: "bg-green-50", border: "border-green-300", text: "text-green-700", ring: "ring-green-200" },
];

const ChecklistPreview = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: groups = [], isLoading: gL } = useQuery({
    queryKey: ["checklist-template-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_groups" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Group[];
    },
  });

  const { data: shiftLinks = [], isLoading: sL } = useQuery({
    queryKey: ["checklist-group-shift-types-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_group_shift_types" as any)
        .select("id, group_id, shift_type, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GroupShiftLink[];
    },
  });

  const { data: templates = [], isLoading: tL } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Template[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["checklist-template-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderShift = useMutation({
    mutationFn: async ({ shiftType, orderedLinkIds }: { shiftType: string; orderedLinkIds: string[] }) => {
      const offset = 1_000_000;
      for (let i = 0; i < orderedLinkIds.length; i++) {
        await supabase.from("checklist_group_shift_types" as any).update({ sort_order: offset + i }).eq("id", orderedLinkIds[i]);
      }
      for (let i = 0; i < orderedLinkIds.length; i++) {
        await supabase.from("checklist_group_shift_types" as any).update({ sort_order: i }).eq("id", orderedLinkIds[i]);
      }
    },
    onMutate: async ({ shiftType, orderedLinkIds }) => {
      await qc.cancelQueries({ queryKey: ["checklist-group-shift-types-full"] });
      const prev = qc.getQueryData<GroupShiftLink[]>(["checklist-group-shift-types-full"]);
      if (prev) {
        const others = prev.filter((l) => l.shift_type !== shiftType);
        const byId = new Map(prev.filter((l) => l.shift_type === shiftType).map((l) => [l.id, l]));
        const next = orderedLinkIds
          .map((id, i) => {
            const l = byId.get(id);
            return l ? { ...l, sort_order: i } : null;
          })
          .filter(Boolean) as GroupShiftLink[];
        qc.setQueryData(["checklist-group-shift-types-full"], [...others, ...next]);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["checklist-group-shift-types-full"], ctx.prev);
      toast({ title: "Kunde inte ändra ordning", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types-full"] });
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types"] });
    },
  });

  const addToShift = useMutation({
    mutationFn: async ({ shiftType, groupId }: { shiftType: string; groupId: string }) => {
      const existing = shiftLinks.filter((l) => l.shift_type === shiftType);
      const nextSort = existing.length;
      const { error } = await supabase
        .from("checklist_group_shift_types" as any)
        .insert({ group_id: groupId, shift_type: shiftType, sort_order: nextSort });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types-full"] });
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types"] });
      toast({ title: "Grupp tillagd" });
    },
    onError: () => toast({ title: "Kunde inte lägga till", variant: "destructive" }),
  });

  const removeFromShift = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("checklist_group_shift_types" as any).delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types-full"] });
      qc.invalidateQueries({ queryKey: ["checklist-group-shift-types"] });
      toast({ title: "Grupp borttagen från passtypen" });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  const setLodgeUnit = useMutation({
    mutationFn: async ({ groupId, unit }: { groupId: string; unit: string | null }) => {
      const { error } = await supabase
        .from("checklist_template_groups" as any)
        .update({ lodge_unit: unit })
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-template-groups"] });
      toast({ title: "Lodge-koppling uppdaterad" });
    },
    onError: () => toast({ title: "Kunde inte uppdatera", variant: "destructive" }),
  });

  // Retroactive: applicera grupp→passtyp på framtida pass
  const applyRetroactive = useMutation({
    mutationFn: async () => {
      const usedShiftTypes = Array.from(new Set(shiftLinks.map((l) => l.shift_type)));
      if (usedShiftTypes.length === 0) return { added: 0, scanned: 0 };

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { data: shifts } = await supabase
        .from("schedules")
        .select("id, shift_type, date")
        .gte("date", todayStr)
        .in("shift_type", usedShiftTypes);
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

      // Bygg ordnad mall-lista per shift_type
      const orderedTplsByShift: Record<string, Template[]> = {};
      for (const st of usedShiftTypes) {
        const linksForShift = shiftLinks
          .filter((l) => l.shift_type === st)
          .sort((a, b) => a.sort_order - b.sort_order);
        const list: Template[] = [];
        for (const gl of linksForShift) {
          const tplsInGroup = templates
            .filter((t) => t.group_id === gl.group_id)
            .sort((a, b) => a.sort_order - b.sort_order);
          list.push(...tplsInGroup);
        }
        orderedTplsByShift[st] = list;
      }

      let added = 0;
      for (const shift of shifts as any[]) {
        const ordered = orderedTplsByShift[shift.shift_type] ?? [];
        for (let i = 0; i < ordered.length; i++) {
          const tpl = ordered[i];
          const existing = existingByShift.get(shift.id);
          if (existing && existing.has(tpl.name)) continue;

          const grp = groups.find((g) => g.id === tpl.group_id) ?? null;
          const { data: newList, error: clErr } = await supabase
            .from("shift_checklists")
            .insert({
              shift_id: shift.id,
              name: tpl.name,
              sort_order: i,
              description: tpl.description ?? null,
              group_name: grp?.name ?? null,
              group_color: grp?.color ?? null,
            } as any)
            .select("id")
            .single();
          if (clErr || !newList) continue;
          added++;

          const tplItems = items.filter((it) => it.template_id === tpl.id);
          if (tplItems.length > 0) {
            await supabase.from("shift_checklist_items").insert(
              tplItems.map((it, idx) => ({
                shift_checklist_id: newList.id,
                text: it.text,
                sort_order: idx,
                description: it.description ?? null,
              })),
            );
          }
        }
      }
      return { added, scanned: shifts.length };
    },
    onSuccess: ({ added, scanned }) => {
      qc.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
      qc.invalidateQueries({ queryKey: ["shift-checklists-viewer"] });
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

  const templatesByGroup = useMemo(() => {
    const m = new Map<string, Template[]>();
    for (const t of templates) {
      const gid = t.group_id;
      if (!gid) continue;
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid)!.push(t);
    }
    for (const [k, arr] of m) m.set(k, arr.sort((a, b) => a.sort_order - b.sort_order));
    return m;
  }, [templates]);

  const itemsByTemplate = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      if (!m.has(it.template_id)) m.set(it.template_id, []);
      m.get(it.template_id)!.push(it);
    }
    return m;
  }, [items]);

  if (gL || sL || tL) return <Skeleton className="h-64 rounded-xl" />;

  const renderGroupCard = (group: Group, linkId?: string, onRemove?: () => void) => {
    const tpls = templatesByGroup.get(group.id) ?? [];
    const key = `${linkId ?? group.id}`;
    const isOpen = !!expanded[key];
    return (
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${isOpen ? "" : "-rotate-90"}`}
            />
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            <span className="text-sm font-medium truncate">{group.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{tpls.length}</span>
          </button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Ta bort koppling"
              title="Ta bort koppling"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {isOpen && (
          <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-2">
            {tpls.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Inga checklistor i gruppen.</p>
            ) : (
              tpls.map((t) => {
                const its = itemsByTemplate.get(t.id) ?? [];
                return (
                  <div key={t.id} className="rounded-md border border-border bg-background px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{its.length}</span>
                    </div>
                    {its.length > 0 && (
                      <ul className="mt-1.5 ml-5 space-y-0.5 text-xs text-muted-foreground list-disc">
                        {its.map((it) => (
                          <li key={it.id}>{it.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-start gap-3">
        <div className="flex-1 text-xs text-muted-foreground leading-relaxed">
          Så här ser checklistorna ut för medarbetaren på varje passtyp och vid bytesdag i lodgen. Dra för att ändra ordningen grupperna visas i. Använd <strong>"Applicera retroaktivt"</strong> för att lägga in checklistorna på framtida pass som redan är schemalagda.
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0" disabled={applyRetroactive.isPending}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              {applyRetroactive.isPending ? "Applicerar…" : "Applicera retroaktivt"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applicera grupper på befintliga pass?</AlertDialogTitle>
              <AlertDialogDescription>
                Alla checklistor från kopplade grupper läggs till på framtida pass (från och med idag) av matchande passtyp. Checklistor med samma namn hoppas över så inget dubbleras. Tidigare borttagna checklistor kommer tillbaka.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={() => applyRetroactive.mutate()}>Applicera</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Per passtyp */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Passtyper</h3>
        <div className="space-y-3">
          {SHIFT_TYPES.map((st) => {
            const linksForShift = shiftLinks
              .filter((l) => l.shift_type === st.value)
              .sort((a, b) => a.sort_order - b.sort_order);
            const linkedGroupIds = new Set(linksForShift.map((l) => l.group_id));
            const available = groups.filter((g) => !linkedGroupIds.has(g.id));
            return (
              <Card key={st.value} className={`p-3 ${st.bg} ${st.border} border`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold flex items-center gap-1.5 ${st.text}`}>
                    <span className="text-base leading-none">{st.emoji}</span>
                    {st.label}
                  </p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-foreground/80 hover:bg-background/70"
                        disabled={available.length === 0 || addToShift.isPending}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Lägg till grupp
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                      {available.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">Alla grupper är redan kopplade.</p>
                      ) : (
                        <div className="space-y-0.5 max-h-72 overflow-y-auto">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Välj grupp</p>
                          {available.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => addToShift.mutate({ shiftType: st.value, groupId: g.id })}
                              className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                              <span className="truncate flex-1">{g.name}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {(templatesByGroup.get(g.id) ?? []).length}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                {linksForShift.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Inga grupper kopplade.</p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e: DragEndEvent) => {
                      const { active, over } = e;
                      if (!over || active.id === over.id) return;
                      const ids = linksForShift.map((l) => l.id);
                      const oldIdx = ids.indexOf(active.id as string);
                      const newIdx = ids.indexOf(over.id as string);
                      if (oldIdx === -1 || newIdx === -1) return;
                      reorderShift.mutate({ shiftType: st.value, orderedLinkIds: arrayMove(ids, oldIdx, newIdx) });
                    }}
                  >
                    <SortableContext items={linksForShift.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {linksForShift.map((link) => {
                          const grp = groups.find((g) => g.id === link.group_id);
                          if (!grp) return null;
                          return (
                            <SortableItem key={link.id} id={link.id}>
                              <div className="flex-1 min-w-0">
                                {renderGroupCard(grp, link.id, () => removeFromShift.mutate(link.id))}
                              </div>
                            </SortableItem>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Lodge-bytesdagar */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 flex items-center gap-1.5">
          <Home className="h-3 w-3" />
          Lodge-bytesdagar
        </h3>
        <p className="text-[11px] text-muted-foreground px-1 -mt-1">
          Grupper triggas på dagpass när enheten har avfärd enligt lodge-kalendern.
        </p>
        <div className="space-y-3">
          {LODGE_UNITS.map((unit) => {
            const groupsForUnit = groups.filter((g) => g.lodge_unit === unit);
            const available = groups.filter((g) => !g.lodge_unit);
            const style = styleFor(unit);
            return (
              <Card key={unit} className={`p-3 border`} style={{ borderColor: undefined }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
                    <Home className="h-3 w-3" />
                    {UNIT_NUMBER[unit] ?? ""} {unit}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={available.length === 0}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Lägg till grupp
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                      {available.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">Alla grupper utan lodge-koppling är redan kopplade någon annanstans.</p>
                      ) : (
                        <div className="space-y-0.5 max-h-72 overflow-y-auto">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Välj grupp</p>
                          {available.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setLodgeUnit.mutate({ groupId: g.id, unit })}
                              className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                              <span className="truncate flex-1">{g.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                {groupsForUnit.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Inga grupper triggar vid bytesdag.</p>
                ) : (
                  <div className="space-y-1.5">
                    {groupsForUnit.map((grp) => (
                      <div key={grp.id}>
                        {renderGroupCard(grp, `lodge-${grp.id}`, () =>
                          setLodgeUnit.mutate({ groupId: grp.id, unit: null }),
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ChecklistPreview;
