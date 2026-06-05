import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ListChecks, Loader2, Coffee } from "lucide-react";
import { toast } from "sonner";
import {
  useTaskCategories,
  useActivityLogs,
  useSwitchTask,
  useUpdateChecklistState,
  type TaskCategory,
  type ActivityLog,
  type ChecklistStateItem,
} from "@/hooks/useActivityLog";

interface Props {
  timeEntryId: string;
  workerId: string;
  isOnline: boolean;
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

const ActivityLogger = ({ timeEntryId, workerId, isOnline }: Props) => {
  const { data: categories, isLoading: catsLoading } = useTaskCategories();
  const { data: logs, isLoading: logsLoading } = useActivityLogs(timeEntryId);
  const switchTask = useSwitchTask();
  const updateChecklist = useUpdateChecklistState();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [noteCategory, setNoteCategory] = useState<TaskCategory | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const openLog: ActivityLog | undefined = useMemo(
    () => logs?.find((l) => l.ended_at === null),
    [logs],
  );

  const handleChipClick = (cat: TaskCategory) => {
    if (!isOnline || switchTask.isPending) return;
    if (openLog?.category_id === cat.id) return; // no-op same chip

    if (cat.requires_note) {
      setNoteCategory(cat);
      setNoteText("");
      return;
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

  const submitNote = () => {
    if (!noteCategory) return;
    const trimmed = noteText.trim();
    if (trimmed.length < 2) {
      toast.error("Skriv en kort beskrivning");
      return;
    }
    switchTask.mutate(
      {
        timeEntryId,
        workerId,
        category: noteCategory,
        note: trimmed,
        currentOpenId: openLog?.id ?? null,
      },
      {
        onSuccess: () => {
          setNoteCategory(null);
          setNoteText("");
        },
        onError: (e: any) => {
          toast.error("Kunde inte spara", { description: e?.message });
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-snug">
        Kul att du är på plats! Tryck på det du jobbar med så håller vi koll på tiderna åt dig.
      </p>

      {/* Chips */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vad gör du nu?
        </p>
        <div className="flex flex-wrap gap-2">
          {categories?.map((cat) => {
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

      {/* Note input for requires_note */}
      {noteCategory && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {noteCategory.label} – vad behövde gästen hjälp med?
          </p>
          <div className="flex gap-2">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Kort beskrivning..."
              autoFocus
              disabled={switchTask.isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNote();
              }}
            />
            <Button
              onClick={submitNote}
              disabled={switchTask.isPending || noteText.trim().length < 2}
            >
              {switchTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Spara"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setNoteCategory(null);
                setNoteText("");
              }}
              disabled={switchTask.isPending}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}

      {/* Active checklist */}
      {openLog && openLog.checklist_state && openLog.checklist_state.length > 0 && (
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
      {logs && logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dagens uppgifter
          </p>
          <ul className="space-y-1.5">
            {logs.map((l) => {
              const isOpen = l.ended_at === null;
              const checkTotal = l.checklist_state?.length ?? 0;
              const checkDone = l.checklist_state?.filter((s) => s.done).length ?? 0;
              return (
                <li
                  key={l.id}
                  className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                    isOpen
                      ? "bg-primary/10 text-primary font-medium"
                      : "bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="tabular-nums text-xs opacity-80 shrink-0">
                    {formatTime(l.started_at)}
                    {l.ended_at ? `–${formatTime(l.ended_at)}` : "–nu"}
                  </span>
                  <span className="flex-1 truncate">
                    {l.category_label}
                    {l.note ? <span className="opacity-70"> · {l.note}</span> : null}
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
