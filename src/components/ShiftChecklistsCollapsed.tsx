import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ListChecks } from "lucide-react";
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
        .select("id, name, sort_order")
        .eq("shift_id", shiftId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const listIds = (lists ?? []).map((l) => l.id);
      if (listIds.length === 0) return { lists: [], items: [] as any[] };
      const { data: items, error: itemsErr } = await supabase
        .from("shift_checklist_items")
        .select("id, shift_checklist_id, text, is_checked, sort_order")
        .in("shift_checklist_id", listIds)
        .order("sort_order", { ascending: true });
      if (itemsErr) throw itemsErr;
      return { lists: lists ?? [], items: items ?? [] };
    },
    enabled: !!shiftId,
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground italic">Laddar checklistor…</div>
    );
  }

  const lists = data?.lists ?? [];

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Checklistor
      </div>
      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Inga checklistor för detta pass.</p>
      ) : (
        <ul className="space-y-1.5">
          {lists.map((list) => {
            const listItems = (data!.items as any[]).filter((i) => i.shift_checklist_id === list.id);
            const done = listItems.filter((i) => i.is_checked).length;
            const total = listItems.length;
            return (
              <ChecklistRow
                key={list.id}
                name={list.name}
                done={done}
                total={total}
                items={listItems}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
};

const ChecklistRow = ({
  name,
  done,
  total,
  items,
}: {
  name: string;
  done: number;
  total: number;
  items: { id: string; text: string; is_checked: boolean }[];
}) => {
  const [open, setOpen] = useState(false);
  const complete = total > 0 && done === total;
  return (
    <li className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground truncate flex-1">{name}</span>
        {total > 0 && (
          <span
            className={`text-[11px] tabular-nums shrink-0 ${
              complete ? "text-[hsl(150_45%_35%)] font-semibold" : "text-muted-foreground"
            }`}
          >
            {done}/{total}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul className="px-3 pb-2 pt-1 space-y-1 border-t border-border bg-background">
          {items.length === 0 ? (
            <li className="text-xs text-muted-foreground italic py-1">Inga punkter.</li>
          ) : (
            items.map((it) => (
              <li key={it.id} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 h-3.5 w-3.5 rounded-sm border shrink-0 ${
                    it.is_checked
                      ? "bg-[hsl(150_45%_45%)] border-[hsl(150_45%_45%)]"
                      : "bg-background border-border"
                  }`}
                  aria-hidden
                />
                <span
                  className={
                    it.is_checked
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }
                >
                  {it.text}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
};

export default ShiftChecklistsCollapsed;
