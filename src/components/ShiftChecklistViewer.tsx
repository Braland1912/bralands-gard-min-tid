import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { StickyNote, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Props {
  shiftId: string;
}

const ShiftChecklistViewer = ({ shiftId }: Props) => {
  const queryClient = useQueryClient();
  const [openLists, setOpenLists] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) =>
    setOpenLists((p) => ({ ...p, [id]: !p[id] }));
  const { data: lists, isLoading } = useQuery({
    queryKey: ["shift-checklists-viewer", shiftId],
    queryFn: async () => {
      const { data: cls, error } = await supabase
        .from("shift_checklists")
        .select("id, name, sort_order")
        .eq("shift_id", shiftId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      if (!cls || cls.length === 0) return [];
      const { data: items, error: e2 } = await supabase
        .from("shift_checklist_items")
        .select("id, shift_checklist_id, text, is_checked, sort_order")
        .in("shift_checklist_id", cls.map((c) => c.id))
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      return cls.map((c) => ({
        ...c,
        items: (items || []).filter((i) => i.shift_checklist_id === c.id),
      }));
    },
  });

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
    <div className="space-y-4">
      {NoteBanner}
      {lists.map((list) => {
        const total = list.items.length;
        const done = list.items.filter((i) => i.is_checked).length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        const open = !!openLists[list.id];
        return (
          <div key={list.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <button
              type="button"
              onClick={() => toggleOpen(list.id)}
              aria-expanded={open}
              className="flex items-center gap-2 w-full text-left"
            >
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
              />
              <p className="text-sm font-semibold text-foreground flex-1 truncate">{list.name}</p>
              <Progress
                value={pct}
                className={`h-1.5 w-20 transition-colors ${pct === 100 ? "[&>div]:bg-emerald-500" : ""}`}
              />
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {done}/{total}
              </span>
            </button>
            {open && (
              <ul className="space-y-1.5 pl-6">
                {list.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`vw-${item.id}`}
                      checked={item.is_checked}
                      onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: v === true, shiftChecklistId: list.id })}
                    />
                    <label
                      htmlFor={`vw-${item.id}`}
                      className={`text-sm cursor-pointer ${item.is_checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {item.text}
                    </label>
                  </li>
                ))}
                {total === 0 && (
                  <li className="text-xs text-muted-foreground italic">Inga punkter</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ShiftChecklistViewer;
