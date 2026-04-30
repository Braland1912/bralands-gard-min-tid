import { useEffect, useRef, useState } from "react";
import { Moon, ChevronRight, CheckCircle2, Circle, AlertCircle, Check, X, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * Fristående mobiltest för kvällsrundans widget på iPhone SE (375x667).
 * Renderar tre scenarier med mock-data och kör automatiska kontroller på
 * träffyta, klippning och tap-target. Kräver INTE inloggning.
 */

type Scenario = "empty" | "ongoing" | "done";

type CheckResult = { label: string; status: "pass" | "fail" | "warn"; detail: string };

interface MockProps {
  scenario: Scenario;
  testId: string;
  onClick?: () => void;
}

// Ren visuell kopia av EveningRoundWidget (utan Supabase-anrop) för isolerad test.
const MockWidget = ({ scenario, testId, onClick }: MockProps) => {
  const data = (() => {
    switch (scenario) {
      case "empty":
        return {
          total: 0,
          here: 0,
          checkedOut: 0,
          notHere: 0,
          handled: 0,
          latestName: null as string | null,
          latestTime: null as string | null,
          startTime: null as string | null,
          endTime: null as string | null,
          isOngoing: false,
        };
      case "ongoing":
        return {
          total: 45,
          here: 17,
          checkedOut: 26,
          notHere: 2,
          handled: 28,
          latestName: "Eva Andersson-Lindgren",
          latestTime: "18:32",
          startTime: "18:32",
          endTime: null,
          isOngoing: true,
        };
      case "done":
        return {
          total: 45,
          here: 0,
          checkedOut: 43,
          notHere: 2,
          handled: 45,
          latestName: "Fina K",
          latestTime: "18:47",
          startTime: "18:32",
          endTime: "18:47",
          isOngoing: false,
        };
    }
  })();

  const statusDot =
    data.total === 0
      ? "bg-muted-foreground/40"
      : data.handled === data.total
        ? "bg-[hsl(150_30%_45%)]"
        : "bg-[hsl(38_75%_50%)]";

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-label="Öppna kvällsrundan"
      className="group w-full text-left border rounded-2xl p-4 bg-[hsl(260_30%_97%)] border-[hsl(260_25%_88%)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[hsl(260_25%_90%)] flex items-center justify-center shrink-0">
          <Moon className="h-4 w-4 text-[hsl(260_30%_38%)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Kvällsrundan ikväll</h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
          </div>

          {data.total === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">Inga gäster registrerade för ikväll.</p>
          ) : (
            <>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-semibold tabular-nums text-[hsl(260_30%_28%)]">
                  {data.handled}/{data.total}
                </span>
                <span className="text-xs text-muted-foreground">avbockade</span>
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Circle className="h-3 w-3 text-[hsl(183_25%_45%)] fill-[hsl(183_25%_45%)]" />
                  <span className="tabular-nums font-medium text-foreground">{data.here}</span> kvar
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[hsl(150_30%_45%)]" />
                  <span className="tabular-nums font-medium text-foreground">{data.checkedOut}</span> ut
                </span>
                {data.notHere > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-[hsl(8_55%_55%)]" />
                    <span className="tabular-nums font-medium text-foreground">{data.notHere}</span> inte här
                  </span>
                )}
              </div>
            </>
          )}

          <div className="mt-2.5 space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden />
              {data.latestTime && data.latestName ? (
                <span className="text-muted-foreground">
                  {data.isOngoing ? "Pågår" : "Runda gjord"}{" "}
                  <span className="tabular-nums font-medium text-foreground">{data.latestTime}</span> av{" "}
                  <span className="font-medium text-foreground">{data.latestName}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Ingen runda startad ännu</span>
              )}
            </div>
            {data.startTime && (
              <div className="pl-3 text-muted-foreground">
                Senaste session:{" "}
                <span className="tabular-nums font-medium text-foreground">{data.startTime}</span>
                {" – "}
                {data.endTime ? (
                  <span className="tabular-nums font-medium text-foreground">{data.endTime}</span>
                ) : (
                  <span className="font-medium text-[hsl(38_75%_40%)]">pågår</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

const EveningRoundWidgetTest = () => {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [tapLog, setTapLog] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const log = (msg: string) =>
    setTapLog((prev) => [`${new Date().toLocaleTimeString("sv")} – ${msg}`, ...prev].slice(0, 10));

  const runChecks = () => {
    const out: CheckResult[] = [];
    const ids: Scenario[] = ["empty", "ongoing", "done"];

    ids.forEach((id) => {
      const el = document.querySelector<HTMLButtonElement>(`[data-testid="widget-${id}"]`);
      if (!el) {
        out.push({ label: `Scenario "${id}" finns`, status: "fail", detail: "Hittades inte i DOM" });
        return;
      }
      const r = el.getBoundingClientRect();

      // Tap target (>= 44px iOS minimum)
      out.push({
        label: `${id}: knappens höjd >= 44px`,
        status: r.height >= 44 ? "pass" : "fail",
        detail: `${Math.round(r.height)}px`,
      });

      // Inom 375px
      out.push({
        label: `${id}: ryms inom 375px`,
        status: r.left >= 0 && r.right <= 375.5 ? "pass" : "fail",
        detail: `left=${Math.round(r.left)} right=${Math.round(r.right)}`,
      });

      // Ingen horisontell overflow (scrollWidth <= clientWidth)
      out.push({
        label: `${id}: ingen text-clipping`,
        status: el.scrollWidth <= el.clientWidth + 1 ? "pass" : "fail",
        detail: `scrollW=${el.scrollWidth} clientW=${el.clientWidth}`,
      });

      // Endast EN klickbar yta (inga nästlade buttons -> inga felträffar)
      const nestedButtons = el.querySelectorAll("button, a, [role='button']").length;
      out.push({
        label: `${id}: inga nästlade klickytor`,
        status: nestedButtons === 0 ? "pass" : "fail",
        detail: `${nestedButtons} hittade`,
      });

      // Statusprickar är aria-hidden (ingen felträff för screen readers)
      const dots = el.querySelectorAll("[aria-hidden='true']");
      out.push({
        label: `${id}: statusprick aria-hidden`,
        status: dots.length >= 1 ? "pass" : "warn",
        detail: `${dots.length} dolda dekorelement`,
      });
    });

    // Viewport
    out.push({
      label: "Sida ryms i 375px (ingen horisontell scroll)",
      status: document.documentElement.scrollWidth <= 376 ? "pass" : "fail",
      detail: `scrollW=${document.documentElement.scrollWidth}`,
    });

    setResults(out);
  };

  useEffect(() => {
    const t = setTimeout(runChecks, 200);
    return () => clearTimeout(t);
  }, []);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Mobiltest – Kvällsrundan widget</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Optimerad för iPhone SE (375×667). Tryck på korten för att verifiera tap-area.
        </p>
      </header>

      <div ref={containerRef} className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Scenario 1: Inga gäster</p>
          <MockWidget scenario="empty" testId="widget-empty" onClick={() => log("Tryck på 'empty'")} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Scenario 2: Pågående runda (lång namn)</p>
          <MockWidget scenario="ongoing" testId="widget-ongoing" onClick={() => log("Tryck på 'ongoing'")} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Scenario 3: Klar runda</p>
          <MockWidget scenario="done" testId="widget-done" onClick={() => log("Tryck på 'done'")} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Button onClick={runChecks} size="sm">
          Kör om kontroller
        </Button>
        <span className="text-xs text-muted-foreground">
          {passCount} ok · {failCount} fel · {warnCount} varning
        </span>
      </div>

      <section className="mt-4 border rounded-xl p-3 bg-card">
        <h2 className="text-sm font-semibold mb-2">Automatiska kontroller</h2>
        <ul className="space-y-1.5">
          {results.length === 0 ? (
            <li className="text-xs text-muted-foreground">Kör tester…</li>
          ) : (
            results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {r.status === "pass" && <Check className="h-3.5 w-3.5 text-[hsl(150_30%_38%)] shrink-0 mt-0.5" />}
                {r.status === "fail" && <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                {r.status === "warn" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{r.label}</div>
                  <div className="text-muted-foreground tabular-nums">{r.detail}</div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-4 border rounded-xl p-3 bg-card">
        <h2 className="text-sm font-semibold mb-2">Tap-logg</h2>
        {tapLog.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Inga tryck ännu.</p>
        ) : (
          <ul className="space-y-1 text-xs text-muted-foreground tabular-nums">
            {tapLog.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default EveningRoundWidgetTest;
