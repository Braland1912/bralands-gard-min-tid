import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ArrowLeft, Check, Plus, Trash2, ClipboardList, X, Undo2, Rows3, Rows2, UserCog, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ShiftChecklists from "@/components/ShiftChecklists";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("admin-schedule-density") as "compact" | "comfortable") || "comfortable";
  });
  useEffect(() => {
    localStorage.setItem("admin-schedule-density", density);
  }, [density]);
  const isCompact = density === "compact";
  const cellPadX = isCompact ? (isMobile ? "px-1" : "px-2") : isMobile ? "px-1.5" : "px-3";
  const cellPadY = isCompact ? "py-1.5" : "py-3";
  const dayCellPad = isCompact ? "p-1" : "p-1.5";
  const dayCellMinH = isCompact ? "min-h-[48px]" : "min-h-[64px]";
  const dayCellGap = isCompact ? "gap-0.5" : "gap-1";
  const headerPadY = isCompact ? "py-2" : "py-3";
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheet, setSheet] = useState<{
    worker: any;
    date: Date;
    dayIndex: number;
    shiftIndex: 0 | 1;
  } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragActive = useRef(false);

  const onSwipeStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const t = e.touches[0];
    dragStart.current = { x: t.clientX, y: t.clientY };
    dragActive.current = false;
  };
  const onSwipeMove = (e: React.TouchEvent) => {
    if (!isMobile || !dragStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStart.current.x;
    const dy = t.clientY - dragStart.current.y;
    if (!dragActive.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        dragActive.current = true;
      } else if (Math.abs(dy) > 8) {
        dragStart.current = null;
        return;
      } else {
        return;
      }
    }
    setDragX(Math.max(0, dx));
  };
  const onSwipeEnd = () => {
    if (!isMobile) return;
    const threshold = window.innerWidth * 0.3;
    if (dragX > threshold) {
      setSheet(null);
    }
    setDragX(0);
    dragStart.current = null;
    dragActive.current = false;
  };

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

  // Sync noteDraft when sheet opens or underlying schedules change
  useEffect(() => {
    if (!sheet || !sheet.worker.user_id) {
      setNoteDraft("");
      return;
    }
    const dateStr = format(sheet.date, "yyyy-MM-dd");
    const row = (schedules as any[]).find(
      (s) => s.user_id === sheet.worker.user_id && s.date === dateStr && (s.shift_index ?? 0) === sheet.shiftIndex,
    );
    setNoteDraft(row?.note ?? "");
  }, [sheet, schedules]);

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
      note,
    }: {
      userId: string;
      date: string;
      shiftType: ShiftType;
      shiftIndex: 0 | 1;
      note?: string | null;
    }) => {
      // Check if this shift already exists (so we know if it's newly created)
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, shift_type")
        .eq("user_id", userId)
        .eq("date", date)
        .eq("shift_index", shiftIndex)
        .maybeSingle();

      const payload: any = { user_id: userId, date, shift_type: shiftType, shift_index: shiftIndex };
      // Only persist note for busy entries; clear it for other types
      payload.note = shiftType === "busy" ? (note && note.trim().length > 0 ? note.trim() : null) : null;

      const { error } = await supabase
        .from("schedules")
        .upsert(payload, { onConflict: "user_id,date,shift_index" });
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

  const updateNote = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string | null }) => {
      const { error } = await supabase
        .from("schedules")
        .update({ note: note && note.trim().length > 0 ? note.trim() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
    },
    onError: () => {
      toast({ title: "Kunde inte uppdatera anteckning", variant: "destructive" });
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

  // ── Byt medarbetare på ett befintligt pass ──────────────────────────
  // Uppdaterar bara schedules.user_id på samma rad → checklistor (shift_id),
  // avbockningar och anteckningar följer automatiskt med.
  const [reassignTo, setReassignTo] = useState<string>("");
  const [confirmReassign, setConfirmReassign] = useState<{
    shiftRowId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    conflictRowId?: string;
    conflictType?: ShiftType;
  } | null>(null);

  const reassignShift = useMutation({
    mutationFn: async ({
      shiftRowId,
      toUserId,
      conflictRowId,
    }: {
      shiftRowId: string;
      toUserId: string;
      conflictRowId?: string;
    }) => {
      // Om mottagaren redan har ett pass i samma index/datum → ta bort det först
      // (admin har bekräftat ersättning i UI:t)
      if (conflictRowId) {
        const { error: delErr } = await supabase
          .from("schedules")
          .delete()
          .eq("id", conflictRowId);
        if (delErr) throw delErr;
      }
      const { error } = await supabase
        .from("schedules")
        .update({ user_id: toUserId })
        .eq("id", shiftRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
      toast({ title: "Pass flyttat", description: "Checklistor och anteckningar följde med." });
      setConfirmReassign(null);
      setReassignTo("");
      // Uppdatera sheet:en så den pekar på den nya medarbetaren
      if (sheet) {
        const newWorker = (allWorkers as any[]).find(
          (w) => w.user_id === confirmReassign?.toUserId,
        );
        if (newWorker) setSheet({ ...sheet, worker: newWorker });
      }
    },
    onError: (e: any) => {
      toast({
        title: "Kunde inte flytta passet",
        description: e?.message ?? "Försök igen.",
        variant: "destructive",
      });
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
    note?: string | null,
  ) => {
    const cfg = SHIFT_MAP[shift];
    const hasNote = shift === "busy" && !!note && note.trim().length > 0;
    return (
      <div
        role="button"
        onClick={onClick}
        title={hasNote ? note! : undefined}
        className={`w-full rounded-md border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center px-1 py-1 cursor-pointer hover:opacity-80 transition-opacity relative`}
      >
        <span className="text-sm leading-none">{cfg.emoji}</span>
        <span className={`text-[10px] font-semibold mt-0.5 ${cfg.text}`}>{cfg.label}</span>
        {hasNote && (
          <>
            <span className={`hidden md:block text-[9px] mt-0.5 ${cfg.text} opacity-80 truncate max-w-full px-0.5`}>
              {note}
            </span>
            <span className="md:hidden absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
          </>
        )}
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
            <button
              onClick={() => setDensity(isCompact ? "comfortable" : "compact")}
              aria-label={isCompact ? "Byt till bekväm vy" : "Byt till kompakt vy"}
              title={isCompact ? "Bekväm vy" : "Kompakt vy"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border hover:bg-muted/70 transition-colors"
            >
              {isCompact ? <Rows2 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isCompact ? "Kompakt" : "Bekväm"}</span>
            </button>
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
                <div className={`${cellPadX} ${headerPadY}`} aria-hidden="true" />

                {weekDays.map((d, i) => {
                  const today = isToday(d);
                  const published = isDayPublished(d);
                  const dateStr = format(d, "yyyy-MM-dd");
                  return (
                    <div
                      key={i}
                      className={`${isMobile ? "px-1" : "px-2"} ${headerPadY} text-center border-l border-border ${today ? "bg-primary/5" : ""}`}
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
                        <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                          {published ? "Klar" : "Ej publicerat"}
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
                  const isSelected = sheet?.worker?.id === w.id;
                  const rowBg = isSelected
                    ? "bg-primary/10"
                    : zebra
                      ? "bg-row-zebra"
                      : "bg-card";
                  const rowHover = isSelected
                    ? "hover:bg-primary/15"
                    : zebra
                      ? "hover:bg-row-zebra-hover"
                      : "hover:bg-muted/40";
                  const selectedRing = isSelected
                    ? "ring-2 ring-inset ring-primary/60 relative z-10"
                    : "";
                  return (
                  <div
                    key={w.id}
                    className={`grid border-b border-border last:border-b-0 transition-colors ${rowBg} ${rowHover} ${selectedRing}`}
                    style={gridStyle}
                  >
                    {/* Worker cell */}
                    <div className={`${cellPadX} ${cellPadY} flex items-center sticky left-0 ${rowBg} overflow-hidden ${isSelected ? "border-l-2 border-l-primary" : ""}`}>
                      <span className={`${isMobile ? "text-xs" : "text-sm"} font-semibold ${isSelected ? "text-primary" : "text-foreground"} truncate`}>
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
                          className={`border-l border-border ${dayCellMinH} ${dayCellPad} flex flex-col ${dayCellGap} ${
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
                                  row0?.note,
                                )}
                              {shift1
                                ? renderChip(
                                    shift1,
                                    (e) => {
                                      e.stopPropagation();
                                      setSheet({ worker: w, date: d, dayIndex: i, shiftIndex: 1 });
                                    },
                                    has1,
                                    row1?.note,
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

      {/* Shift edit sheet */}
      <Sheet open={!!sheet} onOpenChange={(o) => { if (!o) { setSheet(null); setDragX(0); } }}>
        <SheetContent
          side="right"
          className="w-full max-w-full p-0 flex flex-col gap-0 overflow-x-hidden sm:max-w-none md:max-w-2xl md:rounded-l-2xl"
          style={{
            transform: dragX > 0 ? `translateX(${dragX}px)` : undefined,
            transition: dragX > 0 ? "none" : undefined,
          }}
        >
          {/* Header — sticky top + swipe-to-close handle on mobile */}
          <div
            className="sticky top-0 z-10 flex-shrink-0 flex items-start justify-between gap-3 p-4 border-b border-border bg-card touch-pan-y"
            onTouchStart={onSwipeStart}
            onTouchMove={onSwipeMove}
            onTouchEnd={onSwipeEnd}
            onTouchCancel={onSwipeEnd}
          >
            {/* Drag indicator on mobile */}
            <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-border" aria-hidden="true" />
            <div className="min-w-0 flex-1 pt-1.5 md:pt-0">
              <SheetTitle className="text-base font-semibold text-foreground truncate">
                {sheet?.worker.name}
              </SheetTitle>
              <div className="text-sm text-muted-foreground">
                {sheet && `${FULL_DAY_NAMES[sheet.dayIndex]} · ${format(sheet.date, "d MMM yyyy", { locale: sv })}`}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {(() => {
                  const passLabel = sheet?.shiftIndex === 0 ? "Pass 1" : "Pass 2";
                  const currentType = sheet?.worker?.user_id
                    ? getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
                    : null;
                  const cfg = currentType ? SHIFT_MAP[currentType] : null;
                  return cfg ? `${passLabel} · ${cfg.emoji} ${cfg.label}` : passLabel;
                })()}
              </div>
            </div>
            <button
              onClick={() => setSheet(null)}
              aria-label="Stäng"
              className="flex-shrink-0 p-2 rounded-lg hover:bg-muted transition-colors mt-1.5 md:mt-0"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-w-0">
            {sheet && (() => {
              const currentShiftRow = sheet.worker.user_id
                ? getShiftRow(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
                : null;
              const currentShiftType = sheet.worker.user_id
                ? getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
                : null;
              const hasShift = Boolean(currentShiftType);

              const ShiftTypePicker = (
                <div className="space-y-2.5">
                  {SHIFT_OPTIONS.map((opt) => {
                    const isSelected = currentShiftType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => {
                          upsertShift.mutate({
                            userId: sheet.worker.user_id,
                            date: format(sheet.date, "yyyy-MM-dd"),
                            shiftType: opt.type,
                            shiftIndex: sheet.shiftIndex,
                            note: opt.type === "busy" ? noteDraft : null,
                          });
                        }}
                        className={`w-full min-h-[64px] flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-colors active:scale-[0.99] ${
                          isSelected ? "bg-primary/10 border-primary" : "bg-card border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="text-3xl leading-none">{opt.emoji}</span>
                        <div className="flex-1 text-left">
                          <span className={`text-base font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && <Check className="h-6 w-6 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              );

              const BusyNoteEditor = currentShiftType === "busy" && currentShiftRow ? (
                <div className="space-y-2">
                  <Label htmlFor="busy-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Skäl (valfritt)
                  </Label>
                  <Textarea
                    id="busy-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => {
                      const original = currentShiftRow.note ?? "";
                      const next = noteDraft.trim();
                      if ((original ?? "") !== next) {
                        updateNote.mutate({ id: currentShiftRow.id, note: next });
                      }
                    }}
                    placeholder="T.ex. Läkarbesök, ledig, semester..."
                    className="min-h-[88px] text-base"
                  />
                </div>
              ) : null;

              return hasShift ? (
                <>
                  {BusyNoteEditor}
                  {currentShiftRow && currentShiftType !== "busy" && (
                    <div>
                      <ShiftChecklists shiftId={currentShiftRow.id} mode="admin" />
                    </div>
                  )}
                  {currentShiftRow && currentShiftType !== "busy" && <Separator />}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Passtyp
                    </div>
                    {ShiftTypePicker}
                  </div>
                </>
              ) : (
                <div>{ShiftTypePicker}</div>
              );
            })()}
          </div>

          {/* Footer — sticky bottom */}
          {sheet && (() => {
            const currentShiftType = sheet.worker.user_id
              ? getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
              : null;
            const canDelete = !!sheet.worker.user_id && !!currentShiftType;
            return (
              <div className="sticky bottom-0 z-10 flex-shrink-0 flex gap-2 p-4 border-t border-border bg-card">
                {canDelete && (
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
                    <Trash2 className="h-4 w-4 mr-2" />
                    Ta bort pass
                  </Button>
                )}
                <Button className="flex-1" onClick={() => setSheet(null)}>
                  Klar
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
      <AdminMobileBottomNav active="schema" />
    </div>
  );
};

export default AdminSchedule;

