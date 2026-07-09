import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import step1 from "@/assets/laundry/step-1-door.jpg.asset.json";
import step2 from "@/assets/laundry/detergent-drawer.jpg.asset.json";
import step3 from "@/assets/laundry/step-3-dial.jpg.asset.json";
import step4 from "@/assets/laundry/step-4-temp.jpg.asset.json";
import step5 from "@/assets/laundry/step-5-spin.jpg.asset.json";
import step6 from "@/assets/laundry/step-6-start.jpg.asset.json";
import whiteBox from "@/assets/laundry/white-box.jpg.asset.json";

type Step = {
  n: number;
  title: string;
  body: React.ReactNode;
  image: string;
  alt: string;
};

const LaundryHelp = () => {
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      n: 1,
      title: "Öppna luckan och lägg in tvätten",
      image: step1.url,
      alt: "Hand öppnar tvättmaskinens lucka",
      body: (
        <>
          Öppna luckan genom att dra i handtaget. Lägg in tvätten löst — fyll
          max till <strong>3/4 av trumman</strong> så kläderna får plats att
          rotera. Stäng luckan ordentligt tills det klickar.
        </>
      ),
    },
    {
      n: 2,
      title: "Dosera tvättmedel i tvättmedelsfacket",
      image: step2.url,
      alt: "Tvättmedelsfacket utdraget med sked pulver i vänstra facket",
      body: (
        <>
          Dra ut <strong>tvättmedelsfacket</strong> längst upp till vänster på
          maskinen. Tvättmedlet finns i de <strong>grå hinkarna med vitt lock</strong>{" "}
          — <strong>teskedsmåttet ligger i hinken</strong>. Häll{" "}
          <strong>2 tsk (ca 10 ml)</strong> i det <strong>vänstra facket</strong>{" "}
          (se bilden). Skjut in facket igen. Sköljmedel behövs inte.
        </>
      ),
    },
    {
      n: 3,
      title: "Slå på maskinen och välj Snabbtvätt",
      image: step3.url,
      alt: "Hand vrider programratten till Snabbtvätt",
      body: (
        <>
          Tryck på <strong>power-knappen</strong> (vänster om ratten) så tänds
          displayen. Vrid sedan ratten till <strong>Snabbtvätt</strong>. Nu står
          det <strong>14 min</strong> i displayen — det är standard, men vi
          ändrar temp och varv i nästa steg.
        </>
      ),
    },
    {
      n: 4,
      title: "Öka temperaturen till 40°C",
      image: step4.url,
      alt: "Display visar 40°C som vald temperatur",
      body: (
        <>
          Tryck på knappen <strong>Temp</strong> upprepade gånger tills{" "}
          <strong>40°C</strong> lyser i displayen. Snabbtvätt ligger som
          standard på Cold — vi vill ha 40°C för att få rent på riktigt.
        </>
      ),
    },
    {
      n: 5,
      title: "Öka centrifugering till 1200 varv",
      image: step5.url,
      alt: "Display visar 1200 varv centrifugering",
      body: (
        <>
          Tryck på knappen <strong>Spin</strong> tills <strong>1200</strong>{" "}
          lyser. Då centrifugeras kläderna hårdare och blir mindre blöta — bra
          för torkning på tvättlinan eller torktumlaren.
        </>
      ),
    },
    {
      n: 6,
      title: "Tryck på Start",
      image: step6.url,
      alt: "Start-knapp på tvättmaskinen",
      body: (
        <>
          Tryck på <strong>Start</strong>-knappen (höger om ratten, med
          play-symbolen). Nedräkningen startar och maskinen låser luckan. När
          maskinen är klar — <strong>töm den direkt</strong>, häng upp eller
          lägg i torktumlaren.
        </>
      ),
    },
  ];

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
            Brålands Gård 2026 · Tvätt
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Tvättmaskin – så startar du
          </h1>
          <p className="text-sm text-muted-foreground">
            Vi kör alltid <strong>Snabbtvätt</strong> med <strong>40°C</strong>{" "}
            och <strong>1200 varv</strong>. Följ stegen nedan — bilderna visar
            exakt vad du ska trycka på.
          </p>
        </header>

        {/* SORTERING */}
        <section className="space-y-3 keep-together">
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Innan du startar – sortera tvätten
            </p>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Färgad · Vitt · Handdukar &amp; städtrasor
            </h2>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  1
                </span>
                <span>
                  <strong>Färgad tvätt</strong> för sig — i en IKEA-påse.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  2
                </span>
                <span>
                  <strong>Vit tvätt</strong> för sig — i en annan IKEA-påse.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  3
                </span>
                <span>
                  <strong>Handdukar, städtrasor och tvättlappar</strong> för sig
                  — i egen IKEA-påse. Är de <strong>blöta</strong> lägger du dem
                  i den <strong>vita lådan</strong> bredvid maskinen (se bilden
                  nedan) istället så det inte blir mögligt.
                </span>
              </li>
            </ul>
            <div className="rounded-xl overflow-hidden border border-primary/20 bg-background">
              <div className="aspect-[4/3] bg-muted overflow-hidden">
                <img
                  src={whiteBox.url}
                  alt="Vit plastlåda på golvet bredvid tvättmaskinen för blöta handdukar och städtrasor"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-muted-foreground p-3">
                Den vita lådan – här läggs blöta handdukar, städtrasor och
                tvättlappar tills det är dags att tvätta.
              </p>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Blanda aldrig färgat och vitt — då riskerar vitt att bli gråaktigt
              eller färga av sig.
            </p>
          </div>
        </section>

        {/* STEG MED BILDRUTOR */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Steg för steg vid maskinen
          </h2>

          <div className="space-y-4">
            {steps.map((s) => (
              <article
                key={s.n}
                className="rounded-2xl border border-border bg-card overflow-hidden keep-together"
              >
                <div className="aspect-[4/5] sm:aspect-[16/10] bg-muted overflow-hidden">
                  <img
                    src={s.image}
                    alt={s.alt}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                      {s.n}
                    </span>
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                  </div>
                  <p className="text-sm text-foreground pl-11">{s.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SNABBFAKTA */}
        <section className="space-y-3 keep-together">
          <h2 className="text-lg font-semibold text-foreground">
            Snabbfakta – ha i bakhuvudet
          </h2>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Vårt standardprogram: <strong>Snabbtvätt · 40°C · 1200 varv</strong>.
              </li>
              <li>Fyll trumman till max 3/4 — kläderna måste kunna röra sig.</li>
              <li>
                Tvättmedel i <strong>vänstra facket</strong> i tvättmedelslådan
                — 2 tsk räcker.
              </li>
              <li>Töm maskinen direkt när den är klar — annars börjar det lukta.</li>
              <li>Fråga hellre en gång för mycket om något känns fel.</li>
            </ul>
          </div>
        </section>

        <footer className="pt-4 border-t border-border text-xs text-muted-foreground print:pt-2">
          Brålands Gård 2026 · Tvättmaskin – guide för medarbetare.
        </footer>
      </div>
    </div>
  );
};

export default LaundryHelp;
