import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const CleaningHelp = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          h1, h2, h3 { break-after: avoid; }
          section, .keep-together { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/help");
            }}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Skriv ut
          </Button>
        </div>

        <header className="space-y-1 border-b border-border pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Brålands Gård 2026 · Städning
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Städrutiner – så gör vi rent på riktigt
          </h1>
          <p className="text-sm text-muted-foreground">
            Läs igenom en gång så du får hela idén. Sen kan du använda listorna
            som checklista när du städar.
          </p>
        </header>

        {/* GRUNDORDNING */}
        <section className="space-y-3 keep-together">
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Vår grundordning – följ alltid stegen i ordning
            </p>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              1 → 2 → 3 → 4
            </h2>
            <ol className="space-y-2.5 text-sm text-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">1</span>
                <span className="pt-0.5">
                  <strong>Damma av</strong> uppifrån och ner med en{" "}
                  <strong>torr mikrofiberduk</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">2</span>
                <span className="pt-0.5">
                  <strong>Såpa</strong> med ljummet vatten och skrubbsvamp (ej på
                  glas/metall). Torka av med en <strong>blöt Wettex-trasa</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">3</span>
                <span className="pt-0.5">
                  <strong>Diskmedel</strong> i ljummet vatten <em>eller</em>{" "}
                  badrumsspray (ibland kallad sanitetsspray) med Wettex eller
                  mikrofiberduk.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">4</span>
                <span className="pt-0.5">
                  <strong>Ytdesinficera</strong> med vatten + ättika eller
                  färdig ytdesinfektion. Torka av med mikrofiberduk.
                </span>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground pt-1">
              Kom ihåg: <strong>fett löser fett</strong> – därför funkar såpa
              nästan överallt. Men <strong>inte</strong> på glas och metall –
              där tar vi diskmedel istället, annars blir det randigt.
            </p>
          </div>
        </section>

        {/* DAMMA AV */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Så dammar du av på rätt sätt
          </h2>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Regel nr 1: uppifrån och ner</p>
            <p>
              Damm faller alltid neråt. Så börjar du på golvet får du bara städa
              om allting. Jobba i den här ordningen:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong>Högst upp först:</strong> lampor, gardinstänger,
                ovansidan av garderober och skåp.
              </li>
              <li>
                <strong>Mellanhöjd:</strong> hyllor, tavlor, tv-bänkar,
                fönsterbrädor.
              </li>
              <li>
                <strong>Lister och lågt:</strong> golvlister, elkontakter,
                sockellister.
              </li>
              <li>
                <strong>Sist:</strong> dammsug och moppa golvet (kommer i eget
                avsnitt längre ner).
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Verktyg – välj rätt</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Torr mikrofiberduk</strong> är bäst. Materialet är
                statiskt och drar åt sig dammet istället för att sprida det.
              </li>
              <li>
                <strong>Använd inte dammvippa.</strong> Den bara virvlar upp
                dammet så det landar på nytt.
              </li>
              <li>
                Sitter dammet fast (t.ex. i kök): fukta duken lätt med vatten.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 keep-together">
            <p className="font-semibold mb-1">Bra att tänka på</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Skaka aldrig ur trasan inomhus – gå ut.</li>
              <li>Byt eller skölj mikrofiberduken när den känns full av damm.</li>
              <li>
                Ett husmorstrick: torka en gång med vatten + några droppar
                sköljmedel gör ytan lite antistatisk så dammet inte fastnar lika
                snabbt igen.
              </li>
            </ul>
          </div>
        </section>

        {/* METALL */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Metall – blandare, kranar och detaljer
          </h2>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Standard: ljummet vatten + diskmedel</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Torka av med en <strong>mikrofiberduk</strong> fuktad med
                ljummet vatten och några droppar diskmedel.
              </li>
              <li>
                <strong>Torka torrt direkt</strong> med en ren duk – annars blir
                det kalkfläckar.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Envis kalk? Använd svag ättikslösning</p>
            <p>
              Blanda i en sprayflaska:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Ca <strong>2,5 dl ättika/ättiksprit (24–40 %)</strong>
              </li>
              <li>
                <strong>1 liter vatten</strong>
              </li>
              <li>En liten <strong>skvätt diskmedel</strong></li>
            </ul>
            <p>
              Spraya, låt verka en kort stund, skrubba lätt, <strong>skölj noga</strong>{" "}
              och torka torrt.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Svarta/lackerade blandare – extra försiktigt</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Svarta detaljer har en tunn ytbeläggning som lätt får repor.
              </li>
              <li>
                Använd <strong>samma metod som för rostfritt</strong>, men var
                extra noga att <strong>eftertorka helt torrt</strong>.
              </li>
              <li>Torka gärna av efter varje användning så det inte hinner bli kalk.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground keep-together">
            <p className="font-semibold text-destructive mb-1">Använd aldrig</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Slipande svampar (gröna skursidan)</li>
              <li>Blekmedel</li>
              <li>Ammoniakbaserade produkter</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Är du osäker – fråga hellre en gång för mycket.
            </p>
          </div>
        </section>

        {/* TRASOR */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">
            Trasor – vad används till vad?
          </h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Torr mikrofiberduk</strong> – damning uppifrån och ner.
              </li>
              <li>
                <strong>Fuktig mikrofiberduk</strong> – blanka ytor, metall,
                glas, speglar.
              </li>
              <li>
                <strong>Wettex-trasa</strong> – torka bort såpvatten och rengöra
                bänkar/ytor.
              </li>
              <li>
                <strong>Blå och gröna Wettex</strong> – enbart för toalett. Blanda
                aldrig ihop med andra ytor.
              </li>
              <li>
                <strong>Skrubbsvamp (mjuka sidan)</strong> – för såpa på
                tåligare ytor. Aldrig på blankt/metall/glas.
              </li>
            </ul>
          </div>
        </section>

        {/* GROVSTÄDNING */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Grovstädning – väggar, golv och lister
          </h2>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Steg 1 – Dammsugning (kommer före moppning)</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong>Spindelnät i tak &amp; väggar</strong> – ta bort
                munstycket och dammsug direkt med röret.
              </li>
              <li>
                <strong>Damm på smala ytor</strong> – lister, fönsterbrädor,
                brevlåda, hörn, glipan mellan tvättmaskin och vägg.
              </li>
              <li>
                <strong>Lyft undan allt</strong> från golvet, eller ställ ut:
                soptunnor, toaborste, tvättkorg, pallar, moppar, svarta bordet
                osv.
              </li>
              <li>
                <strong>Mattor först</strong> – dammsug dem på plats, bär sedan
                ut. Tvätta om det behövs.
              </li>
              <li>
                <strong>Hela golvet</strong> – dammsug in i alla hörn och under
                där du kommer åt.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground keep-together">
            <p className="font-semibold">Steg 2 – Veckomopp (efter dammsugning)</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong>När?</strong> Först när allt är utburet eller upplyft
                och golvet är dammsuget.
              </li>
              <li>
                <strong>Hörn &amp; kanter för hand:</strong> skrubba med grönsåpa
                eller ytdesinfektion + svamp/borste runt dörrar, toastol och
                dusch.
              </li>
              <li>
                <strong>Hela golvet:</strong> hink med varmt vatten + grönsåpa.
                Doppa moppen, krama ur, torka i <strong>åttor</strong> över hela
                ytan.
              </li>
              <li>
                Ta loss mopptyget, samla upp det sista med tyget eller
                toapapper.
              </li>
              <li>
                <strong>Skölj mopptyget</strong> i hinken, vrid ur, sätt tillbaka
                på kardborren och moppa igen – från hörn till hörn, längs
                väggarna, under duscharna och bakom stora duschen.
              </li>
            </ol>
          </div>
        </section>

        {/* SNABBFAKTA */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">Snabbfakta – ha i bakhuvudet</h2>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Blanka ytor</strong> (glas, metall) = diskmedel, aldrig
                såpa (såpa är fett).
              </li>
              <li>
                <strong>Övrigt</strong> = såpa funkar (fett löser fett).
              </li>
              <li>
                På porslin kan du efter såpa/skrubb köra en runda med diskmedel
                och avsluta med ättika eller ytdesinfektion.
              </li>
              <li>Torka alltid metall torrt efteråt – annars kalk.</li>
              <li>Osäker på en yta? Fråga hellre en gång för mycket.</li>
            </ul>
          </div>
        </section>

        <footer className="pt-4 border-t border-border text-xs text-muted-foreground print:pt-2">
          Brålands Gård 2026 · Städrutiner – guide för medarbetare.
        </footer>
      </div>
    </div>
  );
};

export default CleaningHelp;
