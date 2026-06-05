import { useMemo, useState } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Coffee,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useActivityLogs,
  useTaskCategories,
  useUpdateActivityNote,
  useUpdateChecklistState,
  useUpdateActivityTimes,
  useDeleteActivityLog,
  useAddManualActivityLog,
  type ActivityLog,
} from "@/hooks/useActivityLog";
import {
  calcWorkedMinutes,
  sumBreakMinutes,
  isBreakLog,
  type BreakInterval,
} from "@/lib/workedTime";

interface Props {
  timeEntryId: string;
  workerId: string;
  clockIn: string;
  isOnline: boolean;
  checklistUnchecked: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onOpenChecklist?: () => void;
}

const fmtDur = (mins: number) => {
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const fmtHours = (mins: number) =>
  (mins / 60).toFixed(2).replace(".", ",") + " h";

const toTimeInput = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const combineDateTime = (baseIso: string, hhmm: string) => {
  const base = new Date(baseIso);
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return d.toISOString();
};

const clamp = (iso: string, minIso: string, maxIso: string) => {
  const t = new Date(iso).getTime();
  const lo = new Date(minIso).getTime();
  const hi = new Date(maxIso).getTime();
  return new Date(Math.min(Math.max(t, lo), hi)).toISOString();
};

interface EnrichedLog extends ActivityLog {
  requires_note: boolean;
}

interface LogRowProps {
  log: EnrichedLog;
  timeEntryId: string;
  clockIn: string;
  nowIso: string;
  disabled: boolean;
}

const LogRow = ({ log, timeEntryId, clockIn, nowIso, disabled }: LogRowProps) => {
  const [editingTimes, setEditingTimes] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [startVal, setStartVal] = useState(toTimeInput(log.started_at));
  const [endVal, setEndVal] = useState(
    log.ended_at ? toTimeInput(log.ended_at) : toTimeInput(nowIso),
  );
  const [noteVal, setNoteVal] = useState(log.note ?? "");

  const updateTimes = useUpdateActivityTimes();
  const updateNote = useUpdateActivityNote();
  const updateChecklist = useUpdateChecklistState();
  const deleteLog = useDeleteActivityLog();

  const isBreak = isBreakLog(log);
  const start = new Date(log.started_at);
  const end = log.ended_at ? new Date(log.ended_at) : new Date(nowIso);
  const durMin = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000),
  );
  const checklist = log.checklist_state ?? [];
  const checklistDone = checklist.filter((i) => i.done).length;
  const hasChecklist = checklist.length > 0;
  const isOpen = !log.ended_at;
  const missingNote = log.requires_note && !isBreak && !log.note;

  const saveTimes = () => {
    const newStart = combineDateTime(log.started_at, startVal);
    const newEnd = log.ended_at
      ? combineDateTime(log.ended_at, endVal)
      : combineDateTime(nowIso, endVal);

    if (new Date(newEnd).getTime() < new Date(newStart).getTime()) {
      toast.error("Sluttid kan inte vara före starttid");
      return;
    }
    const clampedStart = clamp(newStart, clockIn, nowIso);
    const clampedEnd = clamp(newEnd, clockIn, nowIso);

    updateTimes.mutate(
      {
        logId: log.id,
        started_at: clampedStart,
        ended_at: log.ended_at ? clampedEnd : null,
        timeEntryId,
      },
      {
        onSuccess: () => {
          toast.success("Tid uppdaterad");
          setEditingTimes(false);
        },
        onError: () => toast.error("Kunde inte spara tid"),
      },
    );
  };

  const saveNote = () => {
    updateNote.mutate(
      { logId: log.id, note: noteVal.trim(), timeEntryId },
      {
        onSuccess: () => {
          toast.success("Sparat");
          setEditingNote(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirm(`Ta bort "${log.category_label}"?`)) return;
    deleteLog.mutate(
      { logId: log.id, timeEntryId },
      {
        onSuccess: () => toast.success("Borttagen"),
        onError: () => toast.error("Kunde inte ta bort"),
      },
    );
  };

  const toggleItem = (idx: number, done: boolean) => {
    const next = checklist.map((it, i) => (i === idx ? { ...it, done } : it));
    updateChecklist.mutate({ logId: log.id, state: next, timeEntryId });
  };

  return (
    <li
      className={cn(
        "rounded-xl px-3 py-2.5 text-sm border",
        isBreak
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : missingNote
            ? "bg-destructive/5 border-destructive/40"
            : "bg-muted/40 border-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {isBreak && <Coffee className="h-4 w-4 shrink-0" />}
          <span className="font-medium truncate">{log.category_label}</span>
          {isBreak && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-semibold shrink-0">
              Rast
            </span>
          )}
          {isOpen && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold shrink-0">
              pågår
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled || deleteLog.isPending}
          aria-label="Ta bort"
          className="shrink-0 p-1 -m-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {editingTimes ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Input
            type="time"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
            disabled={updateTimes.isPending}
            className="input-datetime h-8 w-[6.5rem] text-xs"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="time"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
            disabled={updateTimes.isPending}
            className="input-datetime h-8 w-[6.5rem] text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-2"
            onClick={saveTimes}
            disabled={updateTimes.isPending}
          >
            {updateTimes.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => {
              setEditingTimes(false);
              setStartVal(toTimeInput(log.started_at));
              setEndVal(
                log.ended_at ? toTimeInput(log.ended_at) : toTimeInput(nowIso),
              );
            }}
            disabled={updateTimes.isPending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="opacity-80">
            {format(start, "HH:mm", { locale: sv })}–
            {log.ended_at ? format(end, "HH:mm", { locale: sv }) : "nu"}
            <span className="mx-1">·</span>
            <span className="font-medium">{fmtDur(durMin)}</span>
          </span>
          <button
            type="button"
            onClick={() => setEditingTimes(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Pencil className="h-3 w-3" />
            <span>Tid</span>
          </button>
        </div>
      )}

      {!isBreak && (
        editingNote ? (
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              autoFocus
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              placeholder="Kort beskrivning..."
              disabled={updateNote.isPending}
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveNote();
                }
                if (e.key === "Escape") setEditingNote(false);
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 px-2"
              onClick={saveNote}
              disabled={updateNote.isPending}
            >
              {updateNote.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => {
                setEditingNote(false);
                setNoteVal(log.note ?? "");
              }}
              disabled={updateNote.isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : log.note ? (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-words flex-1">{log.note}</span>
            <button
              type="button"
              onClick={() => {
                setNoteVal(log.note ?? "");
                setEditingNote(true);
              }}
              disabled={disabled}
              aria-label="Redigera notering"
              className="shrink-0 p-1 -m-1 rounded hover:bg-muted/60 disabled:opacity-40"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            disabled={disabled}
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 text-xs hover:text-foreground disabled:opacity-40",
              missingNote ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
            <Pencil className="h-3 w-3" />
            <span>{missingNote ? "Beskrivning krävs" : "Lägg till notering"}</span>
          </button>
        )
      )}

      {hasChecklist && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowChecklist((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>Checklista {checklistDone}/{checklist.length}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showChecklist && "rotate-180",
              )}
            />
          </button>
          {showChecklist && (
            <ul className="mt-1.5 ml-5 space-y-1.5 text-xs">
              {checklist.map((item, idx) => {
                const id = `clr-${log.id}-${idx}`;
                return (
                  <li key={idx} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={item.done}
                      disabled={disabled || updateChecklist.isPending}
                      onCheckedChange={(v) => toggleItem(idx, v === true)}
                      className="h-4 w-4"
                    />
                    <label
                      htmlFor={id}
                      className={cn(
                        "cursor-pointer flex-1",
                        item.done
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {item.item}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

interface AddTaskFormProps {
  timeEntryId: string;
  workerId: string;
  clockIn: string;
  nowIso: string;
  defaultStartIso: string;
  onDone: () => void;
}

const AddTaskForm = ({
  timeEntryId,
  workerId,
  clockIn,
  nowIso,
  defaultStartIso,
  onDone,
}: AddTaskFormProps) => {
  const { data: categories = [] } = useTaskCategories();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startVal, setStartVal] = useState(toTimeInput(defaultStartIso));
  const [endVal, setEndVal] = useState(toTimeInput(nowIso));
  const [note, setNote] = useState("");
  const add = useAddManualActivityLog();

  const selected = categories.find((c) => c.id === selectedId);

  const handleAdd = () => {
    if (!selected) {
      toast.error("Välj en uppgift");
      return;
    }
    if (selected.requires_note && note.trim().length < 2) {
      toast.error("Den här uppgiften behöver en kort beskrivning");
      return;
    }
    const startIso = clamp(
      combineDateTime(defaultStartIso, startVal),
      clockIn,
      nowIso,
    );
    const endIso = clamp(
      combineDateTime(nowIso, endVal),
      clockIn,
      nowIso,
    );
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      toast.error("Sluttid kan inte vara före starttid");
      return;
    }
    add.mutate(
      {
        timeEntryId,
        workerId,
        category: selected,
        started_at: startIso,
        ended_at: endIso,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Uppgift tillagd");
          onDone();
        },
        onError: () => toast.error("Kunde inte lägga till"),
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Lägg till uppgift
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              selectedId === c.id
                ? c.is_break
                  ? "bg-amber-100 border-amber-300 text-amber-900"
                  : "bg-primary text-primary-foreground border-primary"
                : c.is_break
                  ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  : "bg-background border-border hover:bg-muted",
            )}
          >
            {c.is_break && <Coffee className="inline h-3 w-3 mr-1 -mt-0.5" />}
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="time"
          value={startVal}
          onChange={(e) => setStartVal(e.target.value)}
          className="input-datetime h-9 w-[6.5rem] text-xs"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="time"
          value={endVal}
          onChange={(e) => setEndVal(e.target.value)}
          className="input-datetime h-9 w-[6.5rem] text-xs"
        />
      </div>

      {selected && !selected.is_break && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            selected.requires_note
              ? "Kort beskrivning (krävs)..."
              : "Notering (valfritt)..."
          }
          className="h-9 text-xs"
        />
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!selected || add.isPending}
          className="flex-1"
        >
          {add.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Lägg till
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={add.isPending}
        >
          Avbryt
        </Button>
      </div>
    </div>
  );
};

const ClockOutReview = ({
  timeEntryId,
  workerId,
  clockIn,
  isOnline,
  checklistUnchecked,
  onConfirm,
  onCancel,
  onOpenChecklist,
}: Props) => {
  const { data: logs = [], isLoading } = useActivityLogs(timeEntryId);
  const { data: categories = [] } = useTaskCategories();
  const [adding, setAdding] = useState(false);
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const nowIso = useMemo(
    () => new Date().toISOString(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs.length, logs.map((l) => l.ended_at ?? "").join("|")],
  );

  const enrichedLogs: EnrichedLog[] = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return logs.map((l) => ({
      ...l,
      requires_note: l.category_id
        ? map.get(l.category_id)?.requires_note ?? false
        : false,
    }));
  }, [logs, categories]);

  const breakLogs: BreakInterval[] = logs.map((l) => ({
    started_at: l.started_at,
    ended_at: l.ended_at,
    category_label: l.category_label,
  }));

  const grossMin = Math.max(
    0,
    Math.round(
      (new Date(nowIso).getTime() - new Date(clockIn).getTime()) / 60000,
    ),
  );
  const breakMin = sumBreakMinutes(clockIn, nowIso, breakLogs);
  const netMin = calcWorkedMinutes(clockIn, nowIso, breakLogs);

  const missingNoteRows = enrichedLogs.filter(
    (l) => l.requires_note && !isBreakLog(l) && !l.note,
  );

  const hasLogs = logs.length > 0;
  const canConfirm =
    isOnline &&
    !confirming &&
    (hasLogs || confirmedEmpty) &&
    missingNoteRows.length === 0;

  const lastEnded = [...logs]
    .filter((l) => l.ended_at)
    .sort(
      (a, b) =>
        new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime(),
    )[0];
  const defaultStart = lastEnded?.ended_at ?? clockIn;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Snyggt jobbat! Kolla snabbt att dagen stämmer.
      </p>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-around gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Brutto
            </p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {fmtHours(grossMin)}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Rast
            </p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {breakMin > 0 ? fmtHours(breakMin) : "—"}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Netto
            </p>
            <p className="text-base font-bold text-primary tabular-nums">
              {fmtHours(netMin)}
            </p>
          </div>
        </div>
      </div>

      {checklistUnchecked > 0 && (
        <button
          type="button"
          onClick={onOpenChecklist}
          className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                {checklistUnchecked} obockade{" "}
                {checklistUnchecked === 1 ? "punkt" : "punkter"} på dagens
                checklistor
              </p>
              <p className="text-xs text-amber-700">
                Du kan stämpla ut ändå — tryck för att öppna.
              </p>
            </div>
          </div>
        </button>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dagens logg
          </p>
          {hasLogs && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={!isOnline}
              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Lägg till
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline" />
          </div>
        ) : !hasLogs ? (
          <div className="rounded-xl bg-muted/40 px-3 py-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Ingen logg registrerad idag
            </p>
            <label className="flex items-center justify-center gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={confirmedEmpty}
                onCheckedChange={(v) => setConfirmedEmpty(v === true)}
              />
              <span>Jag loggade inget idag</span>
            </label>
            {!adding && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(true)}
                disabled={!isOnline}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Lägg till uppgift
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
            {enrichedLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                timeEntryId={timeEntryId}
                clockIn={clockIn}
                nowIso={nowIso}
                disabled={!isOnline}
              />
            ))}
          </ul>
        )}

        {adding && (
          <AddTaskForm
            timeEntryId={timeEntryId}
            workerId={workerId}
            clockIn={clockIn}
            nowIso={nowIso}
            defaultStartIso={defaultStart}
            onDone={() => setAdding(false)}
          />
        )}
      </div>

      {missingNoteRows.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {missingNoteRows.length === 1
            ? "En uppgift behöver en kort beskrivning innan du kan stämpla ut."
            : `${missingNoteRows.length} uppgifter behöver en kort beskrivning innan du kan stämpla ut.`}
        </div>
      )}

      {!isOnline && (
        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Offline — du måste vara online för att stämpla ut.
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sticky bottom-0 bg-background">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={confirming}
          className="sm:flex-1"
        >
          Avbryt
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="sm:flex-[2] h-11"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Bekräfta och stämpla ut"
          )}
        </Button>
      </div>
    </div>
  );
};

export default ClockOutReview;
