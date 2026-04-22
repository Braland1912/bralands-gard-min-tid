import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ArrowLeft, Check, Plus, Trash2, ClipboardList, X, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ShiftChecklists from "@/components/ShiftChecklists";

import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";

type ShiftType = "morning" | "day" | "evening" | "busy" | "off" | "fishing" | "clearing";

const SHIFT_OPTIONS: { type: ShiftType; emoji: string; label: string; bg: string; border: string; text: string }[] = [
  { type: "morning", emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  { type: "day", emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { type: "evening", emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  { type: "busy", emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  { type: "fishing", emoji: "🎣", label: "Fiske", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { type: "clearing", emoji: "🌲", label: "Röja", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  { type: "off", emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
];

const SHIFT_MAP = Object.fromEntries(SHIFT_OPTIONS.map((s) => [s.type, s]));
const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const FULL_DAY_NAMES = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const getShortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}`;
};

const AdminSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheet, setSheet] = useState<{
    worker: any;
    date: Date;
    dayIndex: number;
    shiftIndex: 0 | 1;
  } | null>(null);

  const referenceDate = useMemo(() => {
    const now = new Date();
    if (weekOffset === 0) return now;
    return weekOffset > 0 ? addWeeks(now, weekOffset) : subWeeks(now, Math.abs(weekOffset));
  }, [weekOffset]);

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(referenceDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });

  const { data: allWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["admin-workers-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["admin-schedules", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: scheduleDays = [] } = useQuery({
    queryKey: ["admin-schedule-days", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_days")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isDayPublished = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const row = scheduleDays.find((d: any) => d.date === dateStr);
    return row?.is_published === true;
  };

  const togglePublish = useMutation({
    mutationFn: async ({ date, publish }: { date: string; publish: boolean }) => {
      const { error } = await supabase
        .from("schedule_days")
        .upsert({ date, is_published: publish, updated_at: new Date().toISOString() }, { onConflict: "date" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedule-days"] });
    },
    onError: () => {
      toast({ title: "Kunde inte uppdatera publicering", variant: "destructive" });
    },
  });

  const getShiftAt = (userId: string, date: Date, idx: 0 | 1): ShiftType | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = schedules.find(
      (s: any) => s.user_id === userId && s.date === dateStr && (s.shift_index ?? 0) === idx,
    );
    return entry ? (entry.shift_type as ShiftType) : null;
  };

  const getShiftRow = (userId: string, date: Date, idx: 0 | 1): any | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return (
      schedules.find(
        (s: any) => s.user_id === userId && s.date === dateStr && (s.shift_index ?? 0) === idx,
      ) || null
    );
  };

  const scheduleIds = (schedules as any[]).map((s) => s.id);

  const { data: checklistCounts = {} } = useQuery({
    queryKey: ["shift-checklist-counts", scheduleIds.join(",")],
    queryFn: async () => {
      if (scheduleIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("shift_id")
        .in("shift_id", scheduleIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.shift_id] = (counts[r.shift_id] ?? 0) + 1;
      });
      return counts;
    },
    enabled: scheduleIds.length > 0,
  });

  const upsertShift = useMutation({
    mutationFn: async ({
      userId,
      date,
      shiftType,
      shiftIndex,
    }: {
      userId: string;
      date: string;
      shiftType: ShiftType;
      shiftIndex: 0 | 1;
    }) => {
      // Check if this shift already exists (so we know if it's newly created)
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, shift_type")
        .eq("user_id", userId)
        .eq("date", date)
        .eq("shift_index", shiftIndex)
        .maybeSingle();

      const { error } = await supabase
        .from("schedules")
        .upsert(
          { user_id: userId, date, shift_type: shiftType, shift_index: shiftIndex },
          { onConflict: "user_id,date,shift_index" },
        );
      if (error) throw error;

      // Auto-attach templates only when shift is newly created
      if (existing) return;

      const { data: created } = await supabase
        .from("schedules")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .eq("shift_index", shiftIndex)
        .maybeSingle();
      if (!created) return;

      const { data: links } = await supabase
        .from("checklist_template_shift_types")
        .select("template_id, sort_order")
        .eq("shift_type", shiftType)
        .order("sort_order", { ascending: true });
      const templateIds = (links ?? []).map((l: any) => l.template_id);
      if (templateIds.length === 0) return;

      const { data: templates } = await supabase
        .from("checklist_templates")
        .select("id, name")
        .in("id", templateIds);
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("template_id, text, sort_order")
        .in("template_id", templateIds)
        .order("sort_order", { ascending: true });

      for (let i = 0; i < templateIds.length; i++) {
        const tpl = (templates as any[])?.find((t) => t.id === templateIds[i]);
        if (!tpl) continue;
        const { data: newList, error: clErr } = await supabase
          .from("shift_checklists")
          .insert({ shift_id: created.id, name: tpl.name, sort_order: i })
          .select("id")
          .single();
        if (clErr || !newList) continue;
        const tplItems = (items ?? []).filter((it: any) => it.template_id === tpl.id);
        if (tplItems.length > 0) {
          await supabase.from("shift_checklist_items").insert(
            tplItems.map((it: any, idx: number) => ({
              shift_checklist_id: newList.id,
              text: it.text,
              sort_order: idx,
            })),
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
    },
    onError: () => {
      toast({ title: "Kunde inte spara", description: "Försök igen eller kontrollera din behörighet.", variant: "destructive" });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async ({ userId, date, shiftIndex }: { userId: string; date: string; shiftIndex: 0 | 1 }) => {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("user_id", userId)
        .eq("date", date)
        .eq("shift_index", shiftIndex);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      setSheet(null);
    },
    onError: () => {
      toast({ title: "Kunde inte ta bort", description: "Försök igen.", variant: "destructive" });
    },
  });

  const isLoading = workersLoading || schedulesLoading;

  // Compute name column width based on longest displayed name
  const nameColPx = useMemo(() => {
    const names = (allWorkers as any[]).map((w) => (isMobile ? getShortName(w.name) : w.name));
    const longest = names.reduce((a, b) => (b.length > a.length ? b : a), "");
    const charPx = isMobile ? 7 : 8.5; // approx char width for text-xs / text-sm medium
    const padding = isMobile ? 14 : 26;
    const min = isMobile ? 72 : 110;
    const max = isMobile ? 140 : 220;
    return Math.max(min, Math.min(max, Math.ceil(longest.length * charPx + padding)));
  }, [allWorkers, isMobile]);

  const gridStyle = {
    gridTemplateColumns: `${nameColPx}px repeat(7, minmax(0, 1fr))`,
  };
  const dayMinPx = isMobile ? 62 : 92;
  const minWidthClass = "";
  const minWidthStyle = { minWidth: `${nameColPx + dayMinPx * 7}px` };

  const renderChip = (
    shift: ShiftType,
    onClick: (e: React.MouseEvent) => void,
    hasChecklists = false,
  ) => {
    const cfg = SHIFT_MAP[shift];
    return (
      <div
        role="button"
        onClick={onClick}
        className={`w-full rounded-md border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center px-1 py-1 cursor-pointer hover:opacity-80 transition-opacity`}
      >
        <span className="text-sm leading-none">{cfg.emoji}</span>
        <span className={`text-[10px] font-semibold mt-0.5 ${cfg.text}`}>{cfg.label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6 space-y-5">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Schema</h1>
            <p className="text-xs text-muted-foreground">Planera arbetspass per medarbetare</p>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Idag
              </button>
            )}
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="text-center min-w-[140px]">
                <div className="text-sm font-semibold text-foreground">Vecka {weekNumber}</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: sv })} – {format(weekEnd, "d MMM", { locale: sv })}
                </div>
              </div>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div style={minWidthStyle}>
              {/* Header row */}
              <div className="grid border-b border-border bg-muted/30" style={gridStyle}>
                <div className={`${isMobile ? "px-1.5" : "px-3"} py-3`} aria-hidden="true" />

                {weekDays.map((d, i) => {
                  const today = isToday(d);
                  const published = isDayPublished(d);
                  const dateStr = format(d, "yyyy-MM-dd");
                  return (
                    <div
                      key={i}
                      className={`${isMobile ? "px-1" : "px-2"} py-3 text-center border-l border-border ${today ? "bg-primary/5" : ""}`}
                    >
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        {DAY_NAMES[i]}
                      </div>
                      <div className="mt-0.5 flex justify-center">
                        <span
                          className={`text-sm font-semibold w-7 h-7 inline-flex items-center justify-center rounded-full ${
                            today ? "bg-primary text-primary-foreground" : "text-foreground"
                          }`}
                        >
                          {format(d, "d")}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            published ? "bg-green-500" : "bg-yellow-400"
                          }`}
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {published ? "Klar" : "Ej klar"}
                        </span>
                      </div>
                      <button
                        onClick={() => togglePublish.mutate({ date: dateStr, publish: !published })}
                        disabled={togglePublish.isPending}
                        aria-label={published ? "Avpublicera" : "Publicera"}
                        className="mt-1.5 inline-flex items-center justify-center p-1 rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {published ? (
                          <Undo2 className="h-3.5 w-3.5 text-yellow-400" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Body */}
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : allWorkers.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Inga medarbetare att visa.
                </div>
              ) : (
                allWorkers.map((w: any, rowIdx: number) => {
                  const zebra = rowIdx % 2 === 1;
                  const rowBg = zebra ? "bg-muted/30" : "bg-card";
                  return (
                  <div
                    key={w.id}
                    className={`grid border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors ${rowBg}`}
                    style={gridStyle}
                  >
                    {/* Worker cell */}
                    <div className={`${isMobile ? "px-1.5" : "px-3"} py-3 flex items-center sticky left-0 ${rowBg} overflow-hidden`}>
                      <span className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-foreground truncate`}>
                        {isMobile ? getShortName(w.name) : w.name}
                      </span>
                    </div>

                    {/* Day cells */}
                    {weekDays.map((d, i) => {
                      const shift0 = w.user_id ? getShiftAt(w.user_id, d, 0) : null;
                      const shift1 = w.user_id ? getShiftAt(w.user_id, d, 1) : null;
                      const row0 = w.user_id ? getShiftRow(w.user_id, d, 0) : null;
                      const row1 = w.user_id ? getShiftRow(w.user_id, d, 1) : null;
                      const has0 = !!(row0 && checklistCounts[row0.id]);
                      const has1 = !!(row1 && checklistCounts[row1.id]);
                      const today = isToday(d);
                      const hasAny = !!shift0 || !!shift1;

                      return (
                        <div
                          key={i}
                          className={`border-l border-border min-h-[64px] p-1.5 flex flex-col gap-1 ${
                            today ? "bg-primary/[0.03]" : ""
                          } ${!w.user_id ? "opacity-50" : ""}`}
                        >
                          {!hasAny ? (
                            <button
                              onClick={() =>
                                w.user_id && setSheet({ worker: w, date: d, dayIndex: i, shiftIndex: 0 })
                              }
                              disabled={!w.user_id}
                              className={`flex-1 w-full flex items-center justify-center rounded-md transition-colors ${
                                w.user_id ? "hover:bg-primary/5 cursor-pointer" : "cursor-not-allowed"
                              }`}
                            >
                              <span className="text-muted-foreground/40 text-lg">+</span>
                            </button>
                          ) : (
                            <>
                              {shift0 &&
                                renderChip(
                                  shift0,
                                  (e) => {
                                    e.stopPropagation();
                                    setSheet({ worker: w, date: d, dayIndex: i, shiftIndex: 0 });
                                  },
                                  has0,
                                )}
                              {shift1
                                ? renderChip(
                                    shift1,
                                    (e) => {
                                      e.stopPropagation();
                                      setSheet({ worker: w, date: d, dayIndex: i, shiftIndex: 1 });
                                    },
                                    has1,
                                  )
                                : w.user_id && (
                                    <button
                                      onClick={() =>
                                        setSheet({ worker: w, date: d, dayIndex: i, shiftIndex: 1 })
                                      }
                                      className="w-full flex items-center justify-center rounded-md border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 py-0.5 transition-colors"
                                      aria-label="Lägg till andra pass"
                                    >
                                      <Plus className="h-3 w-3 text-muted-foreground/60" />
                                    </button>
                                  )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[20px] border-t border-border p-5 pb-8 animate-in slide-in-from-bottom duration-300 max-w-[480px] mx-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="text-center mb-5">
              <div className="text-base font-semibold text-foreground">{sheet.worker.name}</div>
              <div className="text-sm text-muted-foreground">
                {FULL_DAY_NAMES[sheet.dayIndex]} · {format(sheet.date, "d MMM yyyy", { locale: sv })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {sheet.shiftIndex === 0 ? "Pass 1" : "Pass 2"}
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {SHIFT_OPTIONS.map((opt) => {
                const currentShift = sheet.worker.user_id
                  ? getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
                  : null;
                const isSelected = currentShift === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => {
                      const wasEmpty = !currentShift;
                      upsertShift.mutate(
                        {
                          userId: sheet.worker.user_id,
                          date: format(sheet.date, "yyyy-MM-dd"),
                          shiftType: opt.type,
                          shiftIndex: sheet.shiftIndex,
                        },
                        {
                          onSuccess: () => {
                            if (wasEmpty) setSheet(null);
                          },
                        },
                      );
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      isSelected ? "bg-primary/10 border-primary/30" : "bg-card border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <div className="flex-1 text-left">
                      <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>

            {sheet.worker.user_id && getShiftRow(sheet.worker.user_id, sheet.date, sheet.shiftIndex) && (
              <div className="mb-5 pt-4 border-t border-border">
                <ShiftChecklists
                  shiftId={getShiftRow(sheet.worker.user_id, sheet.date, sheet.shiftIndex)!.id}
                  mode="admin"
                />
              </div>
            )}

            <div className="flex gap-2">
              {sheet.worker.user_id &&
                getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex) && (
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() =>
                      deleteShift.mutate({
                        userId: sheet.worker.user_id,
                        date: format(sheet.date, "yyyy-MM-dd"),
                        shiftIndex: sheet.shiftIndex,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Ta bort
                  </Button>
                )}
              <Button variant="outline" className="flex-1" onClick={() => setSheet(null)}>
                Stäng
              </Button>
            </div>
          </div>
        </div>
      )}
      <AdminMobileBottomNav active="schema" />
    </div>
  );
};

export default AdminSchedule;
