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
              // navigate(-1) failar om sidan öppnats direkt (ingen history).
              // Vi går alltid tillbaka till hjälp-hubben i så fall.
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
                Har bokat och betalat innan (Campio / PayPal / Swish / kontant) –
                men du vet inte vilken plats de valt.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: Familjen Andersson, betald 350 kr – kommer i vit
                  husbil. Tilldelar plats på rundan.
                </em>
              </p>

              <p>
                <span className="inline-block rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Ny på fast plats
                </span>
                Står på plats 1–21 eller E1–E6 och betalar direkt vid platsen.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: Tysk husbil på plats 12, två vuxna, en natt, betalar
                  250 kr med Swish.
                </em>
              </p>

              <p>
                <span className="inline-block rounded-md bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-1.5">
                  Tillfällig plats
                </span>
                Tält eller litet fordon på gräset, inte på en numrerad plats.
                <em className="block text-muted-foreground mt-0.5">
                  Exempel: Blått 3-mannatält, par, vid pilträdet bakom plats 15.
                </em>
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
                när du börjar och <em>Stoppa</em> när du är klar. Tiden registreras
                automatiskt.
              </li>
              <li>
                <strong>Inkommande · förbetalda</strong> – sektion överst med
                gäster som betalat men inte tilldelats plats än.
              </li>
              <li>
                <strong>Platslistan</strong> – alla campingplatser 1–21 och E1–E6.
                Klicka för att registrera eller redigera.
              </li>
              <li>
                <strong>"Lägg till plats"</strong> – knapp för att skapa en
                tillfällig plats (tält/fordon på gräs).
              </li>
              <li>
                <strong>Förbetalda-fliken</strong> – lista med alla förbetalda och
                knappen <em>Ny förbetald</em> för att registrera en ny förbokning.
              </li>
              <li>
                <strong>Ekonomi-fliken</strong> – kvällens intäkter uppdelat per
                betalsätt.
              </li>
            </ul>
          </div>
        </section>

        {/* ============ 2. ÖVERSIKT – TRE SITUATIONER ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">
            2. Översikt – tre situationer
          </h2>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Situation</th>
                  <th className="px-3 py-2 font-semibold">När?</th>
                  <th className="px-3 py-2 font-semibold">Var i appen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="align-top">
                  <td className="px-3 py-2 font-semibold">Förbetald gäst</td>
                  <td className="px-3 py-2 text-foreground/90">
                    Bokat och betalat innan, men plats inte vald än.
                  </td>
                  <td className="px-3 py-2 text-foreground/90">
                    Fliken <em>Förbetalda</em> → <strong>Ny förbetald</strong>
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-semibold">Ny gäst på fast plats</td>
                  <td className="px-3 py-2 text-foreground/90">
                    Gäst som står på plats 1–21 eller E1–E6.
                  </td>
                  <td className="px-3 py-2 text-foreground/90">
                    Klicka på platsen → <strong>Lägg till gäst</strong>
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-semibold">Tillfällig plats</td>
                  <td className="px-3 py-2 text-foreground/90">
                    Tält eller fordon på gräset (inte numrerad plats).
                  </td>
                  <td className="px-3 py-2 text-foreground/90">
                    Knappen <strong>Lägg till plats</strong> (bredvid "Förläng tidigare")
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ 3. FLÖDEN ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">3. De fyra flödena</h2>

          {/* Flöde 1 */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Flöde 1 – Innan du går ut: registrera förbetalda
            </h3>
            <p className="text-muted-foreground">
              Gör detta vid receptionen när du fått in en förbokning men gästen
              ännu inte ställt sig.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Öppna <strong>Kvällsrundan</strong> och gå till fliken <strong>Förbetalda</strong>.</li>
              <li>Tryck på <strong>Ny förbetald</strong>.</li>
              <li>Fyll i: namn, ev. reg.nr, nationalitet, <strong>betalmetod</strong>, belopp, ankomst/avresa.</li>
              <li>Spara.</li>
            </ol>
            <p className="text-foreground">
              Gästen syns nu i sektionen <strong>Inkommande · förbetalda</strong>{" "}
              överst på sidan, med en blå <em>Förbetald</em>-bricka. Du behöver
              inte välja plats här – det gör du på rundan när du ser var de står.
            </p>
          </div>

          {/* Flöde 2 */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Flöde 2 – På rundan: tilldela plats till en förbetald
            </h3>
            <p className="text-muted-foreground">
              När du ute på fältet ser att en förbetald gäst står på t.ex. plats 7.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Scrolla upp till <strong>Inkommande · förbetalda</strong>, eller tryck på platskortet och välj <em>Tilldela förbetald</em>.</li>
              <li>Välj gästen och rätt plats (1–21 / E1–E6) – eller välj <em>Tillfällig plats</em> om de står på gräs.</li>
              <li>Spara.</li>
            </ol>
            <p className="text-foreground">
              Klart. Ingen ny registrering, ingen dubbelpost – samma gäst flyttas
              bara från "Inkommande" till sin plats.
            </p>
          </div>

          {/* Flöde 3 */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Flöde 3 – Ny gäst på fast plats (det vanliga)
            </h3>
            <p className="text-muted-foreground">
              Gäst som står på plats 12 och inte har betalat innan.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Klicka på den lediga platsen → <strong>Lägg till gäst</strong>.</li>
              <li>Fyll i uppgifter och ta betalt direkt.</li>
              <li><strong>Beskriv sällskapet kort</strong> i fritextfältet (ex. "Familj med två små barn, blå husvagn"). Viktigt så att nästa person på rundan känner igen dem.</li>
              <li>Spara.</li>
            </ol>
          </div>

          {/* Flöde 4 */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm keep-together">
            <h3 className="font-semibold text-foreground">
              Flöde 4 – Tillfällig plats (tält/fordon på gräs)
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-foreground">
              <li>Tryck på <strong>Lägg till plats</strong> (bredvid "Förläng tidigare").</li>
              <li>
                <strong>Beskriv så tydligt som möjligt</strong>: typ av tält/fordon,
                färg, antal personer, var på området de står
                (ex. <em>"Blått 3-mannatält, par, vid pilträdet bakom plats 15"</em>).
              </li>
              <li>Fyll i betalning som vanligt.</li>
              <li>
                <strong>Om gästen är förbetald sen tidigare</strong>: använd
                kopplingen till en gäst i "Inkommande"-listan istället för att
                skapa en ny rad.
              </li>
            </ol>
            <p className="text-foreground">
              Tillfälliga platser samlas i sektionen <strong>Tillfälliga platser</strong>{" "}
              och har en orange <em>Tillfällig</em>-bricka.
            </p>
          </div>
        </section>

        {/* ============ 4. DAGLIG PÅMINNELSE ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">
            4. Daglig påminnelse – innan du går ut
          </h2>

          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground leading-relaxed">
            <li><strong>Stämpla in</strong> och tryck <em>Starta</em> i Snabbstart-rutan.</li>
            <li><strong>Kolla "Inkommande · förbetalda"</strong> först – är någon redan här? Tilldela plats och bocka av.</li>
            <li><strong>Gå runt platserna.</strong> Knacka på, hälsa, fråga: antal personer, antal nätter, släp?</li>
            <li><strong>Registrera/uppdatera</strong> sällskapet på rätt plats. Stannar de flera nätter syns de automatiskt nästa kväll.</li>
            <li><strong>Beskriv sällskapet kort</strong> så nästa kollega känner igen dem.</li>
            <li><strong>Ta betalt</strong> om de inte är förbetalda. Markera betalsätt och summa.</li>
            <li>Öppna <strong>Ekonomi-fliken</strong> och kontrollera att summan stämmer.</li>
            <li>Tryck <strong>Stoppa</strong> i Snabbstart-rutan och stämpla ut.</li>
          </ol>
        </section>

        {/* ============ 5. TUMREGLER ============ */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">5. Tumregler</h2>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>En gäst = en post.</strong> Skapa aldrig en ny rad för
                någon som redan finns i "Inkommande" – koppla istället.
              </li>
              <li>
                <strong>Beskriv tillfälliga platser noga</strong> så nästa
                person hittar tältet.
              </li>
              <li>
                <strong>"Förbetald"-brickan följer med</strong> även efter att
                platsen tilldelats – så vi ser i historiken att betalningen var
                ordnad i förväg.
              </li>
              <li>
                <strong>Hittar du inte gästen?</strong> Kolla "Inkommande" högst
                upp innan du registrerar på nytt.
              </li>
              <li>
                <strong>Lämnar du tidigt?</strong> Säg till kollega och skriv en
                kommentar om vad som är kvar.
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
