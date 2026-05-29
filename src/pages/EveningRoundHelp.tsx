import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const EveningRoundHelp = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          h1, h2, h3 { break-after: avoid; }
          section { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 print:p-0 print:max-w-none">
        {/* Topp-knappar (göms vid utskrift) */}
        <div className="flex items-center justify-between no-print">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
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
            Brålands Gård · Kvällsrundan
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Så funkar Kvällsrundan
          </h1>
          <p className="text-sm text-muted-foreground">
            Läs introt en gång så du förstår sidan. Använd sen den dagliga
            påminnelsen som checklista innan du går ut.
          </p>
        </header>

        {/* ============ 1. INTRO ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">1. Intro – läs en gång</h2>

          <div className="space-y-2 text-sm leading-relaxed text-foreground">
            <p>
              På kvällsrundan går vi runt på campingen, hälsar på gästerna,
              tar betalt av dem som inte betalat i förväg och ser till att
              vi vet vem som ligger var inför natten.
            </p>
            <p>
              Allt registreras i appen under <strong>Kvällsrundan</strong>.
              Ingen penna, inget papper – telefonen räcker.
            </p>
          </div>

          {/* Olika typer av gäster */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
            <p className="font-semibold text-foreground">Olika typer av gäster du möter</p>

            <div className="space-y-2">
              <p>
                <span className="inline-block rounded-md bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Förbetald
                </span>
                Har bokat och betalat online. Syns högst upp i listan utan plats.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: "Familjen Andersson, betald 350 kr – kommer i en vit
                  husbil." Du tilldelar dem en plats när de dyker upp och bockar
                  av att de är på plats.
                </em>
              </p>

              <p>
                <span className="inline-block rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  På plats
                </span>
                Gäst du registrerar och tar betalt av direkt vid platsen.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: Tysk husbil på plats 12, två vuxna, en natt, betalar
                  med Swish 250 kr.
                </em>
              </p>

              <p>
                <span className="inline-block rounded-md bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Reserverad
                </span>
                Någon har ringt och sagt att de kommer sent men inte dykt upp än.
                Platsen är blockerad men ingen betalning gjord.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: "Plats 7 reserverad till kl 22 – paret Berg."
                </em>
              </p>

              <p>
                <span className="inline-block rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Tält
                </span>
                Tältgäster har ofta inget reg.nr – skriv namn och beskriv tältet
                (färg, antal personer) så nästa kollega känner igen dem.
              </p>

              <p>
                <span className="inline-block rounded-md bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Tillfällig plats
                </span>
                Står utanför ordinarie platser (t.ex. nere vid stora ladan).
                Beskriv var de står så vi hittar dem.
              </p>
            </div>
          </div>

          {/* Vad du ser på sidan */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
            <p className="font-semibold text-foreground">Vad du ser på sidan</p>
            <ul className="list-disc pl-5 space-y-1.5 text-foreground">
              <li>
                <strong>Snabbstart-rutan högst upp</strong> – här trycker du
                <em> Starta</em> när du börjar rundan och <em>Stoppa</em> när du
                är klar. Tiden registreras automatiskt.
              </li>
              <li>
                <strong>Förbetalda gäster</strong> – egen sektion. Dessa har
                redan betalat, du behöver bara tilldela dem en plats när de
                kommer.
              </li>
              <li>
                <strong>Platslistan</strong> – alla campingplatser. Klicka på en
                plats för att registrera ett sällskap, eller på en befintlig
                gäst för att redigera.
              </li>
              <li>
                <strong>Ekonomi-fliken</strong> – sammanfattning av kvällens
                intäkter, uppdelat per betalsätt (kontant, Swish, kort osv).
              </li>
            </ul>
          </div>
        </section>

        {/* ============ 2. DAGLIG PÅMINNELSE ============ */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            2. Daglig påminnelse – innan du går ut
          </h2>

          <ol className="list-decimal pl-5 space-y-2.5 text-sm text-foreground leading-relaxed">
            <li>
              <strong>Stämpla in</strong> i appen och tryck på <em>Starta</em> i
              Snabbstart-rutan på Kvällsrundan-sidan. Då vet alla att rundan är
              igång.
            </li>
            <li>
              <strong>Kolla förbetalda gäster först.</strong> Är någon redan på
              plats? Tilldela platsen och bocka av att de är där.
            </li>
            <li>
              <strong>Gå runt platserna.</strong> Knacka på husbilen/tältet,
              hälsa och fråga: hur många personer, hur många nätter, finns det
              släp?
            </li>
            <li>
              <strong>Registrera sällskapet</strong> på rätt plats i appen –
              välj fordon eller tält, antal nätter och nationalitet. Stannar de
              flera nätter syns de automatiskt nästa kväll.
            </li>
            <li>
              <strong>Beskriv sällskapet kort</strong> i fältet (ex. "Familj
              med två små barn, blå husvagn med släp"). Detta är viktigt så att
              nästa person på rundan känner igen dem och inte stör i onödan.
            </li>
            <li>
              <strong>Ta betalt</strong> om de inte är förbetalda. Markera
              betalsätt (kontant, Swish, kort) och summa.
            </li>
            <li>
              När du gått klart: öppna <strong>Ekonomi-fliken</strong> och
              kontrollera att summan stämmer mot det du faktiskt fått in.
            </li>
            <li>
              Tryck <strong>Stoppa</strong> i Snabbstart-rutan och stämpla ut.
            </li>
          </ol>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">Bra att tänka på</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Lämnar du tidigt eller mitt i rundan? Säg till kollega och skriv
                en notering om vad som är kvar.
              </li>
              <li>
                Är något konstigt (trasigt på platsen, bråk, gäst som inte vill
                betala)? Skriv en kort kommentar på platsen i appen.
              </li>
              <li>
                Hittar du en gäst du inte väntar dig? Kolla först i listan över
                förbetalda – de kanske bara saknar plats än.
              </li>
              <li>Osäker på något? Fråga hellre en gång för mycket.</li>
            </ul>
          </div>
        </section>

        <footer className="pt-4 border-t border-border text-xs text-muted-foreground print:pt-2">
          Brålands Gård 2026 · Kvällsrundan – guide för medarbetare
        </footer>
      </div>
    </div>
  );
};

export default EveningRoundHelp;
