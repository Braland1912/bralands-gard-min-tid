import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

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
      return {
        shifts: schedulesRes.data || [],
        published: dayRes.data?.is_published === true,
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
          return (
            <div
              key={s.id}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center py-2 px-1 ${
                data.shifts.length === 1 ? "col-span-2" : ""
              }`}
            >
              <span className="text-base leading-none">{cfg.emoji}</span>
              <span className={`font-semibold mt-0.5 ${cfg.text} text-xs`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayScheduleChips;
