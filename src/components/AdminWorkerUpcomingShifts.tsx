import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, getISOWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { Plus, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import ShiftChecklistViewer from "@/components/ShiftChecklistViewer";

type ShiftType = "morning" | "day" | "evening" | "busy" | "off" | "fishing" | "clearing";

const SHIFT_CONFIG: Record<ShiftType, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  busy: { emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  fishing: { emoji: "🎣", label: "Guidning", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  clearing: { emoji: "🚜", label: "Gården", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  off: { emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
};

type Worker = { id: string; name: string; user_id: string | null };

const Chip = ({
  shift,
  hasChecklist,
  note,
  onClick,
}: {
  shift: ShiftType;
  hasChecklist?: boolean;
  note?: string | null;
  onClick?: (e?: any) => void;
}) => {
  const cfg = SHIFT_CONFIG[shift];
  const interactive = !!onClick && (!!hasChecklist || shift === "busy");
  const hasNote = shift === "busy" && !!note && note.trim().length > 0;
  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      title={hasNote ? note! : undefined}
      className={`relative w-full rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center px-1 flex-1 py-2 ${
        interactive ? "cursor-pointer hover:brightness-95 transition" : "cursor-default"
      }`}
    >
      <span className="leading-none text-base">{cfg.emoji}</span>
      <span className={`font-semibold mt-0.5 ${cfg.text} text-[10px]`}>{cfg.label}</span>
      {hasNote && (
        <span className={`mt-0.5 ${cfg.text} text-[9px] opacity-80 truncate max-w-full px-0.5`}>
          {note}
        </span>
      )}
    </button>
  );
};

const AdminWorkerUpcomingShifts = ({ workers }: { workers: Worker[] }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [openShift, setOpenShift] = useState<{
    id: string;
    label: string;
    date: Date;
    shiftType?: ShiftType;
    shiftIndex?: number;
  } | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const upcomingEnd = useMemo(() => addDays(today, 365), [today]);

  const selectableWorkers = workers
    .filter((w) => !!w.user_id)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  const selectedWorker = selectableWorkers.find((w) => w.user_id === selectedUserId) || null;

  const { data: upcoming = [], isLoading } = useQuery({
    queryKey: ["admin-worker-upcoming", selectedUserId, format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const fromStr = format(today, "yyyy-MM-dd");
      const toStr = format(upcomingEnd, "yyyy-MM-dd");
      const [shiftsRes, daysRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("user_id", selectedUserId)
          .gte("date", fromStr)
          .lte("date", toStr)
          .order("date", { ascending: true })
          .order("shift_index", { ascending: true }),
        supabase
          .from("schedule_days")
          .select("date,is_published")
          .gte("date", fromStr)
          .lte("date", toStr),
      ]);
      if (shiftsRes.error) throw shiftsRes.error;
      if (daysRes.error) throw daysRes.error;
      const publishedDates = new Set(
        (daysRes.data || []).filter((d: any) => d.is_published === true).map((d: any) => d.date),
      );
      const byDate: Record<string, { shifts: any[]; isPublished: boolean }> = {};
      (shiftsRes.data || []).forEach((s: any) => {
        if (!byDate[s.date]) byDate[s.date] = { shifts: [], isPublished: publishedDates.has(s.date) };
        byDate[s.date].shifts.push(s);
      });
      return Object.entries(byDate)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, v]) => ({ date, shifts: v.shifts, isPublished: v.isPublished }));
    },
    enabled: !!selectedUserId,
  });

  const upcomingShiftIds = useMemo(
    () => upcoming.flatMap((d: any) => d.shifts.map((s: any) => s.id)),
    [upcoming],
  );

  const { data: checklistCounts = {} } = useQuery({
    queryKey: ["admin-worker-upcoming-checklist-counts", upcomingShiftIds.join(",")],
    queryFn: async () => {
      if (upcomingShiftIds.length === 0) return {};
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("id, shift_id")
        .in("shift_id", upcomingShiftIds);
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, number>, c: any) => {
        acc[c.shift_id] = (acc[c.shift_id] || 0) + 1;
        return acc;
      }, {});
    },
    enabled: upcomingShiftIds.length > 0,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Kommande pass per medarbetare
          </h2>
          {selectedWorker && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label={collapsed ? "Visa lista" : "Dölj lista"}
            >
              {collapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Välj medarbetare…" />
            </SelectTrigger>
            <SelectContent>
              {selectableWorkers.map((w) => (
                <SelectItem key={w.id} value={w.user_id as string}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedUserId ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <span className="text-xs text-muted-foreground">
            Välj en medarbetare för att se hens kommande pass.
          </span>
        </div>
      ) : collapsed ? null : isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : upcoming.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <span className="text-xs text-muted-foreground">
            Inga kommande pass för {selectedWorker?.name}.
          </span>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border">
          {upcoming.map(({ date, shifts, isPublished }: { date: string; shifts: any[]; isPublished: boolean }, idx: number) => {
            const dateObj = new Date(date + "T00:00:00");
            const wk = getISOWeek(dateObj);
            const prevWk =
              idx > 0 ? getISOWeek(new Date(upcoming[idx - 1].date + "T00:00:00")) : null;
            const showWeekDivider = prevWk !== null && wk !== prevWk;
            const shiftsWithChecklist = shifts.filter(
              (s: any) => (checklistCounts[s.id] || 0) > 0,
            );
            const rowClickable = shiftsWithChecklist.length === 1;
            const rowOpen = rowClickable
              ? () =>
                  setOpenShift({
                    id: shiftsWithChecklist[0].id,
                    label: SHIFT_CONFIG[shiftsWithChecklist[0].shift_type as ShiftType].label,
                    date: dateObj,
                    shiftType: shiftsWithChecklist[0].shift_type as ShiftType,
                    shiftIndex: shiftsWithChecklist[0].shift_index ?? 0,
                  })
              : undefined;
            return (
              <div key={date}>
                {showWeekDivider && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/30">
                    <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
                      v {wk}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                    rowClickable ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""
                  }`}
                  onClick={rowOpen}
                  role={rowClickable ? "button" : undefined}
                  tabIndex={rowClickable ? 0 : undefined}
                  onKeyDown={
                    rowClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            rowOpen?.();
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground capitalize truncate">
                      {format(dateObj, "EEEE", { locale: sv })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {format(dateObj, "d MMMM", { locale: sv })}
                      </span>
                      {!isPublished && (
                        <span className="text-[9px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-px">
                          Ej publ.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 w-[160px]">
                    {shifts.map((entry: any) => {
                      const has = (checklistCounts[entry.id] || 0) > 0;
                      return (
                        <div key={entry.id} className="flex-1">
                          <Chip
                            shift={entry.shift_type as ShiftType}
                            hasChecklist={has}
                            note={entry.note}
                            onClick={
                              has
                                ? (e?: any) => {
                                    e?.stopPropagation?.();
                                    setOpenShift({
                                      id: entry.id,
                                      label:
                                        SHIFT_CONFIG[entry.shift_type as ShiftType].label,
                                      date: dateObj,
                                      shiftType: entry.shift_type as ShiftType,
                                      shiftIndex: entry.shift_index ?? 0,
                                    });
                                  }
                                : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!openShift} onOpenChange={(o) => { if (!o) setOpenShift(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] overflow-y-auto"
        >
          <SheetHeader className="text-left">
            <SheetTitle>
              {openShift && format(openShift.date, "EEEE d MMM", { locale: sv })}
            </SheetTitle>
            {openShift && (
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const passLabel = `Pass ${(openShift.shiftIndex ?? 0) + 1}`;
                  const cfg = openShift.shiftType ? SHIFT_CONFIG[openShift.shiftType] : null;
                  return cfg
                    ? `${selectedWorker?.name ?? ""} · ${passLabel} · ${cfg.emoji} ${cfg.label}`
                    : passLabel;
                })()}
              </div>
            )}
          </SheetHeader>
          <div className="mt-4">
            {openShift && <ShiftChecklistViewer shiftId={openShift.id} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminWorkerUpcomingShifts;
