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
          section, .keep-together { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 print:p-0 print:max-w-none">
        {/* Topp-knappar */}
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
            Brålands Gård 2026 · Kvällsrundan
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Så funkar Kvällsrundan
          </h1>
          <p className="text-sm text-muted-foreground">
            Läs introt en gång så du förstår sidan. Använd sen den dagliga
            påminnelsen som checklista innan du går ut.
          </p>
        </header>

        {/* ============ HUVUDFLÖDE ============ */}
        <section className="space-y-3 keep-together">
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Huvudflödet
            </p>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Så går rundan till
            </h2>
            <ol className="space-y-2.5 text-sm text-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  1
                </span>
                <span className="pt-0.5">
                  <strong>Inne på kontoret:</strong> öppna fliken{" "}
                  <strong>Förbetalda</strong> och tryck{" "}
                  <strong>Ny förbetald</strong>. Fyll i namn, betalning,
                  ankomst/avresa. Spara – ingen plats behövs än.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <span className="pt-0.5">
                  <strong>Fast plats (standard):</strong> ute på fältet,
                  tryck direkt på platskortet (1–21 eller E1–E6) →{" "}
                  <strong>Lägg till gäst</strong> (eller{" "}
                  <strong>Matcha mot förbetald</strong> om gästen redan är
                  registrerad). Fyll i uppgifter och ta betalt på plats.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  3
                </span>
                <span className="pt-0.5">
                  <strong>Tillfällig plats:</strong> står gästen utanför de fasta
                  platserna (t.ex. på gräset)? Tryck{" "}
                  <strong>Lägg till plats</strong>. Välj{" "}
                  <strong>Ny gäst</strong> och ta betalt, eller{" "}
                  <strong>Förbetald</strong> för att koppla en redan registrerad
                  gäst. En tillfällig plats skapas automatiskt.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  4
                </span>
                <span className="pt-0.5">
                  <strong>Beskriv tydligt</strong> var tillfälliga gäster står
                  (t.ex. <em>"Vit husbil vid pilträdet bakom plats 15"</em>)
                  så nästa kollega känner igen dem.
                </span>
              </li>
            </ol>
          </div>
        </section>


        {/* ============ 1. INTRO ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">1. Intro – läs en gång</h2>

          <div className="space-y-2 text-sm leading-relaxed text-foreground">
            <p>
              På kvällsrundan går vi runt på campingen, hälsar på gästerna,
              tar betalt av dem som inte betalat i förväg och ser till att vi
              vet vem som ligger var inför natten. Allt registreras i appen
              under <strong>Kvällsrundan</strong> – ingen penna, inget papper.
            </p>
          </div>

          {/* Olika typer av gäster */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm keep-together">
            <p className="font-semibold text-foreground">Olika typer av gäster du möter</p>

            <div className="space-y-2">
              <p>
                <span className="inline-block rounded-md bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Förbetald
                </span>
                Har bokat och betalat innan (Campio / Swish / kontant).
                Registrera först, matcha sen mot plats ute.
              </p>

              <p>
                <span className="inline-block rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Ny på fast plats
                </span>
                Står på plats 1–21 eller E1–E6 och betalar direkt vid platsen.
              </p>

              <p>
                <span className="inline-block rounded-md bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Tillfällig plats
                </span>
                Tält eller fordon på gräset, inte på en numrerad plats.
              </p>

              <p>
                <span className="inline-block rounded-md bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Reserverad
                </span>
                Någon har ringt och sagt att de kommer sent – platsen är
                blockerad men ingen betalning ännu.
              </p>
            </div>
          </div>

          {/* Vad du ser på sidan */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <p className="font-semibold text-foreground">Vad du ser på sidan</p>
            <ul className="list-disc pl-5 space-y-1.5 text-foreground">
              <li>
                <strong>Snabbstart-rutan högst upp</strong> – tryck <em>Starta</em>{" "}
                när du börjar och <em>Stoppa</em> när du är klar.
              </li>
              <li>
                <strong>Förbetalda</strong> – gäster som betalat men inte
                matchats mot plats än.
              </li>
              <li>
                <strong>Platslistan</strong> – alla campingplatser 1–21 och E1–E6.
              </li>
              <li>
                <strong>"Lägg till plats"</strong> – endast för att matcha en
                förbetald gäst eller skapa en tillfällig plats (tält/fordon på
                gräs). Fasta platser går via platskortet.
              </li>

              <li>
                <strong>Förbetalda-fliken</strong> – knappen <em>Ny förbetald</em>{" "}
                för att registrera en ny förbokning.
              </li>
              <li>
                <strong>Ekonomi-fliken</strong> – kvällens intäkter per betalsätt
                och redovisning/checklista.
              </li>
            </ul>
          </div>
        </section>

        {/* ============ 2. ÖVRIGA FLÖDEN ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">2. Övriga flöden</h2>

          {/* Flöde A */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Ny gäst på fast plats (1–21 / E1–E6)
            </h3>
            <p className="text-muted-foreground">
              Gäst som står på en numrerad plats och inte betalat innan.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Klicka på den lediga platsen → <strong>Lägg till gäst</strong>.</li>
              <li>Fyll i uppgifter och ta betalt direkt.</li>
              <li>
                <strong>Beskriv sällskapet kort</strong> (t.ex. "Familj, blå
                husvagn") så nästa person på rundan känner igen dem.
              </li>
              <li>Spara.</li>
            </ol>
          </div>

          {/* Flöde B */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Tillfällig plats utan förbetalning
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Tryck på <strong>Lägg till plats</strong> och välj fliken <strong>Ny gäst</strong>.</li>
              <li>Skriv en kort beskrivning av platsen och tryck <strong>Skapa tillfällig plats</strong>.</li>

              <li>
                <strong>För tält:</strong> fyll i antal personer (obligatoriskt
                – det styr priset).
              </li>
              <li>
                <strong>Beskriv tydligt:</strong> typ av tält/fordon, färg,
                antal personer, var på området de står.
              </li>
              <li>Ta betalt som vanligt.</li>
            </ol>
          </div>

          {/* Flöde C */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Reserverad – kommer sent
            </h3>
            <p className="text-muted-foreground">
              Någon har ringt och sagt att de kommer efter att du gått runt.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Lägg upp dem som vanligt på rätt plats.</li>
              <li>Markera som <em>Ej kommit</em> – platsen blir blockerad och syns som <strong>Reserverad</strong>.</li>
              <li>Nästa kollega kan ta betalt när de väl dyker upp.</li>
            </ol>
          </div>
        </section>

        {/* ============ 3. DAGLIG PÅMINNELSE ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">
            3. Daglig påminnelse – innan du går ut
          </h2>

          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground leading-relaxed">
            <li><strong>Stämpla in</strong> på tidrapporten.</li>
            <li><strong>Registrera dagens förbetalda</strong> som kommit in via mejl/telefon.</li>
            <li><strong>Kolla "Förbetalda"</strong> – är någon redan här? Matcha mot plats.</li>
          </ol>

          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Tryck <em>Starta</em> i Snabbstart-rutan innan du går ut
            </p>
            <ol start={4} className="list-decimal pl-5 space-y-2 text-sm text-foreground leading-relaxed">
              <li><strong>Gå runt platserna.</strong> Knacka på, hälsa, fråga: antal nätter (och antal personer vid tält, det styr priset).</li>
              <li><strong>Registrera/uppdatera</strong> sällskapet på rätt plats.</li>
              <li><strong>Beskriv sällskapet kort</strong> så nästa kollega känner igen dem.</li>
              <li><strong>Ta betalt</strong> om de inte är förbetalda. Markera betalsätt och summa.</li>
            </ol>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary pt-1">
              Tryck <em>Stoppa</em> i Snabbstart-rutan när rundan är klar
            </p>
          </div>

          <ol start={8} className="list-decimal pl-5 space-y-2 text-sm text-foreground leading-relaxed">
            <li>Öppna <strong>Ekonomi-fliken</strong> och gå igenom checklistan + redovisningen.</li>
            <li><strong>Stämpla ut</strong> på tidrapporten.</li>
          </ol>
        </section>

        {/* ============ 4. EKONOMI & MOMS ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">4. Ekonomi &amp; moms</h2>
          <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
            <p className="text-foreground">
              På fliken <strong>Ekonomi</strong> redovisar du kvällens intäkter
              och bockar av kvällens checklista (toaletter, sopor, dörrar m.m.).
            </p>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-foreground/90">
              <p><strong>Moms:</strong> gästnatt 12%, allt annat (kiosk m.m.) 6%.</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Du behöver inte räkna ut moms själv – det är bara bra att veta att
              gästnatt och kioskvaror har olika momssatser.
            </p>
          </div>
        </section>

        {/* ============ 5. TUMREGLER ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">5. Tumregler</h2>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>En gäst = en post.</strong> Skapa aldrig en ny rad för
                någon som redan finns under "Förbetalda" – matcha istället.
              </li>
              <li>
                <strong>Beskriv tillfälliga platser noga</strong> så nästa
                person hittar tältet.
              </li>
              <li>
                <strong>Tält kräver antal personer</strong> – det styr priset.
              </li>
              <li>
                <strong>"Förbetald"-brickan följer med</strong> även efter att
                platsen matchats – så vi ser i historiken att betalningen var
                ordnad i förväg.
              </li>
              <li>
                <strong>Hittar du inte gästen?</strong> Kolla "Inkommande" högst
                upp innan du registrerar på nytt.
              </li>
              <li><strong>Osäker?</strong> Fråga hellre en gång för mycket.</li>
            </ul>
          </div>
        </section>

        <footer className="pt-4 border-t border-border text-xs text-muted-foreground print:pt-2">
          Brålands Gård 2026 · Kvällsrundan – guide för medarbetare. Frågor? Hör av er.
        </footer>
      </div>
    </div>
  );
};

export default EveningRoundHelp;
