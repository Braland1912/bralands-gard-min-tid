import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const EveningRoundHelp = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
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
            En kort guide för alla som går rundan. Läs introt en gång – och kolla
            den dagliga påminnelsen innan du går ut.
          </p>
        </header>

        {/* INTRO */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Intro – läs en gång</h2>

          <div className="space-y-2 text-sm leading-relaxed text-foreground">
            <p>
              Kvällsrundan är när vi går runt på campingen, hälsar på gästerna,
              tar betalt av dem som inte betalat i förväg och ser till att allt
              är okej inför natten.
            </p>
            <p>
              Allt sker i appen under <strong>Kvällsrundan</strong>. Du behöver
              ingen penna och inget papper – telefonen räcker.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
            <p className="font-semibold">Vad du ser på sidan</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground">
              <li><strong>Förbetalda gäster</strong> – syns högst upp. Dessa har redan betalat, du behöver bara säga hej och bocka av att de är på plats.</li>
              <li><strong>Lista över platser</strong> – alla campingplatser. Klicka på en plats för att lägga till eller redigera ett sällskap.</li>
              <li><strong>Snabbstart</strong> – en knapp för att direkt registrera nya gäster på en ledig plats.</li>
              <li><strong>Ekonomi-fliken</strong> – sammanfattning av vad som tagits in under kvällen.</li>
            </ul>
          </div>
        </section>

        {/* DAGLIG PÅMINNELSE */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            2. Daglig påminnelse – innan du går ut
          </h2>

          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground leading-relaxed">
            <li>
              <strong>Stämpla in</strong> i appen och tryck på <em>Börja rundan</em>{" "}
              på Kvällsrundan-sidan. Då vet alla att du är ute.
            </li>
            <li>
              <strong>Kolla förbetalda gäster först.</strong> Bocka av dem när du
              ser att de är på plats.
            </li>
            <li>
              <strong>Gå runt platserna.</strong> Knacka på husbilen/tältet, hälsa
              och fråga hur många nätter de stannar.
            </li>
            <li>
              <strong>Lägg in sällskapet i appen</strong> – välj antal personer,
              fordon/tält och hur många nätter (multi-natt-gäster syns sen
              automatiskt nästa kväll).
            </li>
            <li>
              <strong>Beskriv sällskapet</strong> i fältet (ex. "Familj med två
              små barn, blå husvagn"). Det är viktigt så att nästa person på
              rundan känner igen dem.
            </li>
            <li>
              <strong>Ta betalt</strong> om de inte är förbetalda. Markera
              betalsätt i appen.
            </li>
            <li>
              När rundan är klar: kolla <strong>Ekonomi-fliken</strong> så att
              summan stämmer.
            </li>
            <li>
              <strong>Avsluta rundan</strong> i appen och stämpla ut.
            </li>
          </ol>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Bra att tänka på</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lämnar du tidigt? Säg till och beskriv vad som är kvar.</li>
              <li>Är något konstigt (trasigt, bråk, betalningstrubbel)? Skriv en kort kommentar på platsen.</li>
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
