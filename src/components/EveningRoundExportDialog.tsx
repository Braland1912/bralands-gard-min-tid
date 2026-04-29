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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PAYMENT_LABELS, type PaymentMethod } from "@/hooks/useEveningRoundGuests";

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
  here: "Här",
  checked_out: "Utcheckad",
  not_here: "Inte här",
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
        .order("place_number", { ascending: true });

      if (name.trim()) {
        q = q.ilike("guest_name", `%${name.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows: string[][] = [
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

      (data ?? []).forEach((g: any) => {
        const round = g.evening_rounds;
        const workerName = round?.workers?.name ?? "";
        const pm = g.payment_method as PaymentMethod | null;
        rows.push([
          g.place_number,
          g.guest_name,
          g.registration_number ?? "",
          g.arrival_date,
          g.departure_date,
          STATUS_LABELS[g.status] ?? g.status,
          pm ? PAYMENT_LABELS[pm] ?? pm : "",
          g.payment_amount ?? "",
          round?.round_date ?? "",
          workerName,
        ]);
      });

      const filename = `kvallsrundan_${from}_till_${to}.csv`;
      downloadCsv(filename, rows);
      toast.success(`Exporterade ${data?.length ?? 0} gäster`);
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
            <Label htmlFor="export-name">Gästnamn (valfritt)</Label>
            <Input
              id="export-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sök del av namn…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-from">Från</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-to">Till</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
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
