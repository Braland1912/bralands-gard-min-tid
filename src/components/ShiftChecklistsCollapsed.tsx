import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListChecks, Info } from "lucide-react";
import { useState } from "react";

interface Props {
  shiftId: string;
}

/**
 * Visar checklistor för ett pass i kollapsat läge — bara rubriker syns,
 * användaren kan fälla ut en lista för att se punkterna.
 */
const ShiftChecklistsCollapsed = ({ shiftId }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["shift-checklists-collapsed", shiftId],
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from("shift_checklists")
        .select("id, name, sort_order, lodge_unit, description, group_name, group_color")
        .eq("shift_id", shiftId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const listIds = (lists ?? []).map((l) => l.id);
      if (listIds.length === 0) return { lists: [], items: [] as any[] };
      const { data: items, error: itemsErr } = await supabase
        .from("shift_checklist_items")
        .select("id, shift_checklist_id, text, is_checked, sort_order, description")
        .in("shift_checklist_id", listIds)
        .order("sort_order", { ascending: true });
      if (itemsErr) throw itemsErr;
      return { lists: lists ?? [], items: items ?? [] };
    },
    enabled: !!shiftId,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground italic">Laddar checklistor…</div>
    );
  }

  const lists = (data?.lists ?? []) as any[];

  // Gruppera per group_name i visningsordning
  let grouped: Array<{ key: string; name: string | null; color: string | null; lists: any[] }> = [];
  {
    const idx = new Map<string, number>();
    for (const l of lists) {
      const key = l.group_name ?? "__none__";
      if (!idx.has(key)) {
        idx.set(key, grouped.length);
        grouped.push({ key, name: l.group_name ?? null, color: l.group_color ?? null, lists: [] });
      }
      grouped[idx.get(key)!].lists.push(l);
    }
  }

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Checklistor
      </div>
      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Inga checklistor för detta pass.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-1.5">
              {g.name && (
                <div className="flex items-center gap-2 px-0.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: g.color ?? "hsl(var(--muted-foreground))" }}
                    aria-hidden
                  />
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.name}
                  </h4>
                </div>
              )}
              <ul className="space-y-1.5">
                {g.lists.map((list: any) => {
                  const listItems = (data!.items as any[]).filter((i) => i.shift_checklist_id === list.id);
                  const done = listItems.filter((i) => i.is_checked).length;
                  const total = listItems.length;
                  return (
                    <ChecklistRow
                      key={list.id}
                      name={list.name}
                      description={list.description}
                      color={g.color}
                      done={done}
                      total={total}
                      items={listItems}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChecklistRow = ({
  name,
  description,
  color,
  done,
  total,
  items,
}: {
  name: string;
  description?: string | null;
  color?: string | null;
  done: number;
  total: number;
  items: { id: string; text: string; is_checked: boolean; description?: string | null }[];
}) => {
  const [open, setOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [openItemDesc, setOpenItemDesc] = useState<Record<string, boolean>>({});
  const complete = total > 0 && done === total;
  return (
    <li
      className="rounded-lg border bg-muted/20 overflow-hidden"
      style={color ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">{name}</span>
        </button>
        {description && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setDescOpen((o) => !o);
            }}
            aria-label="Visa beskrivning"
            title="Visa beskrivning"
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        )}
        {total > 0 && (
          <span
            className={`text-[11px] tabular-nums shrink-0 ${
              complete ? "text-[hsl(150_45%_35%)] font-semibold" : "text-muted-foreground"
            }`}
          >
            {done}/{total}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Dölj" : "Visa"}
          className="shrink-0"
        >
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {descOpen && description && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}
      {open && (
        <ul className="divide-y divide-border/60 border-t border-border bg-background">
          {items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground italic">Inga punkter.</li>
          ) : (
            items.map((it) => {
              const itemDescOpen = !!openItemDesc[it.id];
              return (
                <li key={it.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 h-3.5 w-3.5 rounded-sm border shrink-0 ${
                        it.is_checked
                          ? "bg-[hsl(150_45%_45%)] border-[hsl(150_45%_45%)]"
                          : "bg-background border-border"
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`flex-1 text-sm leading-snug ${
                        it.is_checked
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {it.text}
                    </span>
                    {it.description && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0 -mr-1"
                        onClick={() =>
                          setOpenItemDesc((p) => ({ ...p, [it.id]: !p[it.id] }))
                        }
                        aria-label="Mer info"
                        title="Mer info"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {itemDescOpen && it.description && (
                    <p className="mt-1.5 ml-5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                      {it.description}
                    </p>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </li>
  );
};

export default ShiftChecklistsCollapsed;
