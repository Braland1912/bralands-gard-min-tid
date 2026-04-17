import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

type ShiftType = "morning" | "day" | "evening" | "busy" | "off";

const SHIFT_CONFIG: Record<ShiftType, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  busy: { emoji: "🔒", label: "Upptagen", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  off: { emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
};

interface Props {
  userId: string;
}

const ShiftChecklistsView = ({ shiftId }: { shiftId: string }) => {
  const queryClient = useQueryClient();
  const { data: lists, isLoading } = useQuery({
    queryKey: ["home-shift-checklists", shiftId],
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

  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("shift_checklist_items")
        .update({ is_checked: checked })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-shift-checklists", shiftId] });
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (!lists || lists.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      {lists.map((list) => {
        const total = list.items.length;
        const done = list.items.filter((i) => i.is_checked).length;
        return (
          <div key={list.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{list.name}</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {done}/{total} klara
              </span>
            </div>
            <ul className="space-y-1">
              {list.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`it-${item.id}`}
                    checked={item.is_checked}
                    onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: v === true })}
                  />
                  <label
                    htmlFor={`it-${item.id}`}
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
          </div>
        );
      })}
    </div>
  );
};

const TodayScheduleChips = ({ userId }: Props) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["today-schedule", userId, today],
    queryFn: async () => {
      const [schedulesRes, dayRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .order("shift_index", { ascending: true }),
        supabase
          .from("schedule_days")
          .select("is_published")
          .eq("date", today)
          .maybeSingle(),
      ]);
      if (schedulesRes.error) throw schedulesRes.error;
      if (dayRes.error) throw dayRes.error;
      const shifts = schedulesRes.data || [];
      let counts: Record<string, number> = {};
      if (shifts.length > 0) {
        const { data: cls } = await supabase
          .from("shift_checklists")
          .select("id, shift_id")
          .in("shift_id", shifts.map((s) => s.id));
        counts = (cls || []).reduce((acc: Record<string, number>, c) => {
          acc[c.shift_id] = (acc[c.shift_id] || 0) + 1;
          return acc;
        }, {});
      }
      return {
        shifts,
        published: dayRes.data?.is_published === true,
        counts,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) return <Skeleton className="h-14 w-full rounded-xl" />;
  if (!data || !data.published || data.shifts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
        Ditt schema idag
      </p>
      <div className="grid grid-cols-2 gap-2">
        {data.shifts.map((s: any) => {
          const cfg = SHIFT_CONFIG[s.shift_type as ShiftType];
          if (!cfg) return null;
          const hasLists = (data.counts[s.id] || 0) > 0;
          const isOpen = openShiftId === s.id;
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => {
                if (!hasLists) return;
                setOpenShiftId(isOpen ? null : s.id);
              }}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center py-2 px-1 relative transition ${
                data.shifts.length === 1 ? "col-span-2" : ""
              } ${hasLists ? "cursor-pointer hover:brightness-95" : "cursor-default"} ${
                isOpen ? "ring-2 ring-primary/40" : ""
              }`}
            >
              <span className="text-base leading-none">{cfg.emoji}</span>
              <span className={`font-semibold mt-0.5 ${cfg.text} text-xs`}>{cfg.label}</span>
              {hasLists && (
                <span className="absolute top-1 right-1.5 text-[10px]">📋</span>
              )}
            </button>
          );
        })}
      </div>
      {openShiftId && <ShiftChecklistsView shiftId={openShiftId} />}
      <Link
        to="/my-schedule"
        className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Se hela veckan
      </Link>
    </div>
  );
};

export default TodayScheduleChips;
