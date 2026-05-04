import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PAYMENT_LABELS, type PaymentMethod } from "@/hooks/useEveningRoundGuests";

type Template = "standard" | "ekonomi";

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthAgoLocal = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const STATUS_LABELS: Record<string, string> = {
  here: "På plats",
  not_here: "Ej kommit",
};

const csvEscape = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const EveningRoundExportDialog = () => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthAgoLocal());
  const [to, setTo] = useState(todayLocal());
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<Template>("standard");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!from || !to) {
      toast.error("Välj både från- och till-datum");
      return;
    }
    if (from > to) {
      toast.error("Från-datum måste vara före till-datum");
      return;
    }
    setLoading(true);
    try {
      // Hämta gäster vars vistelse överlappar [from, to]
      // Överlapp: arrival_date <= to AND departure_date > from
      let q = supabase
        .from("evening_round_guests")
        .select("*, evening_rounds(round_date, assigned_worker_id, workers:assigned_worker_id(name))")
        .lte("arrival_date", to)
        .gt("departure_date", from)
        .order("arrival_date", { ascending: true })
        .order("place_label", { ascending: true });

      if (name.trim()) {
        q = q.ilike("guest_name", `%${name.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const guests = data ?? [];
      let rows: string[][];
      let filename: string;

      if (template === "ekonomi") {
        // Ekonomirapport: en rad per gäst + summeringar per betalsätt
        rows = [
          ["Datum", "Gäst", "Plats", "Nätter", "Betalsätt", "Belopp (SEK)"],
        ];
        const totals = new Map<string, { count: number; amount: number }>();
        let grandCount = 0;
        let grandAmount = 0;

        guests.forEach((g: any) => {
          const pm = g.payment_method as PaymentMethod | null;
          let pmLabel = pm ? PAYMENT_LABELS[pm] ?? pm : "Saknas";
          if (pm === "O" && g.payment_other_note) pmLabel = `Övrigt: ${g.payment_other_note}`;
          const amount = Number(g.payment_amount ?? 0);
          const arr = new Date(g.arrival_date);
          const dep = new Date(g.departure_date);
          const nights = Math.max(
            1,
            Math.round((dep.getTime() - arr.getTime()) / 86400000),
          );
          rows.push([
            g.arrival_date,
            g.guest_name,
            String(g.place_label),
            String(nights),
            pmLabel,
            amount.toFixed(2).replace(".", ","),
          ]);
          const t = totals.get(pmLabel) ?? { count: 0, amount: 0 };
          t.count += 1;
          t.amount += amount;
          totals.set(pmLabel, t);
          grandCount += 1;
          grandAmount += amount;
        });

        rows.push([]);
        rows.push(["Sammanställning per betalsätt"]);
        rows.push(["Betalsätt", "Antal gäster", "Summa (SEK)"]);
        Array.from(totals.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "sv"))
          .forEach(([label, t]) => {
            rows.push([label, String(t.count), t.amount.toFixed(2).replace(".", ",")]);
          });
        rows.push([]);
        rows.push(["TOTALT", String(grandCount), grandAmount.toFixed(2).replace(".", ",")]);

        filename = `ekonomirapport_${from}_till_${to}.csv`;
      } else {
        // Standard: full operativ vy
        rows = [
          [
            "Plats",
            "Gäst",
            "Reg.nr",
            "Ankomst",
            "Avresa",
            "Status",
            "Betalsätt",
            "Belopp",
            "Rundans datum",
            "Ansvarig",
          ],
        ];
        guests.forEach((g: any) => {
          const round = g.evening_rounds;
          const workerName = round?.workers?.name ?? "";
          const pm = g.payment_method as PaymentMethod | null;
          rows.push([
            String(g.place_label),
            g.guest_name,
            g.registration_number ?? "",
            g.arrival_date,
            g.departure_date,
            STATUS_LABELS[g.status] ?? g.status,
            pm ? (pm === "O" && g.payment_other_note ? `Övrigt: ${g.payment_other_note}` : PAYMENT_LABELS[pm] ?? pm) : "",
            g.payment_amount ?? "",
            round?.round_date ?? "",
            workerName,
          ]);
        });
        filename = `kvallsrundan_${from}_till_${to}.csv`;
      }

      downloadCsv(filename, rows);
      toast.success(`Exporterade ${guests.length} gäster`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte exportera");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Download className="h-4 w-4" />
          Exportera CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportera gäster</DialogTitle>
          <DialogDescription>
            Filtrera på namn och period. Inkluderar alla gäster vars vistelse överlappar perioden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="export-template">Mall</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger id="export-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard – operativ vy</SelectItem>
                <SelectItem value="ekonomi">Ekonomirapport – betalsätt &amp; summor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {template === "ekonomi"
                ? "Innehåller belopp per gäst och summering per betalsätt."
                : "Innehåller alla operativa fält: status, plats, ansvarig m.m."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-name">Gästnamn (valfritt)</Label>
            <Input
              id="export-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sök del av namn…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="export-from">Från</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="ÅÅÅÅ-MM-DD"
                className="input-datetime"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="export-to">Till</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="ÅÅÅÅ-MM-DD"
                className="input-datetime"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Avbryt
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EveningRoundExportDialog;
