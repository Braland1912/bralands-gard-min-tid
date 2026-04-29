import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

type Props = {
  workerId: string;
  /** Visa beräknad lön. Döljs på worker-vyn (timlönen är hemlig där). */
  showPay?: boolean;
  /** Timlön för lönberäkning. Krävs om showPay=true. */
  hourlyRate?: number;
};

type TimeEntry = {
  clock_in: string | null;
  clock_out: string | null;
};

const formatHours = (h: number) => {
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${mm.toString().padStart(2, "0")}m`;
};

const formatSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

const MonthlySummary = ({ workerId, showPay = false, hourlyRate = 0 }: Props) => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["monthly-summary-entries", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .eq("worker_id", workerId)
        .not("clock_in", "is", null)
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
    enabled: !!workerId,
  });

  const months = useMemo(() => {
    const map = new Map<string, { hours: number; days: Set<string> }>();
    entries.forEach((e) => {
      if (!e.clock_in || !e.clock_out) return;
      const start = new Date(e.clock_in);
      const end = new Date(e.clock_out);
      const monthKey = format(start, "yyyy-MM"); // local time
      const dayKey = format(start, "yyyy-MM-dd");
      const hours = (end.getTime() - start.getTime()) / 3600000;
      const cur = map.get(monthKey) ?? { hours: 0, days: new Set<string>() };
      cur.hours += hours;
      cur.days.add(dayKey);
      map.set(monthKey, cur);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => {
        const [y, m] = key.split("-").map(Number);
        const date = new Date(y, m - 1, 1);
        return {
          key,
          label: format(date, "LLLL yyyy", { locale: sv }),
          hours: v.hours,
          days: v.days.size,
          pay: v.hours * (hourlyRate || 0),
        };
      });
  }, [entries, hourlyRate]);

  if (isLoading) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">Laddar månadssammanställning…</Card>
    );
  }

  if (months.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground text-center">
        Inga registrerade timmar ännu.
      </Card>
    );
  }

  const defaultOpen = months[0]?.key;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen}
      className="rounded-xl border bg-card divide-y"
    >
      {months.map((m) => (
        <AccordionItem key={m.key} value={m.key} className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <span className="font-medium capitalize text-foreground">{m.label}</span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge variant="secondary" className="font-mono text-xs">
                  {formatHours(m.hours)}
                </Badge>
                {showPay && hourlyRate > 0 && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10 font-mono text-xs">
                    {formatSEK(m.pay)}
                  </Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Totala timmar</dt>
              <dd className="text-right font-medium">{formatHours(m.hours)}</dd>

              <dt className="text-muted-foreground">Arbetsdagar</dt>
              <dd className="text-right font-medium">{m.days} st</dd>

              {showPay && hourlyRate > 0 && (
                <>
                  <dt className="text-muted-foreground">Beräknad lön</dt>
                  <dd className="text-right font-medium">{formatSEK(m.pay)}</dd>
                  <dt className="text-muted-foreground text-xs">Timlön</dt>
                  <dd className="text-right text-xs text-muted-foreground">
                    {formatSEK(hourlyRate)}/h
                  </dd>
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default MonthlySummary;
