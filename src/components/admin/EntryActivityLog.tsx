import { useState } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronDown, Coffee, FileText, ListChecks, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntryActivityLogs } from "@/hooks/useEntryActivityLogs";
import { calcWorkedMinutes, sumBreakMinutes } from "@/lib/workedTime";
import { cn } from "@/lib/utils";

interface Props {
  timeEntryId: string;
  clockIn: string;
  clockOut: string | null;
  enabled: boolean;
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

const EntryActivityLog = ({ timeEntryId, clockIn, clockOut, enabled }: Props) => {
  const { data: logs, isLoading, isFetching } = useEntryActivityLogs(
    timeEntryId,
    enabled,
  );
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());

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

                {log.note && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="break-words">{log.note}</span>
                  </div>
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
                      <ul className="mt-1 ml-5 space-y-0.5 text-xs">
                        {checklist.map((item, idx) => (
                          <li
                            key={idx}
                            className={cn(
                              "flex items-center gap-1.5",
                              item.done
                                ? "text-foreground"
                                : "text-muted-foreground line-through-none",
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
                        ))}
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
