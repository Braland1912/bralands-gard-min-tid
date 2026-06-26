import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ListChecks, Coffee, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  useTaskCategories,
  useActivityLogs,
  useSwitchTask,
  useUpdateChecklistState,
  useUpdateActivityNote,
  useCloseOpenActivityLog,
  type TaskCategory,
  type ActivityLog,
  type ChecklistStateItem,
} from "@/hooks/useActivityLog";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  timeEntryId: string;
  workerId: string;
  isOnline: boolean;
  /** Visa uppgiftsknappar + dagens uppgifter. Rast-knappen visas alltid. */
  showTasks?: boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

const formatDuration = (start: string, end: string | null, nowMs: number) => {
  const endMs = end ? new Date(end).getTime() : nowMs;
  const mins = Math.max(0, Math.round((endMs - new Date(start).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const ActivityLogger = ({ timeEntryId, workerId, isOnline, showTasks = true }: Props) => {
  const { data: categories, isLoading: catsLoading } = useTaskCategories();
  const { data: logs, isLoading: logsLoading } = useActivityLogs(timeEntryId);
  const switchTask = useSwitchTask();
  const updateChecklist = useUpdateChecklistState();
  const updateNote = useUpdateActivityNote();
  const closeOpen = useCloseOpenActivityLog();
  const qc = useQueryClient();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const noteInputRef = useRef<HTMLInputElement | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteLogId, setNoteLogId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const openLog: ActivityLog | undefined = useMemo(
    () => logs?.find((l) => l.ended_at === null),
    [logs],
  );

  // Category for current open log
  const openCategory = useMemo(
    () => (openLog ? categories?.find((c) => c.id === openLog.category_id) : undefined),
    [openLog, categories],
  );

  const needsNote = !!openLog && !!openCategory?.requires_note;

  // Sync note draft when active requires_note log changes
  useEffect(() => {
    if (needsNote && openLog) {
      if (noteLogId !== openLog.id) {
        setNoteLogId(openLog.id);
        setNoteDraft(openLog.note ?? "");
      }
    } else {
      setNoteLogId(null);
      setNoteDraft("");
    }
  }, [needsNote, openLog, noteLogId]);

  const flushSave = (logId: string, value: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const trimmed = value.trim();
    const current = logs?.find((l) => l.id === logId);
    if (!current) return;
    if ((current.note ?? "") === trimmed) return;
    updateNote.mutate({ logId, note: trimmed, timeEntryId });
  };

  const handleNoteChange = (val: string) => {
    setNoteDraft(val);
    if (!noteLogId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (noteLogId) flushSave(noteLogId, val);
    }, 700);
  };

  const handleChipClick = (cat: TaskCategory) => {
    if (!isOnline || switchTask.isPending) return;
    if (openLog?.category_id === cat.id) return; // no-op same chip

    // Block switching if currently on a requires_note task without note filled
    if (openLog && openCategory?.requires_note) {
      const trimmed = noteDraft.trim();
      if (trimmed.length < 2) {
        toast.error("Skriv en kort beskrivning först", {
          description: `${openCategory.label} behöver en kort notering innan du byter uppgift.`,
        });
        noteInputRef.current?.focus();
        return;
      }
      // Make sure the latest draft is persisted before switching
      flushSave(openLog.id, noteDraft);
    }

    switchTask.mutate(
      {
        timeEntryId,
        workerId,
        category: cat,
        currentOpenId: openLog?.id ?? null,
      },
      {
        onError: (e: any) => {
          toast.error("Kunde inte byta uppgift", { description: e?.message });
        },
      },
    );
  };

  const toggleChecklistItem = (log: ActivityLog, item: string, checked: boolean) => {
    const state: ChecklistStateItem[] = (log.checklist_state ?? []).map((s) =>
      s.item === item ? { ...s, done: checked } : s,
    );
    updateChecklist.mutate({ logId: log.id, state, timeEntryId });
  };

  if (catsLoading || logsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-12 w-32 rounded-xl" />
          <Skeleton className="h-12 w-28 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
      </div>
    );
  }

  const workCategories = categories?.filter((c) => !c.is_break) ?? [];
  const breakCategory = categories?.find((c) => c.is_break);

  return (
    <div className="space-y-4">
      {showTasks && (
        <p className="text-sm text-muted-foreground leading-snug">
          Kul att du är på plats! Tryck på det du jobbar med så håller vi koll på tiderna åt dig.
        </p>
      )}

      {/* Chips */}
      {showTasks && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vad gör du nu?
          </p>
          <div className="flex flex-wrap gap-2">
            {workCategories.map((cat) => {
              const active = openLog?.category_id === cat.id;
              return (
                <Button
                  key={cat.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  disabled={!isOnline || switchTask.isPending}
                  onClick={() => handleChipClick(cat)}
                  className={`min-h-12 px-4 py-3 rounded-xl text-sm font-medium ${
                    active ? "shadow-sm" : ""
                  }`}
                >
                  {cat.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rast */}
      {breakCategory && (() => {
        const breakActive = openLog?.category_id === breakCategory.id;
        return (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Paus
            </p>
            <Button
              type="button"
              disabled={!isOnline || switchTask.isPending || closeOpen.isPending}
              onClick={async () => {
                if (breakActive) {
                  try {
                    await closeOpen.mutateAsync(workerId);
                    await qc.invalidateQueries({ queryKey: ["activity-logs", timeEntryId] });
                  } catch (e: any) {
                    toast.error("Kunde inte avsluta rast", { description: e?.message });
                  }
                } else {
                  handleChipClick(breakCategory);
                }
              }}
              className={`min-h-12 px-4 py-3 rounded-xl text-sm font-medium gap-2 border ${
                breakActive
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
              }`}
            >
              <Coffee className="h-4 w-4" />
              {breakActive ? "Avsluta rast" : "Rast"}
            </Button>
          </div>
        );
      })()}

      {/* Inline note for active requires_note task */}
      {showTasks && needsNote && openLog && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">
              {openCategory?.label} – vad behövde gästen hjälp med?
            </p>
          </div>
          <Input
            ref={noteInputRef}
            value={noteDraft}
            onChange={(e) => handleNoteChange(e.target.value)}
            onBlur={() => noteLogId && flushSave(noteLogId, noteDraft)}
            placeholder="Kort beskrivning..."
            disabled={!isOnline}
          />
          <p className="text-xs text-muted-foreground">
            Sparas automatiskt. Behövs innan du byter uppgift eller stämplar ut.
          </p>
        </div>
      )}

      {/* Active checklist */}
      {showTasks && openLog && openLog.checklist_state && openLog.checklist_state.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{openLog.category_label}</p>
          </div>
          <ul className="space-y-2">
            {openLog.checklist_state.map((s) => (
              <li key={s.item} className="flex items-center gap-3">
                <Checkbox
                  id={`al-${openLog.id}-${s.item}`}
                  checked={s.done}
                  disabled={!isOnline}
                  onCheckedChange={(v) => toggleChecklistItem(openLog, s.item, v === true)}
                  className="h-5 w-5"
                />
                <label
                  htmlFor={`al-${openLog.id}-${s.item}`}
                  className={`text-sm cursor-pointer flex-1 ${
                    s.done ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {s.item}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline */}
      {showTasks && logs && logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dagens uppgifter
          </p>
          <ul className="space-y-1.5">
            {logs.map((l) => {
              const isOpen = l.ended_at === null;
              const isBreak = l.category_label === "Rast";
              const checkTotal = l.checklist_state?.length ?? 0;
              const checkDone = l.checklist_state?.filter((s) => s.done).length ?? 0;
              const displayNote = isOpen && l.id === noteLogId ? noteDraft : l.note;
              return (
                <li
                  key={l.id}
                  className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                    isBreak
                      ? isOpen
                        ? "bg-amber-100 text-amber-900 font-medium"
                        : "bg-amber-50 text-amber-900"
                      : isOpen
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-muted/40 text-foreground"
                  }`}
                >
                  {isBreak && <Coffee className="h-3.5 w-3.5 shrink-0" />}
                  <span className="tabular-nums text-xs opacity-80 shrink-0">
                    {formatTime(l.started_at)}
                    {l.ended_at ? `–${formatTime(l.ended_at)}` : "–nu"}
                  </span>
                  <span className="flex-1 truncate">
                    {l.category_label}
                    {displayNote ? <span className="opacity-70"> · {displayNote}</span> : null}
                  </span>
                  {checkTotal > 0 && (
                    <span className="text-xs tabular-nums opacity-80 shrink-0">
                      {checkDone}/{checkTotal}
                    </span>
                  )}
                  <span className="text-xs tabular-nums opacity-80 shrink-0">
                    {formatDuration(l.started_at, l.ended_at, nowMs)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ActivityLogger;
