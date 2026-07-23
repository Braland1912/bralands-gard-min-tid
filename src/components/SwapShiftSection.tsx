import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeftRight, Calendar as CalendarIcon, Phone, MessageSquare, Loader2, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SwapShiftSectionProps {
  workerId?: string;
  userId?: string;
}

type Candidate = { name: string; phone: string | null; status: string };

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SwapShiftSection({ workerId, userId }: SwapShiftSectionProps) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hämta användarens egna kommande pass — datumväljaren begränsas inte men chips visas
  const { data: myShifts = [] } = useQuery({
    queryKey: ["my-upcoming-shifts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = toIso(new Date());
      const { data, error } = await supabase
        .from("schedules")
        .select("date, shift_type")
        .eq("user_id", userId!)
        .gte("date", today)
        .in("shift_type", ["morning", "day", "evening", "evening_a", "evening_b", "fishing", "clearing"])
        .order("date", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isoDate = date ? toIso(date) : null;
  const matchingShift = useMemo(
    () => myShifts.find((s: any) => s.date === isoDate),
    [myShifts, isoDate],
  );

  const swapQuery = useQuery({
    queryKey: ["swap-candidates", isoDate, workerId, matchingShift?.shift_type],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("find-swap-candidates", {
        body: {
          date: isoDate,
          requesterWorkerId: workerId,
          requesterShiftType: matchingShift?.shift_type,
        },
      });
      if (error) throw error;
      return data as { candidates: Candidate[]; smsDraft: string };
    },
  });

  const handleSearch = async () => {
    if (!isoDate) {
      toast({ title: "Välj ett datum först" });
      return;
    }
    setHasSearched(true);
    await swapQuery.refetch();
  };

  const handleCopySms = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const buildSms = (candidateName: string) => {
    const draft = swapQuery.data?.smsDraft ?? "";
    if (draft) return draft.replace(/\{namn\}/gi, candidateName.split(" ")[0]);
    if (!isoDate) return "";
    const dateNice = format(new Date(isoDate + "T00:00:00"), "EEEE d MMMM", { locale: sv });
    return `Hej ${candidateName.split(" ")[0]}! Skulle du kunna ta mitt pass ${dateNice}?`;
  };

  return (
    <section>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Byt pass</h2>
            <p className="text-[11px] text-muted-foreground">
              Hitta kollegor som är lediga en viss dag
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-10 flex-1 justify-start font-normal text-sm",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                {date
                  ? format(date, "EEE d MMM yyyy", { locale: sv })
                  : "Välj datum"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                mode="single"
                locale={sv}
                weekStartsOn={1}
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setHasSearched(false);
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={!date || swapQuery.isFetching}
            className="h-10"
          >
            {swapQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Hitta"
            )}
          </Button>
        </div>

        {myShifts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {myShifts.slice(0, 5).map((s: any) => {
              const sDate = new Date(s.date + "T00:00:00");
              const active = isoDate === s.date;
              return (
                <button
                  key={s.date + s.shift_type}
                  onClick={() => {
                    setDate(sDate);
                    setHasSearched(false);
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent",
                  )}
                >
                  {format(sDate, "EEE d/M", { locale: sv })}
                </button>
              );
            })}
          </div>
        )}

        {hasSearched && swapQuery.data && (
          <div className="space-y-2 pt-1">
            {swapQuery.data.smsDraft && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    SMS-förslag
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => handleCopySms(swapQuery.data!.smsDraft)}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Kopierat" : "Kopiera"}
                  </Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {swapQuery.data.smsDraft}
                </p>
              </div>
            )}

            {swapQuery.data.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                Inga kollegor är lediga den dagen.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-background">
                {swapQuery.data.candidates.map((c) => (
                  <li key={c.name} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.status}</div>
                    </div>
                    {c.phone ? (
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label={`Ring ${c.name}`}
                        >
                          <a href={`tel:${c.phone.replace(/\s+/g, "")}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label={`SMS ${c.name}`}
                        >
                          <a
                            href={`sms:${c.phone.replace(/\s+/g, "")}?body=${encodeURIComponent(buildSms(c.name))}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic shrink-0">
                        Inget nummer
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasSearched && swapQuery.error && (
          <p className="text-xs text-destructive">Kunde inte hämta förslag. Försök igen.</p>
        )}
      </div>
    </section>
  );
}
