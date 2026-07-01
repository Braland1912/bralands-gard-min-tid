import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StickyNote, ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { useGroupOrder, sortGroups } from "@/hooks/useGroupOrder";

interface Props {
  shiftId: string;
}

const ShiftChecklistViewer = ({ shiftId }: Props) => {
  const queryClient = useQueryClient();
  const [openLists, setOpenLists] = useState<Record<string, boolean>>({});
  const [openListDesc, setOpenListDesc] = useState<Record<string, boolean>>({});
  const [openItemDesc, setOpenItemDesc] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) =>
    setOpenLists((p) => ({ ...p, [id]: !p[id] }));
  const toggleGroup = (key: string) =>
    setOpenGroups((p) => ({ ...p, [key]: !p[key] }));
  const { data: lists, isLoading } = useQuery({
    queryKey: ["shift-checklists-viewer", shiftId],
    queryFn: async () => {
      const { data: cls, error } = await supabase
        .from("shift_checklists")
        .select("id, name, sort_order, description, group_name, group_color")
        .eq("shift_id", shiftId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      if (!cls || cls.length === 0) return [];
      const { data: items, error: e2 } = await supabase
        .from("shift_checklist_items")
        .select("id, shift_checklist_id, text, is_checked, sort_order, description")
        .in("shift_checklist_id", cls.map((c) => c.id))
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      return cls.map((c: any) => ({
        ...c,
        items: (items || []).filter((i) => i.shift_checklist_id === c.id),
      }));
    },
  });

  const { data: groupOrder } = useGroupOrder();

  // Gruppera i visningsordning efter group_name (null → "Övrigt")
  const grouped = (() => {
    const out: Array<{ key: string; name: string | null; color: string | null; lists: any[] }> = [];
    const idx = new Map<string, number>();
    for (const l of (lists ?? []) as any[]) {
      const key = l.group_name ?? "__none__";
      if (!idx.has(key)) {
        idx.set(key, out.length);
        out.push({ key, name: l.group_name ?? null, color: l.group_color ?? null, lists: [] });
      }
      out[idx.get(key)!].lists.push(l);
    }
    return sortGroups(out, groupOrder);
  })();

  // Hämta passets datum + ev. notering från admin
  const { data: shiftMeta } = useQuery({
    queryKey: ["shift-meta", shiftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("date, note")
        .eq("id", shiftId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      id,
      checked,
      shiftChecklistId,
    }: {
      id: string;
      checked: boolean;
      shiftChecklistId: string;
    }) => {
      const { error } = await supabase
        .from("shift_checklist_items")
        .update({ is_checked: checked })
        .eq("id", id);
      if (error) throw error;

      // Logga avbockning per pass/datum/arbetare så historik bevaras
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      const shiftDate = shiftMeta?.date;
      if (userId && shiftDate) {
        await supabase.from("shift_checklist_completion_log").insert({
          checklist_item_id: id,
          shift_checklist_id: shiftChecklistId,
          shift_id: shiftId,
          shift_date: shiftDate,
          worker_user_id: userId,
          is_checked: checked,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklists-viewer", shiftId] });
      queryClient.invalidateQueries({ queryKey: ["home-shift-checklists", shiftId] });
    },
  });

  const note = shiftMeta?.note?.trim();
  const NoteBanner = note ? (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <StickyNote className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Notering till dig
        </p>
        <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">{note}</p>
      </div>
    </div>
  ) : null;

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (!lists || lists.length === 0)
    return (
      <div className="space-y-3">
        {NoteBanner}
        <p className="text-sm text-muted-foreground italic">Inga checklistor</p>
      </div>
    );

  return (
    <div className="space-y-5">
      {NoteBanner}
      {grouped.map((g) => (
        <div key={g.key} className="space-y-2">
          {g.name && (
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: g.color ?? "hsl(var(--muted-foreground))" }}
                aria-hidden
              />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.name}
              </h3>
            </div>
          )}
          <div className="space-y-3">
            {g.lists.map((list: any) => {
        const total = list.items.length;
        const done = list.items.filter((i: any) => i.is_checked).length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        const open = !!openLists[list.id];
        const descOpen = !!openListDesc[list.id];
        return (
          <div
            key={list.id}
            className="space-y-2 rounded-xl border bg-muted/30 p-3"
            style={g.color ? { borderLeft: `3px solid ${g.color}` } : undefined}
          >
            <div className="space-y-1.5 w-full">
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => toggleOpen(list.id)}
                  aria-expanded={open}
                  className="flex items-start gap-2 flex-1 min-w-0 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                  <p className="text-sm font-semibold text-foreground flex-1 min-w-0 break-words">{list.name}</p>
                </button>
                {list.description && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                    onClick={() =>
                      setOpenListDesc((p) => ({ ...p, [list.id]: !p[list.id] }))
                    }
                    aria-label="Visa beskrivning"
                    title="Visa beskrivning"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Progress
                  value={pct}
                  className={`h-1.5 flex-1 transition-colors ${pct === 100 ? "[&>div]:bg-emerald-500" : ""}`}
                />
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {done}/{total}
                </span>
              </div>
            </div>
            {descOpen && list.description && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                {list.description}
              </p>
            )}
            {open && (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
                {list.items.map((item: any) => {
                  const itemDescOpen = !!openItemDesc[item.id];
                  return (
                    <li
                      key={item.id}
                      className={`px-3 py-2.5 transition-colors ${
                        item.is_checked ? "bg-muted/30" : "bg-background hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`vw-${item.id}`}
                          className="mt-0.5"
                          checked={item.is_checked}
                          onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: v === true, shiftChecklistId: list.id })}
                        />
                        <label
                          htmlFor={`vw-${item.id}`}
                          className={`flex-1 text-sm leading-snug cursor-pointer ${
                            item.is_checked ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {item.text}
                        </label>
                        {item.description && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0 -mr-1"
                            onClick={() =>
                              setOpenItemDesc((p) => ({
                                ...p,
                                [item.id]: !p[item.id],
                              }))
                            }
                            aria-label="Mer info"
                            title="Mer info"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {itemDescOpen && item.description && (
                        <p className="mt-1.5 ml-7 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </li>
                  );
                })}
                {total === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground italic">Inga punkter</li>
                )}
              </ul>
            )}
          </div>
        );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShiftChecklistViewer;
