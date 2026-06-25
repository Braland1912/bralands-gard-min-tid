import { Flame, Phone, MapPin, AlertTriangle, ShieldCheck, Stethoscope, Flag } from "lucide-react";


const Emergency = () => {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <header className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Flame className="h-3.5 w-3.5" />
            Brålands Gård · Munkedal · Bohuslän
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Brand & nödläge</h1>
          <p className="text-sm text-muted-foreground">Om det börjar brinna – så här gör vi.</p>
        </header>

        {/* 112 box */}
        <section className="rounded-2xl border-2 border-destructive bg-destructive/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center font-bold text-lg">
              112
            </div>
            <div>
              <div className="font-bold text-foreground">Ring och säg exakt var vi är</div>
              <div className="text-xs text-muted-foreground">Läs upp högt – gissa inte.</div>
            </div>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-sm space-y-1">
            <div className="font-semibold text-foreground flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <span>
                Brålands Gårds Camping · Brålands Gård 20, 455 91 Munkedal · fastighet Bråland 3:18
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              1 km öster om Hemköp på Munkeland och förbi järnvägsövergången.
            </p>
          </div>
        </section>

        {/* Steg */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Gör i den här ordningen
          </h2>
          <ol className="space-y-2">
            {[
              { n: 1, t: "Rädda", d: "Hjälp gäster i fara först – tänk barn, äldre och de som har svårt att ta sig ut själva." },
              { n: 2, t: "Varna", d: "Säg till andra i området så de kommer undan." },
              { n: 3, t: "Larma", d: "Ring 112. Säg var vi är (se rutan ovan) och vad som brinner." },
              { n: 4, t: "Släck", d: "Bara om elden är liten och du har fri väg ut bakom dig." },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{s.t}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Återsamling */}
        <section className="rounded-2xl border-2 border-emerald-600 bg-emerald-600/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Flag className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Återsamlingsplats
              </div>
              <div className="font-bold text-foreground">Fotbollsplanen vid Servicehuset</div>
            </div>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-sm">
            <p className="text-foreground">
              Hit går alla – både gäster och personal. Räkna av och håll koll på vilka som är incheckade.
            </p>
          </div>
        </section>


        {/* Brandredskap */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Var finns brandredskap?
          </h2>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
            {[
              "Inuti Lodgen",
              "Norra utsidan av Stuga nr 4 \u201dStrömstaren\u201d",
              "Servicehuset (även första förband)",
              "Elstolparna på campingen",
              "Grillhyttorna",
            ].map((p) => (
              <li key={p} className="px-4 py-3 text-sm text-foreground flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Ring internt */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ring internt
          </div>
          <p className="text-sm text-muted-foreground">
            Säg aldrig ja till att släcka om du är osäker. Egen säkerhet först – saker går att ersätta.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href="tel:+46734103610"
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:bg-accent/40 transition-colors"
            >
              <Phone className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Per</div>
                <div className="text-sm text-muted-foreground">0734-10 36 10</div>
              </div>
            </a>
            <a
              href="tel:+46738005187"
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:bg-accent/40 transition-colors"
            >
              <Phone className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Fina</div>
                <div className="text-sm text-muted-foreground">0738-00 51 87</div>
              </div>
            </a>
          </div>
        </section>

        {/* Förebygg */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Så förebygger vi
          </h2>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
            {[
              ["Grill & aska", "Släck ordentligt, töm aska i metallkärl – aldrig i naturen."],
              ["Rökning", "Bara på anvisad plats, fimpa helt – aldrig i torrt gräs."],
              ["Eldstäder", "Lämna aldrig en brasa utan uppsikt."],
              ["Gasol", "Stäng av efter användning, kolla att slangar sitter fast."],
              ["Sommartorka", "Extra vaksam när det är torrt, var beredd att avråda från eld."],
            ].map(([t, d]) => (
              <li key={t} className="px-4 py-3 text-sm">
                <span className="font-semibold text-foreground">{t}: </span>
                <span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Sjukvårdsnummer */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Bra nummer vid sjukdom & skada
          </h2>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              I hela Sverige
            </div>
            <ul className="divide-y divide-border">
              {[
                ["112", "Akut – livshotande sjukdom eller olycka"],
                ["1177", "Sjukvårdsrådgivning, dygnet runt – ring vid osäkerhet"],
                ["113 13", "Information vid större olyckor & kriser"],
                ["114 14", "Polis, ej akut"],
                ["010-456 67 00", "Giftinformation (akut förgiftning: ring 112)"],
              ].map(([num, txt]) => (
                <li key={num} className="px-4 py-3 flex items-start gap-3">
                  <a
                    href={`tel:${num.replace(/\s/g, "")}`}
                    className="font-semibold text-primary whitespace-nowrap"
                  >
                    {num}
                  </a>
                  <span className="text-sm text-muted-foreground">{txt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Munkedal & närområde
            </div>
            <ul className="divide-y divide-border">
              {[
                ["010-441 51 40", "Närhälsan Munkedal vårdcentral, Centrumvägen 34. Kvällar & helger: ring 1177"],
                ["010-435 00 00", "Akutmottagning NÄL, Trollhättan (NU-sjukvården) – närmaste akut"],
              ].map(([num, txt]) => (
                <li key={num} className="px-4 py-3 flex items-start gap-3">
                  <a
                    href={`tel:${num.replace(/\s/g, "")}`}
                    className="font-semibold text-primary whitespace-nowrap"
                  >
                    {num}
                  </a>
                  <span className="text-sm text-muted-foreground">{txt}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* English / international numbers */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>🇬🇧</span>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              For foreign guests · international format
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Share these with guests calling from a foreign SIM card. Sweden's country code is +46.
          </p>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Anywhere in Sweden
            </div>
            <ul className="divide-y divide-border">
              {[
                ["112", "Emergency – life-threatening illness or accident. Works from any phone."],
                ["+46 771 11 77 00", "Health-care advice, 24/7 (dial 1177 within Sweden)"],
                ["+46 77 33 113 13", "Info on major accidents & crises (113 13 within Sweden)"],
                ["+46 77 114 14 00", "Police, non-emergency (114 14 within Sweden)"],
                ["+46 10 456 67 00", "Poisons Information (acute poisoning: call 112)"],
              ].map(([num, txt]) => (
                <li key={num} className="px-4 py-3 flex items-start gap-3">
                  <a
                    href={`tel:${num.replace(/\s/g, "")}`}
                    className="font-semibold text-primary whitespace-nowrap"
                  >
                    {num}
                  </a>
                  <span className="text-sm text-muted-foreground">{txt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Munkedal & nearby
            </div>
            <ul className="divide-y divide-border">
              {[
                ["+46 10 441 51 40", "Närhälsan Munkedal health centre, Centrumvägen 34. Evenings & weekends: call 1177"],
                ["+46 10 435 00 00", "A&E at NÄL hospital, Trollhättan – nearest emergency room"],
              ].map(([num, txt]) => (
                <li key={num} className="px-4 py-3 flex items-start gap-3">
                  <a
                    href={`tel:${num.replace(/\s/g, "")}`}
                    className="font-semibold text-primary whitespace-nowrap"
                  >
                    {num}
                  </a>
                  <span className="text-sm text-muted-foreground">{txt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Call us
            </div>
            <ul className="divide-y divide-border">
              {[
                ["Per", "+46 73 410 36 10"],
                ["Fina", "+46 73 800 51 87"],
              ].map(([name, num]) => (
                <li key={name} className="px-4 py-3 flex items-center gap-3">
                  <span className="font-semibold text-foreground w-12">{name}</span>
                  <a
                    href={`tel:${num.replace(/\s/g, "")}`}
                    className="font-semibold text-primary whitespace-nowrap"
                  >
                    {num}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="text-xs text-muted-foreground flex items-center gap-2 pt-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Genomgången med all personal · 25 juni 2026 · Brålands Gård
        </footer>

      </div>

      
    </div>
  );
};

export default Emergency;
