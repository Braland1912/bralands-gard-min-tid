import { useEffect, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle } from "lucide-react";

type CheckResult = { label: string; status: "pass" | "fail" | "warn"; detail: string };

const NATIONS = [
  "Sverige", "Norge", "Danmark", "Finland", "Tyskland", "Polen",
  "Litauen", "Lettland", "Estland", "Spanien", "Italien", "Övrigt",
];

const MobileMenuTest = () => {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [openOverlay, setOpenOverlay] = useState<string | null>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);

  // Kör automatiska kontroller
  const runChecks = () => {
    const out: CheckResult[] = [];

    // 1) Viewport meta
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
    out.push({
      label: "Viewport meta innehåller width=device-width",
      status: /width=device-width/i.test(meta) ? "pass" : "fail",
      detail: meta || "(saknas)",
    });

    // 2) Trigger-fontstorlek (iOS zoom-skydd: ≥16px på mobil)
    const trigger = sampleTriggerRef.current;
    if (trigger) {
      const fs = parseFloat(getComputedStyle(trigger).fontSize);
      out.push({
        label: "Select-trigger har ≥16px font (iOS zoom-skydd)",
        status: fs >= 16 ? "pass" : "fail",
        detail: `${fs}px`,
      });
    }

    // 3) Skärmstorlek
    out.push({
      label: "Skärmbredd",
      status: window.innerWidth <= 430 ? "pass" : "warn",
      detail: `${window.innerWidth} × ${window.innerHeight}px`,
    });

    // 4) Kontrollera att touch-targets är ≥44px (öppna ej menyn först)
    if (trigger) {
      const h = trigger.getBoundingClientRect().height;
      out.push({
        label: "Trigger-höjd ≥44px (touch-target)",
        status: h >= 44 ? "pass" : "fail",
        detail: `${Math.round(h)}px`,
      });
    }

    setResults(out);
  };

  useEffect(() => {
    runChecks();
  }, []);

  // Mät öppen overlay för att se om den klipps
  useEffect(() => {
    if (!openOverlay) return;
    const timer = setTimeout(() => {
      const portals = document.querySelectorAll(
        "[data-radix-popper-content-wrapper], [data-radix-select-content], [data-radix-popover-content], [data-radix-dropdown-menu-content]",
      );
      const out: CheckResult[] = [];
      portals.forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const offLeft = r.left < 0;
        const offRight = r.right > window.innerWidth;
        const offTop = r.top < 0;
        const offBottom = r.bottom > window.innerHeight;
        const clipped = offLeft || offRight || offTop || offBottom;
        out.push({
          label: `${openOverlay}: position`,
          status: clipped ? "fail" : "pass",
          detail: clipped
            ? `klipps (${offLeft ? "vänster " : ""}${offRight ? "höger " : ""}${
                offTop ? "topp " : ""
              }${offBottom ? "botten" : ""})`
            : `inom skärm (${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(
                r.width,
              )}×${Math.round(r.height)})`,
        });
      });
      if (out.length) setResults((prev) => [...prev.filter((r) => !r.label.startsWith(openOverlay + ":")), ...out]);
    }, 150);
    return () => clearTimeout(timer);
  }, [openOverlay]);

  const StatusIcon = ({ s }: { s: CheckResult["status"] }) => {
    if (s === "pass") return <Check className="h-4 w-4 text-green-600" />;
    if (s === "fail") return <X className="h-4 w-4 text-red-600" />;
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-32 max-w-xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Mobiltestläge — menyer</h1>
        <p className="text-sm text-muted-foreground">
          Verifiera att Select, Popover, DropdownMenu och Command fungerar utan iOS-zoom och utan att
          klippas av skärmkanten.
        </p>
      </header>

      {/* Resultat */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Automatiska kontroller
          </h2>
          <Button size="sm" variant="outline" onClick={runChecks} className="h-9 rounded-lg">
            Kör om
          </Button>
        </div>
        <ul className="space-y-1.5">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <StatusIcon s={r.status} />
              <div className="flex-1">
                <div className="text-foreground">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.detail}</div>
              </div>
            </li>
          ))}
          {results.length === 0 && (
            <li className="text-sm text-muted-foreground">Kör kontrollerna ovan.</li>
          )}
        </ul>
      </section>

      {/* Manuella tester i hörn */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Manuella tester
        </h2>

        {/* Vänster — Select */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Select (vänster kant)</p>
          <Select onOpenChange={(o) => setOpenOverlay(o ? "Select" : null)}>
            <SelectTrigger ref={sampleTriggerRef} aria-label="Välj nation" className="h-12 rounded-xl">
              <SelectValue placeholder="Välj nation" />
            </SelectTrigger>
            <SelectContent>
              {NATIONS.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Höger — DropdownMenu */}
        <div className="flex justify-end">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">DropdownMenu (höger kant)</p>
            <DropdownMenu onOpenChange={(o) => setOpenOverlay(o ? "DropdownMenu" : null)}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 rounded-xl">
                  Öppna meny
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {NATIONS.map((n) => (
                  <DropdownMenuItem key={n}>{n}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Popover med Command */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Popover + Command (sökbar combobox)</p>
          <Popover onOpenChange={(o) => setOpenOverlay(o ? "Popover" : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 rounded-xl w-full justify-start">
                Sök nation…
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[calc(100vw-2rem)] sm:w-72">
              <Command>
                <CommandInput placeholder="Skriv för att filtrera…" />
                <CommandList>
                  <CommandEmpty>Inga träffar.</CommandEmpty>
                  <CommandGroup>
                    {NATIONS.map((n) => (
                      <CommandItem key={n} value={n}>
                        {n}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Nära botten — testa att menyn flippar uppåt */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 mt-40">
          <p className="text-sm font-medium">Select nära botten (ska flippa uppåt)</p>
          <Select onOpenChange={(o) => setOpenOverlay(o ? "Select-bottom" : null)}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Välj nation" />
            </SelectTrigger>
            <SelectContent>
              {NATIONS.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <footer className="text-xs text-muted-foreground text-center pt-4">
        Tips: byt till mobil-vy via enhetsväljaren ovanför förhandsvisningen för att testa på 375px.
      </footer>
    </div>
  );
};

export default MobileMenuTest;
