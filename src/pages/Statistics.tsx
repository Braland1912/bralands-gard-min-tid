import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { BarChart3, Download, Loader2, Lock, Link2, KeyRound } from "lucide-react";
import { exportCsv, exportPdf, exportXlsx, num, type Sheet } from "@/lib/stats-export";

type Report = any;

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];
const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
};
const fmtMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const DEFINITIONS: [string, string][] = [
  ["Registrerade bokningar", "Antal gästrader som lagts in i kvällsrundan under säsongen – alltså antal bokningar/platser som registrerats, inte antal nätter. En familj som står 7 nätter räknas som 1 bokning."],
  ["Gästnätter totalt", "Summan av alla nätter för alla bokningar (avresedatum minus ankomstdatum). En bokning på 7 nätter ger 7 gästnätter. Det är detta mått som visar hur beläggningen egentligen sett ut över tid."],
  ["Gästnätter med status \"här\"", "De gästnätter som tillhör gäster markerade som incheckade (status \"här\") i kvällsrundan. Skillnaden mot totalen är gäster som ännu inte checkats in eller som aldrig fick statusen uppdaterad."],
  ["Snitt per natt", "Gästnätter totalt delat på antalet aktiva dygn (dygn med minst en gäst) under säsongen."],
  ["Toppnatt", "Det datum då flest gäster sov på campingen samtidigt (högst antal gästnätter ett enskilt dygn)."],
  ["Ankomster", "Antal bokningar med ankomstdatum den dagen/veckan."],
  ["Intäkt rundan (SEK/EUR)", "Summa av alla belopp som registrerats på kvällsrundan – både vid gästregistrering och i sammanställningarna (kiosk m.m.)."],
  ["Kvällsrundor genomförda", "Antal kvällsrundor som startats under säsongen."],
  ["Sammanställningar (ekonomi)", "Antal avslutade kvällsrundor där en ekonomisammanställning (kassa/kiosk) har redovisats."],
];

const buildSheets = (r: Report): Sheet[] => [
  {
    name: "Definitioner",
    columns: ["Begrepp", "Förklaring"],
    rows: DEFINITIONS.map(([a, b]) => [a, b]),
  },
  {
    name: "Översikt",
    columns: ["Nyckeltal", "Värde"],
    rows: [
      ["Period", `${r.season.from ?? "-"} – ${r.season.to ?? "-"}`],
      ["Registrerade bokningar", num(r.kpis.bookings)],
      ["Gästnätter totalt", num(r.kpis.totalNights)],
      ["Gästnätter med status här", num(r.kpis.totalNightsHere)],
      ["Snitt gästnätter per natt", num(r.kpis.avgPerNight, 1)],
      ["Toppnatt", `${r.kpis.topNightDate ?? "-"} (${num(r.kpis.topNightNights)})`],
      ["Intäkt SEK", num(r.kpis.revenueSEK)],
      ["Intäkt EUR", num(r.kpis.revenueEUR)],
      ["Kvällsrundor genomförda", num(r.kpis.rounds)],
      ["Sammanställningar (ekonomi)", num(r.kpis.summaries)],
    ],
  },
  {
    name: "Per vecka",
    columns: ["Vecka", "Från", "Till", "Gästnätter", "Snitt/natt", "Ankomster", "Intäkt SEK"],
    rows: r.weekly.map((w: any) => [
      `v${w.week}`,
      w.from,
      w.to,
      num(w.nights),
      num(w.avgPerNight, 1),
      num(w.arrivals),
      num(w.revenueSEK),
    ]),
  },
  {
    name: "Per dag",
    columns: ["Datum", "Veckodag", "Gästnätter", "Här", "Ankomster", "Avresor", "Intäkt SEK"],
    rows: r.daily.map((d: any) => [
      d.date,
      fmtDate(d.date).split(" ")[0],
      num(d.nights),
      num(d.nightsHere),
      num(d.arrivals),
      num(d.departures),
      num(d.revenueSEK),
    ]),
  },
  {
    name: "Per månad",
    columns: ["Månad", "Gästnätter", "Snitt/natt", "Ankomster", "Intäkt SEK"],
    rows: r.monthly.map((m: any) => [
      fmtMonth(m.month),
      num(m.nights),
      num(m.avgPerNight, 1),
      num(m.arrivals),
      num(m.revenueSEK),
    ]),
  },
  {
    name: "Nationalitet",
    columns: ["Land", "Bokningar", "Gästnätter"],
    rows: r.nationalities.map((n: any) => [n.label, num(n.bookings), num(n.nights)]),
  },
  {
    name: "Betalsätt",
    columns: ["Betalsätt", "Antal", "Summa SEK", "Summa EUR"],
    rows: r.payments.map((p: any) => [p.label, num(p.count), num(p.sek), num(p.eur)]),
  },
  {
    name: "Medarbetare",
    columns: [
      "Medarbetare",
      "Kvällsrundor",
      "Gäster registrerade",
      "Kortbetalningar",
      "Redovisningar",
      "Kioskposter",
      "Kiosk SEK",
      "Intäkt SEK",
    ],
    rows: r.workers.map((w: any) => [
      w.name,
      num(w.rounds),
      num(w.guestsRegistered),
      num(w.cardPayments),
      num(w.summaries),
      num(w.kioskItems),
      num(w.kioskAmount),
      num(w.revenueSEK),
    ]),
  },
  {
    name: "Kiosk & ekonomi",
    columns: ["Datum", "Medarbetare", "Kategori", "Notering", "Antal", "Belopp", "Valuta"],
    rows: r.kiosk.entries.map((e: any) => [
      e.date,
      e.worker,
      e.category,
      e.note,
      num(e.quantity),
      num(e.amount),
      e.currency,
    ]),
  },
];

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

const Statistics = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (pw?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("stats-report", {
        body: pw ? { password: pw } : {},
      });
      if (fnError) throw fnError;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport(data);
      if (pw) sessionStorage.setItem("stats_pw", pw);
    } catch (e: any) {
      setError("Fel lösenord eller kunde inte hämta statistiken.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminLoading) return;
    const saved = sessionStorage.getItem("stats_pw");
    if (isAdmin) fetchReport();
    else if (saved) fetchReport(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoading, isAdmin]);

  const sheets = useMemo(() => (report ? buildSheets(report) : []), [report]);

  const doExport = (kind: "csv" | "xlsx" | "pdf") => {
    if (!report) return;
    const name = `braland-statistik-${report.season.from ?? ""}-${report.season.to ?? ""}`;
    if (kind === "csv") exportCsv(sheets, name);
    else if (kind === "xlsx") exportXlsx(sheets, name);
    else
      exportPdf(sheets, name, {
        title: "Statistik – Bråland Gård Camping",
        subtitle: `Säsongen ${report.season.from ?? ""} – ${report.season.to ?? ""}`,
      });
  };

  const saveSharePassword = async () => {
    if (newPassword.trim().length < 6) {
      toast.error("Minst 6 tecken");
      return;
    }
    const hash = await sha256Hex(newPassword.trim());
    const { error: upErr } = await supabase
      .from("app_settings")
      .upsert(
        { key: "stats_share_password", value: { password_sha256: hash } },
        { onConflict: "key" },
      );
    if (upErr) toast.error("Kunde inte spara lösenordet");
    else {
      toast.success("Delningslösenordet uppdaterat");
      setNewPassword("");
    }
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-4 w-4" /> Statistik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ange lösenordet du fått för att se campingens statistik.
            </p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchReport(password)}
              placeholder="Lösenord"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={() => fetchReport(password)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Visa statistik"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = report;

  return (
    <div className="min-h-screen bg-background">
      <main className="p-5 pb-nav-safe md:pb-8 max-w-5xl mx-auto w-full space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Statistik camping
            </h1>
            <p className="text-sm text-muted-foreground">
              Säsongen {r.season.from} – {r.season.to}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                <Download className="h-4 w-4" /> Exportera
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doExport("pdf")}>PDF – presentation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Gästnätter totalt" value={num(r.kpis.totalNights)} sub={`${num(r.kpis.totalNightsHere)} med status här`} />
          <Kpi label="Snitt per natt" value={num(r.kpis.avgPerNight, 1)} sub={`${num(r.kpis.activeDays)} aktiva dygn`} />
          <Kpi label="Bokningar" value={num(r.kpis.bookings)} sub={`Toppnatt ${r.kpis.topNightDate ?? "-"}: ${num(r.kpis.topNightNights)}`} />
          <Kpi label="Intäkt rundan" value={`${num(r.kpis.revenueSEK)} kr`} sub={r.kpis.revenueEUR ? `+ ${num(r.kpis.revenueEUR)} EUR` : undefined} />
        </div>

        <Tabs defaultValue="vecka">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="vecka">Vecka</TabsTrigger>
            <TabsTrigger value="dag">Dag</TabsTrigger>
            <TabsTrigger value="manad">Månad</TabsTrigger>
            <TabsTrigger value="gaster">Gäster</TabsTrigger>
            <TabsTrigger value="medarbetare">Medarbetare</TabsTrigger>
            <TabsTrigger value="kiosk">Kiosk</TabsTrigger>
            <TabsTrigger value="analys">Analys</TabsTrigger>
          </TabsList>

          <TabsContent value="vecka" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gästnätter per vecka</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vecka</TableHead>
                      <TableHead className="hidden sm:table-cell">Period</TableHead>
                      <TableHead className="text-right">Gästnätter</TableHead>
                      <TableHead className="text-right">Snitt/natt</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Ankomster</TableHead>
                      <TableHead className="text-right">Intäkt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.weekly.map((w: any) => (
                      <TableRow key={`${w.year}-${w.week}`}>
                        <TableCell className="font-medium">v{w.week}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {fmtDate(w.from)} – {fmtDate(w.to)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{num(w.nights)}</TableCell>
                        <TableCell className="text-right">{num(w.avgPerNight, 1)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{num(w.arrivals)}</TableCell>
                        <TableCell className="text-right">{num(w.revenueSEK)} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dag" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gästnätter per dag</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Gästnätter</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Här</TableHead>
                      <TableHead className="text-right">Ank.</TableHead>
                      <TableHead className="text-right">Avr.</TableHead>
                      <TableHead className="text-right">Intäkt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.daily.map((d: any) => (
                      <TableRow key={d.date}>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">{fmtDate(d.date)}</span>{" "}
                          <span className="text-muted-foreground text-xs">{d.date}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{num(d.nights)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{num(d.nightsHere)}</TableCell>
                        <TableCell className="text-right">{num(d.arrivals)}</TableCell>
                        <TableCell className="text-right">{num(d.departures)}</TableCell>
                        <TableCell className="text-right">{num(d.revenueSEK)} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manad" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Månad</TableHead>
                      <TableHead className="text-right">Gästnätter</TableHead>
                      <TableHead className="text-right">Snitt/natt</TableHead>
                      <TableHead className="text-right">Ankomster</TableHead>
                      <TableHead className="text-right">Intäkt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.monthly.map((m: any) => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium capitalize">{fmtMonth(m.month)}</TableCell>
                        <TableCell className="text-right font-semibold">{num(m.nights)}</TableCell>
                        <TableCell className="text-right">{num(m.avgPerNight, 1)}</TableCell>
                        <TableCell className="text-right">{num(m.arrivals)}</TableCell>
                        <TableCell className="text-right">{num(m.revenueSEK)} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gaster" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nationalitet</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Land</TableHead>
                      <TableHead className="text-right">Bokningar</TableHead>
                      <TableHead className="text-right">Gästnätter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.nationalities.map((n: any) => (
                      <TableRow key={n.code}>
                        <TableCell>{n.label}</TableCell>
                        <TableCell className="text-right">{num(n.bookings)}</TableCell>
                        <TableCell className="text-right font-semibold">{num(n.nights)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Betalsätt</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Betalsätt</TableHead>
                      <TableHead className="text-right">Antal</TableHead>
                      <TableHead className="text-right">Summa SEK</TableHead>
                      <TableHead className="text-right">EUR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.payments.map((p: any) => (
                      <TableRow key={p.code}>
                        <TableCell>{p.label}</TableCell>
                        <TableCell className="text-right">{num(p.count)}</TableCell>
                        <TableCell className="text-right">{num(p.sek)}</TableCell>
                        <TableCell className="text-right">{num(p.eur)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medarbetare" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medarbetare</TableHead>
                      <TableHead className="text-right">Rundor</TableHead>
                      <TableHead className="text-right">Gäster</TableHead>
                      <TableHead className="text-right">Kortbet.</TableHead>
                      <TableHead className="text-right">Redovisn.</TableHead>
                      <TableHead className="text-right">Kiosk kr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.workers.map((w: any) => (
                      <TableRow key={w.name}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right">{num(w.rounds)}</TableCell>
                        <TableCell className="text-right">{num(w.guestsRegistered)}</TableCell>
                        <TableCell className="text-right">{num(w.cardPayments)}</TableCell>
                        <TableCell className="text-right">{num(w.summaries)}</TableCell>
                        <TableCell className="text-right">{num(w.kioskAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kiosk" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Redovisat per kategori</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Poster</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.kiosk.totals.map((t: any) => (
                      <TableRow key={t.category}>
                        <TableCell>{t.category}</TableCell>
                        <TableCell className="text-right">{num(t.count)}</TableCell>
                        <TableCell className="text-right font-semibold">{num(t.amount)} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Alla redovisningar</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Vem</TableHead>
                      <TableHead>Vad</TableHead>
                      <TableHead className="text-right">Belopp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.kiosk.entries.map((e: any, i: number) => (
                      <TableRow key={`${e.date}-${i}`}>
                        <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                        <TableCell>{e.worker}</TableCell>
                        <TableCell>
                          {e.category}
                          {e.note ? ` – ${e.note}` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {num(e.amount)} {e.currency}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analys" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Analys och förbättringsförslag</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-foreground">
                <div>
                  <p className="font-medium">Säsongen är extremt toppig</p>
                  <p className="text-muted-foreground">
                    Nästan hela volymen ligger i juli och första halvan av augusti. Veckorna före
                    midsommar och efter vecka 33 ligger på en bråkdel av toppveckorna. Prissätt
                    lågsäsong lägre och rikta erbjudanden mot husbilsgäster i maj, juni och
                    september – marginalkostnaden per gäst är låg när platserna ändå står tomma.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Nationalitet fylls i alldeles för sällan</p>
                  <p className="text-muted-foreground">
                    Majoriteten av bokningarna saknar land. Gör fältet obligatoriskt på rundan – då
                    kan ni se vilka marknader som växer och lägga marknadsföringen där.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Förenkla betalsätten</p>
                  <p className="text-muted-foreground">
                    Ett par betalsätt står för nästan allt, medan flera används enstaka gånger. Färre
                    val ger snabbare runda och färre avstämningsfel.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Nyckeltal att följa framåt</p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                    <li>Beläggningsgrad: gästnätter delat med antal platser × dygn.</li>
                    <li>Intäkt per gästnatt och per plats – visar om prissättningen håller.</li>
                    <li>Snittvistelse i nätter – längre vistelser sänker arbetsbelastningen.</li>
                    <li>Andel förbetalda vs betalning på plats – styr kassahantering.</li>
                    <li>Andel rundor med komplett ekonomiredovisning.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Dela statistiken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Skicka länken nedan tillsammans med lösenordet. Mottagaren behöver inget konto.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/statistik`} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/statistik`);
                    toast.success("Länk kopierad");
                  }}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-pw">Nytt delningslösenord</Label>
                <div className="flex gap-2">
                  <Input
                    id="share-pw"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minst 6 tecken"
                  />
                  <Button onClick={saveSharePassword}>Spara</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Statistics;
