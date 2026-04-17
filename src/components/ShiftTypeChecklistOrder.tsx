import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks } from "lucide-react";
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

const SHIFT_TYPES: { value: string; label: string }[] = [
  { value: "morning", label: "Morgon" },
  { value: "day", label: "Dag" },
  { value: "evening", label: "Kväll" },
  { value: "busy", label: "Ej tillg." },
  { value: "fishing", label: "Fiske" },
  { value: "clearing", label: "Röja" },
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

  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? "Okänd mall";

  if (linksLoading || tplLoading) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Kopplingar per passtyp</h2>
        <p className="text-[11px] text-muted-foreground">
          Dra för att ändra ordningen som checklistorna läggs till på nya pass.
        </p>
      </div>
      <div className="space-y-3">
        {SHIFT_TYPES.map((st) => {
          const list = orders[st.value] ?? [];
          return (
            <div key={st.value} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">{st.label}</p>
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
                            <span className="text-sm text-foreground truncate">
                              {nameOf(l.template_id)}
                            </span>
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
