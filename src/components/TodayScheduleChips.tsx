import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, Minus, StickyNote } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useSyncLodgeChecklists } from "@/hooks/useSyncLodgeChecklists";
import LodgeDaySection from "@/components/LodgeDaySection";
import { sortShiftsByType } from "@/lib/shift-order";
import ShiftChecklistViewer from "@/components/ShiftChecklistViewer";


type ShiftType = "morning" | "day" | "evening" | "evening_a" | "evening_b" | "busy" | "off" | "fishing" | "clearing";

const SHIFT_CONFIG: Record<ShiftType, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening_a: { emoji: "🌙", label: "Kväll A", bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  evening_b: { emoji: "🌙", label: "Kväll B", bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
  busy: { emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  fishing: { emoji: "🎣", label: "Guidning", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  clearing: { emoji: "🚜", label: "Gården", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  off: { emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
};

interface Props {
  userId: string;
}

const ShiftLodgeWrapper = ({ shiftId, shiftType, date }: { shiftId: string; shiftType: string; date: string }) => {
  useSyncLodgeChecklists(shiftId, shiftType, date, true);
  return <LodgeDaySection date={date} />;
};

const ShiftChecklistsView = ({ shiftId }: { shiftId: string }) => {
  return <ShiftChecklistViewer shiftId={shiftId} />;
};



const TodayScheduleChips = ({ userId }: Props) => {
  const today = format(new Date(), "yyyy-MM-dd");

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
      const shifts = sortShiftsByType(schedulesRes.data || []);
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

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const multipleShifts = (data?.shifts.length ?? 0) > 1;

  // Default: collapse all but the last shift when there are 2+
  useEffect(() => {
    if (!data || data.shifts.length < 2) return;
    setCollapsed((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      data.shifts.forEach((s: any) => {
        next[s.id] = true;
      });
      return next;
    });
  }, [data]);

  if (isLoading) return <Skeleton className="h-14 w-full rounded-xl" />;
  if (!data || !data.published || data.shifts.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
        Mitt schema idag
      </p>
      <div className="space-y-3">
        {data.shifts.map((s: any) => {
          const cfg = SHIFT_CONFIG[s.shift_type as ShiftType];
          if (!cfg) return null;
          const hasLists = (data.counts?.[s.id] || 0) > 0;
          const isCollapsed = !!collapsed[s.id];
          const canToggle = multipleShifts && hasLists;
          return (
            <div key={s.id} className="space-y-2">
              {canToggle ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [s.id]: !p[s.id] }))
                  }
                  className={`w-full rounded-xl border ${cfg.border} ${cfg.bg} flex items-center justify-center gap-2 py-2 px-3 transition-opacity hover:opacity-90`}
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-sm leading-none">{cfg.emoji}</span>
                  <span className={`font-semibold ${cfg.text} text-sm`}>{cfg.label}</span>
                  {isCollapsed ? (
                    <Plus className={`h-4 w-4 ${cfg.text}`} />
                  ) : (
                    <Minus className={`h-4 w-4 ${cfg.text}`} />
                  )}
                </button>
              ) : (
                <div
                  className={`rounded-xl border ${cfg.border} ${cfg.bg} flex items-center justify-center gap-2 py-2 px-3`}
                >
                  <span className="text-sm leading-none">{cfg.emoji}</span>
                  <span className={`font-semibold ${cfg.text} text-sm`}>{cfg.label}</span>
                </div>
              )}
              {s.note && s.note.trim().length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <StickyNote className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      Notering till dig
                    </p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">{s.note}</p>
                  </div>
                </div>
              )}
              {!isCollapsed && (s.shift_type === "morning" || s.shift_type === "day") && (
                <ShiftLodgeWrapper shiftId={s.id} shiftType={s.shift_type} date={today} />
              )}
              {hasLists && !isCollapsed && <ShiftChecklistsView shiftId={s.id} />}
            </div>
          );
        })}
      </div>
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
