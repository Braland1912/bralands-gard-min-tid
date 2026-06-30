import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ArrowLeft, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ShiftChecklistViewer from "@/components/ShiftChecklistViewer";
import LodgeDaySection from "@/components/LodgeDaySection";
import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";
import { useSyncLodgeChecklists } from "@/hooks/useSyncLodgeChecklists";
import { sortShiftsByType } from "@/lib/shift-order";

const SHIFT_LABEL: Record<string, string> = {
  morning: "Morgonpass",
  day: "Dagpass",
  evening: "Kvällspass",
  fishing: "Guidning",
  clearing: "Gården",
};

const ShiftLodgeWrapper = ({
  shiftId,
  shiftType,
  date,
}: {
  shiftId: string;
  shiftType: string;
  date: string;
}) => {
  useSyncLodgeChecklists(shiftId, shiftType, date, true);
  return <LodgeDaySection date={date} />;
};

const TodayTasks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["today-tasks", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return { shifts: [], published: false };
      const [schedulesRes, dayRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("id, shift_type, shift_index, note")
          .eq("user_id", user.id)
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
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Tillbaka">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" /> Dagens uppgifter
            </h1>
            <p className="text-xs text-muted-foreground capitalize">
              {format(new Date(), "EEEE d MMMM", { locale: sv })}
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !data?.published || data.shifts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Inga pass schemalagda idag.
          </div>
        ) : (
          <div className="space-y-6">
            {data.shifts.map((s: any) => (
              <section key={s.id} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {SHIFT_LABEL[s.shift_type] ?? s.shift_type}
                </h2>
                {(s.shift_type === "morning" || s.shift_type === "day") && (
                  <ShiftLodgeWrapper shiftId={s.id} shiftType={s.shift_type} date={today} />
                )}
                <ShiftChecklistViewer shiftId={s.id} />
              </section>
            ))}
          </div>
        )}
      </div>
      <MemberMobileBottomNav active="dagens-uppgifter" />
    </div>
  );
};

export default TodayTasks;
