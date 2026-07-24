import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ArrowLeft, Check, Plus, Trash2, ClipboardList, X, Undo2, Rows3, Rows2, UserCog, Loader2, AlertTriangle, ChevronDown, ChevronUp, EyeOff, CalendarDays, List } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";

type ShiftType = "morning" | "day" | "evening" | "evening_a" | "evening_b" | "busy" | "off" | "fishing" | "clearing";

const SHIFT_OPTIONS: { type: ShiftType; emoji: string; label: string; bg: string; border: string; text: string }[] = [
  { type: "morning", emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  { type: "day", emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { type: "evening_a", emoji: "🌙", label: "Kväll A", bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700" },
  { type: "evening", emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  { type: "evening_b", emoji: "🌙", label: "Kväll B", bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
  { type: "busy", emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  { type: "fishing", emoji: "🎣", label: "Guidning", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { type: "clearing", emoji: "🚜", label: "Gården", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
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
  const [mobileView, setMobileView] = useState<"day" | "week">(() => {
    if (typeof window === "undefined") return "day";
    return (localStorage.getItem("admin-schedule-mobile-view") as "day" | "week") || "day";
  });
  useEffect(() => {
    localStorage.setItem("admin-schedule-mobile-view", mobileView);
  }, [mobileView]);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=sun..6=sat
    return dow === 0 ? 6 : dow - 1;
  });
  const [sheet, setSheet] = useState<{
    worker: any;
    date: Date;
    dayIndex: number;
    shiftIndex: 0 | 1;
  } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [startTimeDraft, setStartTimeDraft] = useState("");
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

  const weekStart = useMemo(() => startOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate]);
  const weekEnd = useMemo(() => endOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate]);
  const weekNumber = getISOWeek(referenceDate);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    if (isCurrentWeek) {
      const now = new Date();
      const dow = now.getDay();
      setSelectedDayIdx(dow === 0 ? 6 : dow - 1);
    } else {
      setSelectedDayIdx(0);
    }
  }, [weekOffset, isCurrentWeek]);

  const [collapsedWorkers, setCollapsedWorkers] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("admin-schedule-collapsed-workers");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "admin-schedule-collapsed-workers",
        JSON.stringify(Array.from(collapsedWorkers)),
      );
    } catch {
      /* ignore */
    }
  }, [collapsedWorkers]);
  const toggleCollapse = (workerId: string) =>
    setCollapsedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });

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

  // Sync drafts when sheet opens or underlying schedules change
  useEffect(() => {
    if (!sheet || !sheet.worker.user_id) {
      setNoteDraft("");
      setStartTimeDraft("");
      return;
    }
    const dateStr = format(sheet.date, "yyyy-MM-dd");
    const row = (schedules as any[]).find(
      (s) => s.user_id === sheet.worker.user_id && s.date === dateStr && (s.shift_index ?? 0) === sheet.shiftIndex,
    );
    setNoteDraft(row?.note ?? "");
    setStartTimeDraft(row?.start_time ? String(row.start_time).slice(0, 5) : "");
  }, [sheet, schedules]);

  // Nollställ "Byt medarbetare"-valet när sheet öppnas/stängs/byter pass
  useEffect(() => {
    setReassignTo("");
  }, [sheet?.worker?.user_id, sheet?.shiftIndex, sheet?.date]);

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
        .select("id, shift_type, note, start_time")
        .eq("user_id", userId)
        .eq("date", date)
        .eq("shift_index", shiftIndex)
        .maybeSingle();

      const payload: any = { user_id: userId, date, shift_type: shiftType, shift_index: shiftIndex };
      // Note follows the row, not the type: preserve existing note when switching types
      // unless a fresh note was explicitly provided (used when creating/editing busy from sheet).
      if (typeof note === "string" || note === null) {
        payload.note = note && note.trim().length > 0 ? note.trim() : null;
      } else if (existing && "note" in existing) {
        payload.note = (existing as any).note ?? null;
      }

      // Autofyll anteckning för Kväll A/B när passet är nytt och saknar anteckning
      const DEFAULT_NOTE: Partial<Record<ShiftType, string>> = {
        evening_a: `KVÄLLSPASS A · 17:00–20:30 (3,5 h)

• Håll igång tvätten – kort program på maskinen, torktumla handdukar och ev. sängkläder från dagen.
• Städa campingen (se checklistor: service, kiosk, dass, grillstugor, lekplats).
• Börja förbereda kvällsrundan.
• När Person B kommer – gå rundan tillsammans.
• Efter rundan: jämför mot förbetalda och radera manuellt inlagda dubbletter så vi vet hur många vi inväntar.`,
        evening_b: `KVÄLLSPASS B · 18:30–22:00 (3,5 h)

• Förbered rundan och gå den tillsammans med Person A.
• Efter rundan: jämför mot förbetalda och radera manuellt inlagda dubbletter.
• Person A går hem – du tar över.
• Välkomna gäster som rullar in och visa var det finns ledigt.
• Håll igång tvätten – vik torr tvätt, starta tvättmaskin och torktumlare.
• Städa campingen (service, kiosk, dass, grillstugor, lekplats).
• Töm alla sopor.
• Gå runt och se om förbetalda kommit – ge dem plats i appen eller radera dubbletter.
• Sista koll dass/servicehus: fyll på tvål och papper, rensa duschsilar, dammsug med handdammsugaren.
• Sista koll tvätt: töm handdukar från service och starta tvättmaskin.
• Lås källardörren, gå ut via garaget och lås garaget med *.
• Stäng fönster i servicehuset, rensa duschsil, sopa, rengör toalett med WC-anka, stäng dörren.`,
      };
      if (!existing && (payload.note === undefined || payload.note === null)) {
        const defNote = DEFAULT_NOTE[shiftType];
        if (defNote) payload.note = defNote;
      }


      // Default starttider om inget annat är överenskommet (sätts endast vid skapande,
      // eller om befintligt pass saknar starttid).
      const DEFAULT_START: Partial<Record<ShiftType, string>> = {
        morning: "07:00:00",
        day: "09:00:00",
        evening: "18:00:00",
        evening_a: "17:00:00",
        evening_b: "18:30:00",
      };
      const defaultStart = DEFAULT_START[shiftType];
      if (defaultStart) {
        const existingStart = (existing as any)?.start_time ?? null;
        if (!existing || !existingStart) {
          payload.start_time = defaultStart;
        }
      }

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

      // Hämta mallar via grupp-kopplingar för passtypen, i gruppernas ordning
      const { data: groupLinks } = await supabase
        .from("checklist_group_shift_types" as any)
        .select("group_id, sort_order")
        .eq("shift_type", shiftType)
        .order("sort_order", { ascending: true });
      const groupIds = ((groupLinks ?? []) as any[]).map((g) => g.group_id);
      let templateIds: string[] = [];
      if (groupIds.length > 0) {
        const { data: tplsG } = await supabase
          .from("checklist_templates")
          .select("id, group_id, sort_order")
          .in("group_id", groupIds)
          .order("sort_order", { ascending: true });
        // Ordna mallar grupp-för-grupp i gruppordningen
        const byGroup = new Map<string, string[]>();
        for (const t of (tplsG ?? []) as any[]) {
          if (!byGroup.has(t.group_id)) byGroup.set(t.group_id, []);
          byGroup.get(t.group_id)!.push(t.id);
        }
        for (const gid of groupIds) {
          for (const tid of byGroup.get(gid) ?? []) templateIds.push(tid);
        }
      }
      if (templateIds.length === 0) return;

      const { data: templates } = await supabase
        .from("checklist_templates")
        .select("id, name, description, group_id, checklist_template_groups(name, color)" as any)
        .in("id", templateIds);
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("template_id, text, sort_order, description" as any)
        .in("template_id", templateIds)
        .order("sort_order", { ascending: true });

      // Sortera så att "Campingen (i slutet av passet)" alltid hamnar sist
      const isEndOfShift = (name: string | undefined) =>
        (name ?? "").trim().toLowerCase() === "campingen (i slutet av passet)";
      const orderedTplIds = [...templateIds].sort((a, b) => {
        const ta = (templates as any[])?.find((t) => t.id === a);
        const tb = (templates as any[])?.find((t) => t.id === b);
        const aEnd = isEndOfShift(ta?.name);
        const bEnd = isEndOfShift(tb?.name);
        if (aEnd && !bEnd) return 1;
        if (!aEnd && bEnd) return -1;
        return templateIds.indexOf(a) - templateIds.indexOf(b);
      });

      for (let i = 0; i < orderedTplIds.length; i++) {
        const tpl = (templates as any[])?.find((t) => t.id === orderedTplIds[i]);
        if (!tpl) continue;
        const grp = tpl.checklist_template_groups ?? null;
        const { data: newList, error: clErr } = await supabase
          .from("shift_checklists")
          .insert({
            shift_id: created.id,
            name: tpl.name,
            sort_order: i,
            description: tpl.description ?? null,
            group_name: grp?.name ?? null,
            group_color: grp?.color ?? null,
          } as any)
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
              description: it.description ?? null,
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

  const updateStartTime = useMutation({
    mutationFn: async ({ id, startTime }: { id: string; startTime: string | null }) => {
      const { error } = await supabase
        .from("schedules")
        .update({ start_time: startTime && startTime.length > 0 ? startTime : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
    },
    onError: () => {
      toast({ title: "Kunde inte uppdatera starttid", variant: "destructive" });
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
    // När mottagaren redan har ett pass på samma index men det andra
    // passindexet är ledigt – flytta dit istället för att skriva över.
    doubleShiftIndex?: 0 | 1;
  } | null>(null);

  const reassignShift = useMutation({
    mutationFn: async ({
      shiftRowId,
      toUserId,
      conflictRowId,
      doubleShiftIndex,
    }: {
      shiftRowId: string;
      toUserId: string;
      conflictRowId?: string;
      doubleShiftIndex?: 0 | 1;
    }) => {
      // Dubbelpass: mottagaren behåller sitt befintliga pass och
      // detta pass flyttas till det lediga passindexet samma dag.
      if (doubleShiftIndex !== undefined) {
        const { error } = await supabase
          .from("schedules")
          .update({ user_id: toUserId, shift_index: doubleShiftIndex })
          .eq("id", shiftRowId);
        if (error) throw error;
        return;
      }
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

  // ── Duplicera ett pass till en eller flera medarbetare ──────────────
  // Skapar NYA schedules-rader (samma shift_type/index/datum) och kopierar
  // checklistor + checklistpunkter (avbockningar nollställs så varje
  // medarbetare bockar av sina egna).
  const [duplicateTargets, setDuplicateTargets] = useState<Set<string>>(new Set());
  const [confirmDuplicate, setConfirmDuplicate] = useState<{
    sourceShiftRowId: string;
    sourceType: ShiftType;
    sourceNote: string | null;
    fromName: string;
    date: string;
    shiftIndex: 0 | 1;
    targets: Array<{
      userId: string;
      name: string;
      conflictRowId?: string;
      conflictType?: ShiftType;
    }>;
  } | null>(null);

  // Klonar källpasset till EN målmedarbetare. Anropas i loop för flera mål.
  const cloneShiftToWorker = async (args: {
    sourceShiftRowId: string;
    sourceType: ShiftType;
    sourceNote: string | null;
    toUserId: string;
    date: string;
    shiftIndex: 0 | 1;
    conflictRowId?: string;
  }) => {
    if (args.conflictRowId) {
      const { error: delErr } = await supabase
        .from("schedules")
        .delete()
        .eq("id", args.conflictRowId);
      if (delErr) throw delErr;
    }

    const { data: created, error: insErr } = await supabase
      .from("schedules")
      .insert({
        user_id: args.toUserId,
        date: args.date,
        shift_type: args.sourceType,
        shift_index: args.shiftIndex,
        note: args.sourceNote && args.sourceNote.trim().length > 0 ? args.sourceNote : null,
      })
      .select("id")
      .single();
    if (insErr || !created) throw insErr ?? new Error("Kunde inte skapa pass");

    const { data: srcLists, error: listErr } = await supabase
      .from("shift_checklists")
      .select("id, name, sort_order")
      .eq("shift_id", args.sourceShiftRowId)
      .order("sort_order", { ascending: true });
    if (listErr) throw listErr;
    if (!srcLists || srcLists.length === 0) return;

    const srcListIds = srcLists.map((l: any) => l.id);
    const { data: srcItems, error: itemsErr } = await supabase
      .from("shift_checklist_items")
      .select("shift_checklist_id, text, sort_order")
      .in("shift_checklist_id", srcListIds)
      .order("sort_order", { ascending: true });
    if (itemsErr) throw itemsErr;

    for (const list of srcLists as any[]) {
      const { data: newList, error: clErr } = await supabase
        .from("shift_checklists")
        .insert({ shift_id: created.id, name: list.name, sort_order: list.sort_order })
        .select("id")
        .single();
      if (clErr || !newList) continue;
      const items = (srcItems ?? []).filter((it: any) => it.shift_checklist_id === list.id);
      if (items.length > 0) {
        await supabase.from("shift_checklist_items").insert(
          items.map((it: any) => ({
            shift_checklist_id: newList.id,
            text: it.text,
            sort_order: it.sort_order,
            is_checked: false,
          })),
        );
      }
    }
  };

  const duplicateShift = useMutation({
    mutationFn: async (args: {
      sourceShiftRowId: string;
      sourceType: ShiftType;
      sourceNote: string | null;
      date: string;
      shiftIndex: 0 | 1;
      targets: Array<{ userId: string; conflictRowId?: string }>;
    }) => {
      const failures: string[] = [];
      let succeeded = 0;
      for (const t of args.targets) {
        try {
          await cloneShiftToWorker({
            sourceShiftRowId: args.sourceShiftRowId,
            sourceType: args.sourceType,
            sourceNote: args.sourceNote,
            toUserId: t.userId,
            date: args.date,
            shiftIndex: args.shiftIndex,
            conflictRowId: t.conflictRowId,
          });
          succeeded++;
        } catch (e: any) {
          failures.push(e?.message ?? "okänt fel");
        }
      }
      return { succeeded, failures };
    },
    onSuccess: ({ succeeded, failures }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
      if (failures.length === 0) {
        toast({
          title: succeeded === 1 ? "Pass duplicerat" : `Pass duplicerat till ${succeeded} medarbetare`,
          description: "Checklistor kopierades med samma ordning.",
        });
      } else {
        toast({
          title: `Duplicerat till ${succeeded}, ${failures.length} misslyckades`,
          description: failures[0],
          variant: "destructive",
        });
      }
      setConfirmDuplicate(null);
      setDuplicateTargets(new Set());
    },
    onError: (e: any) => {
      toast({
        title: "Kunde inte duplicera passet",
        description: e?.message ?? "Försök igen.",
        variant: "destructive",
      });
    },
  });

  // Nollställ duplicate-val när sheet byter pass
  useEffect(() => {
    setDuplicateTargets(new Set());
  }, [sheet?.worker?.user_id, sheet?.shiftIndex, sheet?.date]);

  const isLoading = workersLoading || schedulesLoading;

  // Compute name column width based on longest displayed name
  const nameColPx = useMemo(() => {
    const names = (allWorkers as any[]).map((w) => w.name as string);
    const displayed = isMobile
      ? names.map((n) => (n?.split(" ")[0] ?? n) || "")
      : names;
    const longest = displayed.reduce((a, b) => (b.length > a.length ? b : a), "");
    const charPx = isMobile ? 6.5 : 8.5;
    const padding = isMobile ? 20 : 26;
    const min = isMobile ? 56 : 110;
    const max = isMobile ? 110 : 220;
    return Math.max(min, Math.min(max, Math.ceil(longest.length * charPx + padding)));
  }, [allWorkers, isMobile]);

  // Active shift types som räknas som "arbetspass" (räknas mot täckning + veckoräkning)
  const ACTIVE_TYPES: ShiftType[] = ["morning", "day", "evening", "evening_a", "evening_b", "fishing", "clearing"];
  const COVERAGE_TYPES: { type: ShiftType; label: string; matches?: ShiftType[] }[] = [
    { type: "morning", label: "Morgon" },
    { type: "day", label: "Dag" },
    // "Kväll" täcks antingen av ett vanligt kvällspass ELLER av både Kväll A och Kväll B
    { type: "evening", label: "Kväll" },
  ];

  // Räkna aktiva pass per medarbetare denna vecka
  const shiftCountsByUser = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of schedules as any[]) {
      if (!s.user_id) continue;
      if (!ACTIVE_TYPES.includes(s.shift_type as ShiftType)) continue;
      counts[s.user_id] = (counts[s.user_id] ?? 0) + 1;
    }
    return counts;
  }, [schedules]);

  // Hitta dagar som saknar morgon/dag/kväll (räknar alla medarbetare tillsammans)
  const coverageGaps = useMemo(() => {
    return weekDays.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const daySchedules = (schedules as any[]).filter((s) => s.date === dateStr);
      const types = new Set(daySchedules.map((s) => s.shift_type as ShiftType));
      const missing = COVERAGE_TYPES.filter((ct) => {
        if (ct.type === "evening") {
          // Täckt om vanligt kvällspass finns, eller om både Kväll A och Kväll B finns
          const hasEvening = types.has("evening");
          const hasBoth = types.has("evening_a") && types.has("evening_b");
          return !(hasEvening || hasBoth);
        }
        const matches = ct.matches ?? [ct.type];
        return !matches.some((m) => types.has(m));
      });
      return { date: d, dateStr, missing };
    }).filter((x) => x.missing.length > 0);
  }, [schedules, weekDays]);


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
    const hasNote = !!note && note.trim().length > 0;
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
            {isMobile && (
              <button
                onClick={() => setMobileView(mobileView === "day" ? "week" : "day")}
                aria-label={mobileView === "day" ? "Byt till veckovy" : "Byt till dagvy"}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border hover:bg-muted/70 transition-colors"
              >
                {mobileView === "day" ? <CalendarDays className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                <span>{mobileView === "day" ? "Vecka" : "Dag"}</span>
              </button>
            )}
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

        {/* Täckningsvarning: dagar som saknar morgon-, dag- eller kvällspass */}
        {!isLoading && coverageGaps.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 sm:p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-sm font-semibold text-amber-900">
                  Pass saknas denna vecka
                </div>
                <ul className="text-xs sm:text-sm text-amber-900/90 space-y-0.5">
                  {coverageGaps.map(({ date, missing }) => (
                    <li key={format(date, "yyyy-MM-dd")} className="flex flex-wrap gap-x-1.5">
                      <span className="font-medium capitalize">
                        {format(date, "EEEE d MMM", { locale: sv })}:
                      </span>
                      <span>
                        saknar {missing.map((m) => m.label.toLowerCase()).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isMobile && mobileView === "day" ? (
          <div className="space-y-3">
            {weekDays.map((d, dayIdx) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const published = isDayPublished(d);
              const today = isToday(d);
              return (
                <Card
                  key={dayIdx}
                  className={`overflow-hidden ${today ? "ring-2 ring-primary/40" : ""}`}
                >
                  <div className={`flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border ${today ? "bg-primary/5" : "bg-muted/40"}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground capitalize truncate">
                        {format(d, "EEEE d MMMM", { locale: sv })}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            published ? "bg-green-500" : "bg-yellow-400"
                          }`}
                        />
                        {published ? "Publicerat" : "Ej publicerat"}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        togglePublish.mutate({ date: dateStr, publish: !published })
                      }
                      disabled={togglePublish.isPending}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors disabled:opacity-50 shrink-0 ${
                        published
                          ? "bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                          : "bg-green-50 border-green-300 text-green-800 hover:bg-green-100"
                      }`}
                    >
                      {published ? (
                        <><Undo2 className="h-3.5 w-3.5" /> Avpublicera</>
                      ) : (
                        <><Check className="h-3.5 w-3.5" /> Publicera</>
                      )}
                    </button>
                  </div>
                  {isLoading ? (
                    <div className="p-3 space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {(allWorkers as any[])
                        .filter((w) => !!w.user_id)
                        .map((w: any) => {
                          const shift0 = getShiftAt(w.user_id, d, 0);
                          const shift1 = getShiftAt(w.user_id, d, 1);
                          const row0 = getShiftRow(w.user_id, d, 0);
                          const row1 = getShiftRow(w.user_id, d, 1);
                          const has0 = !!(row0 && checklistCounts[row0.id]);
                          const has1 = !!(row1 && checklistCounts[row1.id]);
                          return (
                            <li
                              key={w.id}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-foreground break-words leading-tight">
                                  {w.name}
                                </div>
                              </div>
                              <div className="flex gap-1.5 w-[152px] shrink-0">
                                <div className="flex-1">
                                  {shift0 ? (
                                    renderChip(
                                      shift0,
                                      (e) => {
                                        e.stopPropagation();
                                        setSheet({
                                          worker: w,
                                          date: d,
                                          dayIndex: dayIdx,
                                          shiftIndex: 0,
                                        });
                                      },
                                      has0,
                                      row0?.note,
                                    )
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setSheet({
                                          worker: w,
                                          date: d,
                                          dayIndex: dayIdx,
                                          shiftIndex: 0,
                                        })
                                      }
                                      className="w-full min-h-[44px] flex items-center justify-center rounded-md border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                                      aria-label="Lägg till pass"
                                    >
                                      <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    </button>
                                  )}
                                </div>
                                <div className="flex-1">
                                  {shift1 ? (
                                    renderChip(
                                      shift1,
                                      (e) => {
                                        e.stopPropagation();
                                        setSheet({
                                          worker: w,
                                          date: d,
                                          dayIndex: dayIdx,
                                          shiftIndex: 1,
                                        });
                                      },
                                      has1,
                                      row1?.note,
                                    )
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setSheet({
                                          worker: w,
                                          date: d,
                                          dayIndex: dayIdx,
                                          shiftIndex: 1,
                                        })
                                      }
                                      className="w-full min-h-[44px] flex items-center justify-center rounded-md border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                                      aria-label="Lägg till andra pass"
                                    >
                                      <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
        <Card key={format(weekStart, "yyyy-MM-dd")} className="overflow-hidden">
          <div className="max-h-[calc(100dvh-190px)] overflow-auto md:max-h-[calc(100dvh-210px)]">
            <div style={minWidthStyle}>
              {/* Header row */}
              <div className="grid border-b border-border bg-muted/95 backdrop-blur sticky top-0 z-30" style={gridStyle}>
                <div className={`${cellPadX} ${headerPadY} sticky left-0 z-30 bg-muted/95 backdrop-blur`} aria-hidden="true" />

                {weekDays.map((d, i) => {
                  const today = isToday(d);
                  const published = isDayPublished(d);
                  const dateStr = format(d, "yyyy-MM-dd");
                  return (
                    <div
                      key={dateStr}
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
                  const shiftCount = w.user_id ? (shiftCountsByUser[w.user_id] ?? 0) : 0;
                  const isCollapsed = collapsedWorkers.has(w.id);
                  return (
                  <div
                    key={w.id}
                    className={`grid border-b border-border last:border-b-0 transition-colors ${rowBg} ${rowHover} ${selectedRing}`}
                    style={isCollapsed ? { gridTemplateColumns: "1fr" } : gridStyle}
                  >
                    {/* Worker cell */}
                    <div className={`${cellPadX} ${cellPadY} flex items-center gap-1.5 sticky left-0 z-20 ${rowBg} overflow-hidden ${isSelected ? "border-l-2 border-l-primary" : ""}`}>
                      {w.user_id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCollapse(w.id); }}
                          aria-label={isCollapsed ? "Visa vecka" : "Dölj vecka"}
                          title={isCollapsed ? "Visa vecka" : "Dölj vecka (medarbetare inaktiv)"}
                          className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        >
                          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <span className={`${isMobile ? "text-[11px] leading-tight truncate" : "text-sm truncate"} font-semibold flex-1 min-w-0 ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {isMobile ? (w.name?.split(" ")[0] ?? w.name) : w.name}
                      </span>
                      {w.user_id && !isMobile && (
                        <span
                          className={`ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold border ${
                            shiftCount === 0
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-primary/10 text-primary border-primary/20"
                          }`}
                          title={`${shiftCount} pass denna vecka`}
                        >
                          {shiftCount}
                        </span>
                      )}
                      {isCollapsed && (
                        <span className="ml-2 text-[10px] text-muted-foreground italic hidden sm:inline">
                          Dold denna vecka
                        </span>
                      )}
                    </div>


                    {/* Day cells */}
                    {!isCollapsed && weekDays.map((d, i) => {
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
        )}
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
            <div className="flex-shrink-0 flex items-center gap-1 mt-1.5 md:mt-0">
              {(() => {
                const currentShiftType = sheet?.worker.user_id
                  ? getShiftAt(sheet.worker.user_id, sheet.date, sheet.shiftIndex)
                  : null;
                const canDelete = !!sheet?.worker.user_id && !!currentShiftType;
                if (!canDelete || !sheet) return null;
                return (
                  <button
                    onClick={() =>
                      deleteShift.mutate({
                        userId: sheet.worker.user_id,
                        date: format(sheet.date, "yyyy-MM-dd"),
                        shiftIndex: sheet.shiftIndex,
                      })
                    }
                    aria-label="Ta bort pass"
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                );
              })()}
              <button
                onClick={() => setSheet(null)}
                aria-label="Stäng"
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
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
                            // For busy we pass the current draft; for other types we omit `note`
                            // so the mutation preserves any existing note on the row.
                            note: opt.type === "busy" ? noteDraft : undefined,
                          });
                        }}
                        className={`w-full min-h-[64px] flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.99] ${opt.bg} ${
                          isSelected ? "border-primary ring-2 ring-primary/30 scale-[1.01]" : `${opt.border} hover:brightness-95`
                        }`}
                      >
                        <span className="text-3xl leading-none">{opt.emoji}</span>
                        <div className="flex-1 text-left">
                          <span className={`text-base font-semibold ${opt.text}`}>
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && <Check className="h-6 w-6 text-primary animate-in zoom-in-50 duration-200" />}
                      </button>
                    );
                  })}
                </div>
              );

              const isBusy = currentShiftType === "busy";
              const NoteEditor = currentShiftRow ? (
                <div className="space-y-2">
                  <Label htmlFor="shift-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {isBusy ? "Skäl (valfritt)" : "Notering till medarbetaren (valfritt)"}
                  </Label>
                  <Textarea
                    id="shift-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => {
                      const original = currentShiftRow.note ?? "";
                      const next = noteDraft.trim();
                      if ((original ?? "") !== next) {
                        updateNote.mutate({ id: currentShiftRow.id, note: next });
                      }
                    }}
                    disabled={typeof navigator !== "undefined" && !navigator.onLine}
                    placeholder={
                      isBusy
                        ? "T.ex. upptagen hela dagen, upptagen förmiddag men kan jobba från 15..."
                        : "T.ex. info om gästerna, något särskilt att tänka på..."
                    }
                    className="min-h-[88px] text-base"
                  />
                </div>
              ) : null;

              const StartTimeEditor = currentShiftRow && !isBusy ? (
                <div className="space-y-2">
                  <Label htmlFor="shift-start-time" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Starttid (valfri)
                  </Label>
                  <input
                    id="shift-start-time"
                    type="time"
                    value={startTimeDraft}
                    onChange={(e) => setStartTimeDraft(e.target.value)}
                    onBlur={() => {
                      const original = currentShiftRow.start_time ? String(currentShiftRow.start_time).slice(0, 5) : "";
                      const next = startTimeDraft;
                      if (original !== next) {
                        updateStartTime.mutate({ id: currentShiftRow.id, startTime: next || null });
                      }
                    }}
                    disabled={typeof navigator !== "undefined" && !navigator.onLine}
                    className="input-datetime h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
                    placeholder="t.ex. 08:00"
                  />
                </div>
              ) : null;

              // Duplicera-väljare (visas endast när det finns ett aktivt pass)
              const DuplicatePicker = currentShiftRow ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Duplicera till medarbetare
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lägg upp samma pass på en annan medarbetare. Checklistor kopieras
                    (avbockningar nollställs så var och en bockar av sina egna).
                  </p>
                  <div className="space-y-2">
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                      {(allWorkers as any[])
                        .filter((w) => w.user_id && w.user_id !== sheet.worker.user_id)
                        .map((w) => {
                          const checked = duplicateTargets.has(w.user_id);
                          const dateStr = format(sheet.date, "yyyy-MM-dd");
                          const conflictRow = (schedules as any[]).find(
                            (s) =>
                              s.user_id === w.user_id &&
                              s.date === dateStr &&
                              (s.shift_index ?? 0) === sheet.shiftIndex,
                          );
                          return (
                            <label
                              key={w.id}
                              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setDuplicateTargets((prev) => {
                                    const next = new Set(prev);
                                    if (v) next.add(w.user_id);
                                    else next.delete(w.user_id);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">
                                  {w.name}
                                </div>
                                {conflictRow && (
                                  <div className="text-[11px] text-destructive">
                                    Har redan ett pass{conflictRow.shift_type
                                      ? ` (${SHIFT_MAP[conflictRow.shift_type as ShiftType]?.label ?? conflictRow.shift_type})`
                                      : ""} — skrivs över
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={duplicateTargets.size === 0 || duplicateShift.isPending}
                      onClick={() => {
                        if (!currentShiftType || !currentShiftRow) return;
                        const dateStr = format(sheet.date, "yyyy-MM-dd");
                        const targets = Array.from(duplicateTargets)
                          .map((uid) => {
                            const w = (allWorkers as any[]).find((x) => x.user_id === uid);
                            if (!w) return null;
                            const conflictRow = (schedules as any[]).find(
                              (s) =>
                                s.user_id === uid &&
                                s.date === dateStr &&
                                (s.shift_index ?? 0) === sheet.shiftIndex,
                            );
                            return {
                              userId: uid,
                              name: w.name,
                              conflictRowId: conflictRow?.id,
                              conflictType: conflictRow?.shift_type as ShiftType | undefined,
                            };
                          })
                          .filter(Boolean) as Array<{
                            userId: string;
                            name: string;
                            conflictRowId?: string;
                            conflictType?: ShiftType;
                          }>;
                        if (targets.length === 0) return;
                        setConfirmDuplicate({
                          sourceShiftRowId: currentShiftRow.id,
                          sourceType: currentShiftType,
                          sourceNote: currentShiftRow.note ?? null,
                          fromName: sheet.worker.name,
                          date: dateStr,
                          shiftIndex: sheet.shiftIndex,
                          targets,
                        });
                      }}
                      className="w-full h-11 rounded-xl"
                    >
                      Duplicera
                      {duplicateTargets.size > 0 ? ` (${duplicateTargets.size})` : ""}
                    </Button>
                  </div>
                </div>
              ) : null;

              // Byt medarbetare-väljare (visas endast när det finns ett aktivt pass)
              const ReassignPicker = currentShiftRow ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Byt medarbetare
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flytta hela passet till någon annan. Checklistor, avbockningar och anteckningar
                    följer med.
                  </p>
                  <div className="flex gap-2">
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger className="flex-1 h-11 text-base rounded-xl">
                        <SelectValue placeholder="Välj ny medarbetare" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[50vh]">
                        {(allWorkers as any[])
                          .filter((w) => w.user_id && w.user_id !== sheet.worker.user_id)
                          .map((w) => (
                            <SelectItem key={w.id} value={w.user_id}>
                              {w.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      disabled={!reassignTo || reassignShift.isPending}
                      onClick={() => {
                        const target = (allWorkers as any[]).find((w) => w.user_id === reassignTo);
                        if (!target) return;
                        const dateStr = format(sheet.date, "yyyy-MM-dd");
                        const conflictRow = (schedules as any[]).find(
                          (s) =>
                            s.user_id === reassignTo &&
                            s.date === dateStr &&
                            (s.shift_index ?? 0) === sheet.shiftIndex,
                        );
                        // Om mottagaren har ett pass på samma index men det andra
                        // indexet är ledigt → erbjud dubbelpass istället för att skriva över.
                        const otherIndex: 0 | 1 = sheet.shiftIndex === 0 ? 1 : 0;
                        const otherOccupied = (schedules as any[]).some(
                          (s) =>
                            s.user_id === reassignTo &&
                            s.date === dateStr &&
                            (s.shift_index ?? 0) === otherIndex,
                        );
                        const doubleShiftIndex =
                          conflictRow && !otherOccupied ? otherIndex : undefined;
                        setConfirmReassign({
                          shiftRowId: currentShiftRow.id,
                          fromName: sheet.worker.name,
                          toUserId: reassignTo,
                          toName: target.name,
                          conflictRowId: doubleShiftIndex !== undefined ? undefined : conflictRow?.id,
                          conflictType: conflictRow?.shift_type,
                          doubleShiftIndex,
                        });
                      }}
                      className="h-11 px-4 rounded-xl"
                    >
                      Flytta
                    </Button>
                  </div>
                </div>
              ) : null;

              return hasShift ? (
                <>
                  {StartTimeEditor}
                  {NoteEditor}
                  {currentShiftRow && currentShiftType !== "busy" && (
                    <div>
                      <ShiftChecklists shiftId={currentShiftRow.id} mode="admin" />
                    </div>
                  )}
                  {ReassignPicker && <Separator />}
                  {ReassignPicker}
                  {DuplicatePicker && <Separator />}
                  {DuplicatePicker}
                  <Separator />
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
          {sheet && (
            <div className="modal-footer">
              <Button variant="outline" className="w-full" onClick={() => setSheet(null)}>
                Stäng
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmReassign}
        onOpenChange={(o) => !o && !reassignShift.isPending && setConfirmReassign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Flytta passet till {confirmReassign?.toName}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Hela passet flyttas från{" "}
                  <span className="font-medium text-foreground">
                    {confirmReassign?.fromName}
                  </span>{" "}
                  till{" "}
                  <span className="font-medium text-foreground">
                    {confirmReassign?.toName}
                  </span>
                  . Checklistor, avbockningar och anteckningar följer med automatiskt.
                </p>
                {confirmReassign?.doubleShiftIndex !== undefined && (
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground">
                    Obs: {confirmReassign.toName} har redan ett pass denna dag
                    {confirmReassign.conflictType
                      ? ` (${SHIFT_MAP[confirmReassign.conflictType]?.label ?? confirmReassign.conflictType})`
                      : ""}
                    . Detta pass läggs till som dubbelpass på{" "}
                    Pass {confirmReassign.doubleShiftIndex + 1} — inget skrivs över.
                  </div>
                )}
                {confirmReassign?.conflictRowId && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Obs: {confirmReassign.toName} har redan ett pass denna dag och
                    detta passindex
                    {confirmReassign.conflictType
                      ? ` (${SHIFT_MAP[confirmReassign.conflictType]?.label ?? confirmReassign.conflictType})`
                      : ""}
                    . Det befintliga passet kommer att skrivas över.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reassignShift.isPending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirmReassign) return;
                reassignShift.mutate({
                  shiftRowId: confirmReassign.shiftRowId,
                  toUserId: confirmReassign.toUserId,
                  conflictRowId: confirmReassign.conflictRowId,
                  doubleShiftIndex: confirmReassign.doubleShiftIndex,
                });
              }}
              disabled={reassignShift.isPending}
            >
              {reassignShift.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Flyttar…
                </>
              ) : (
                "Flytta passet"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDuplicate}
        onOpenChange={(o) => !o && !duplicateShift.isPending && setConfirmDuplicate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Duplicera passet till {confirmDuplicate?.targets.length === 1
                ? confirmDuplicate.targets[0].name
                : `${confirmDuplicate?.targets.length ?? 0} medarbetare`}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Samma pass läggs upp på följande från{" "}
                  <span className="font-medium text-foreground">
                    {confirmDuplicate?.fromName}
                  </span>
                  . Checklistor kopieras med tomma avbockningar.
                </p>
                <ul className="rounded-xl border border-border divide-y divide-border text-sm">
                  {confirmDuplicate?.targets.map((t) => (
                    <li key={t.userId} className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">{t.name}</span>
                      {t.conflictRowId && (
                        <span className="text-[11px] text-destructive whitespace-nowrap">
                          Skriver över
                          {t.conflictType
                            ? ` (${SHIFT_MAP[t.conflictType]?.label ?? t.conflictType})`
                            : ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={duplicateShift.isPending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirmDuplicate) return;
                duplicateShift.mutate({
                  sourceShiftRowId: confirmDuplicate.sourceShiftRowId,
                  sourceType: confirmDuplicate.sourceType,
                  sourceNote: confirmDuplicate.sourceNote,
                  date: confirmDuplicate.date,
                  shiftIndex: confirmDuplicate.shiftIndex,
                  targets: confirmDuplicate.targets.map((t) => ({
                    userId: t.userId,
                    conflictRowId: t.conflictRowId,
                  })),
                });
              }}
              disabled={duplicateShift.isPending}
            >
              {duplicateShift.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Duplicerar…
                </>
              ) : (
                confirmDuplicate && confirmDuplicate.targets.length > 1
                  ? `Duplicera till ${confirmDuplicate.targets.length}`
                  : "Duplicera passet"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      <AdminMobileBottomNav active="schema" />
    </div>
  );
};

export default AdminSchedule;

