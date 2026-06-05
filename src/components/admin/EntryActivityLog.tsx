import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  ChevronDown,
  Coffee,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useEntryActivityLogs,
  useUpdateEntryLogNote,
  useUpdateEntryLogChecklist,
  type EntryActivityLogRow,
} from "@/hooks/useEntryActivityLogs";
import { calcWorkedMinutes, sumBreakMinutes } from "@/lib/workedTime";
import { cn } from "@/lib/utils";

interface Props {
  timeEntryId: string;
  clockIn: string;
  clockOut: string | null;
  enabled: boolean;
  /**
   * När true: tillåt inline-redigering av note + checklist-toggling.
   * Tider/rast/kategori går aldrig att redigera här.
   * Default: false (admin-vyn).
   */
  editable?: boolean;
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

const useOnlineStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
};

interface NoteEditorProps {
  log: EntryActivityLogRow;
  timeEntryId: string;
  disabled: boolean;
}

const NoteEditor = ({ log, timeEntryId, disabled }: NoteEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(log.note ?? "");
  const updateNote = useUpdateEntryLogNote();

  useEffect(() => {
    if (!editing) setValue(log.note ?? "");
  }, [log.note, editing]);

  const startEdit = () => {
    setValue(log.note ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setValue(log.note ?? "");
    setEditing(false);
  };

  const save = () => {
    const trimmed = value.trim();
    if (log.requires_note && trimmed.length < 2) {
      toast.error("Den här uppgiften behöver en kort beskrivning");
      return;
    }
    if (trimmed === (log.note ?? "")) {
      setEditing(false);
      return;
    }
    updateNote.mutate(
      { logId: log.id, note: trimmed, timeEntryId },
      {
        onSuccess: () => {
          toast.success("Sparat");
          setEditing(false);
        },
      },
    );
  };

  if (editing) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5">
        <FileText className="h-3.5 w-3.5 mt-2.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              log.requires_note ? "Kort beskrivning..." : "Lägg till en notering..."
            }
            disabled={updateNote.isPending}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") cancel();
            }}
          />
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              className="h-8 px-2"
              onClick={save}
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
              onClick={cancel}
              disabled={updateNote.isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (log.note) {
    return (
      <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="break-words flex-1">{log.note}</span>
        <button
          type="button"
          onClick={startEdit}
          disabled={disabled}
          aria-label="Redigera notering"
          className="shrink-0 p-1 -m-1 rounded hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={startEdit}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Pencil className="h-3 w-3" />
        <span>Lägg till notering</span>
      </button>
    </div>
  );
};

const EntryActivityLog = ({
  timeEntryId,
  clockIn,
  clockOut,
  enabled,
  editable = false,
}: Props) => {
  const { data: logs, isLoading, isFetching } = useEntryActivityLogs(
    timeEntryId,
    enabled,
  );
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());
  const updateChecklist = useUpdateEntryLogChecklist();
  const online = useOnlineStatus();
  const canEdit = editable && online;

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  const endRef = clockOut ?? new Date().toISOString();
  const grossMin = Math.max(
    0,
    Math.round((new Date(endRef).getTime() - new Date(clockIn).getTime()) / 60000),
  );
  const breakLogs = (logs ?? []).map((l) => ({
    started_at: l.started_at,
    ended_at: l.ended_at,
    is_break: l.is_break,
    category_label: l.category_label,
  }));
  const breakMin = sumBreakMinutes(clockIn, endRef, breakLogs);
  const netMin = calcWorkedMinutes(clockIn, endRef, breakLogs);

  const toggleChecklist = (id: string) => {
    setExpandedChecklists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChecklistItem = (
    log: EntryActivityLogRow,
    idx: number,
    done: boolean,
  ) => {
    const current = log.checklist_state ?? [];
    const next = current.map((it, i) => (i === idx ? { ...it, done } : it));
    updateChecklist.mutate({ logId: log.id, state: next, timeEntryId });
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {/* Sammanfattning */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Brutto <span className="text-foreground font-medium">{fmtHours(grossMin)}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Rast{" "}
          <span className="text-foreground font-medium">
            {breakMin > 0 ? fmtHours(breakMin) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Netto <span className="text-primary font-semibold">{fmtHours(netMin)}</span>
        </span>
        {!clockOut && (
          <span className="ml-auto inline-flex items-center gap-1 text-primary text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            pågår
          </span>
        )}
        {isFetching && clockOut && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {editable && !online && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Offline – redigering avstängd
        </div>
      )}

      {/* Loggrader */}
      {!logs || logs.length === 0 ? (
        <div className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
          Ingen logg registrerad
        </div>
      ) : (
        <ul className="space-y-1.5">
          {logs.map((log) => {
            const start = new Date(log.started_at);
            const end = log.ended_at ? new Date(log.ended_at) : null;
            const effectiveEnd = end ?? (clockOut ? new Date(clockOut) : new Date());
            const durMin = Math.max(
              0,
              Math.round((effectiveEnd.getTime() - start.getTime()) / 60000),
            );
            const isOpen = !log.ended_at;
            const checklist = log.checklist_state ?? [];
            const checklistDone = checklist.filter((i) => i.done).length;
            const hasChecklist = checklist.length > 0;
            const checklistExpanded = expandedChecklists.has(log.id);

            return (
              <li
                key={log.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm border",
                  log.is_break
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-muted/40 border-transparent",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.is_break ? (
                      <Coffee className="h-4 w-4 shrink-0" />
                    ) : null}
                    <span className="font-medium truncate">
                      {log.category_label}
                    </span>
                    {log.is_break && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-semibold shrink-0">
                        Rast
                      </span>
                    )}
                  </div>
                  <div className="text-xs whitespace-nowrap opacity-80">
                    {format(start, "HH:mm", { locale: sv })}–
                    {end ? format(end, "HH:mm", { locale: sv }) : "pågår"}
                    <span className="mx-1">·</span>
                    <span className="font-medium">{fmtDur(durMin)}</span>
                    {isOpen && (
                      <span className="ml-1 text-primary font-medium">(pågår)</span>
                    )}
                  </div>
                </div>

                {/* Note: redigerbar i editable-läge, annars läs-visning */}
                {editable && !log.is_break ? (
                  <NoteEditor
                    log={log}
                    timeEntryId={timeEntryId}
                    disabled={!canEdit}
                  />
                ) : (
                  log.note && (
                    <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="break-words">{log.note}</span>
                    </div>
                  )
                )}

                {hasChecklist && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => toggleChecklist(log.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      <span>
                        Checklista {checklistDone}/{checklist.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          checklistExpanded && "rotate-180",
                        )}
                      />
                    </button>
                    {checklistExpanded && (
                      <ul className="mt-1.5 ml-5 space-y-1.5 text-xs">
                        {checklist.map((item, idx) => {
                          if (editable) {
                            const id = `cl-${log.id}-${idx}`;
                            return (
                              <li key={idx} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={item.done}
                                  disabled={!canEdit || updateChecklist.isPending}
                                  onCheckedChange={(v) =>
                                    toggleChecklistItem(log, idx, v === true)
                                  }
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
                          }
                          return (
                            <li
                              key={idx}
                              className={cn(
                                "flex items-center gap-1.5",
                                item.done
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-block h-3 w-3 rounded border",
                                  item.done
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground/40",
                                )}
                              />
                              <span>{item.item}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default EntryActivityLog;
