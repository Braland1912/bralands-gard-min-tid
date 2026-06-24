## Steg 2 – Lodge-kalender styr checklistor på pass

### Beslut (bekräftade)
- Auto-koppling triggas av **avfärd (bytesdag)** för en enhet.
- Auto-koppling sker **enbart på dagpass**.
- "Lodgen idag"-sektion visas **både på morgon- och dagpass** (morgonen kan börja förbereda).
- Checklistorna kopplas **automatiskt** när en bokning finns i kalendern – aldrig manuellt.
- Auto-tillagda checklistor är **låsta** i passvyn – de styrs av kalendern.
- När en bokning **tillkommer, ändras eller avbokas** ska berörda pass uppdateras direkt.

---

### 1. Databas
Lägg till på `checklist_templates`:
- `lodge_unit` (text, nullable) – en av `Öringen | Laxen | Kungsfiskaren | Strömstaren | Husvagnen`.

I checklist-editorn (`/admin/checklists`): dropdown "Koppla till lodge-enhet (valfritt)".
När `lodge_unit` är satt: mallen blir en **enhets-mall** och kopplas inte längre via shift-typ – den följer kalendern istället.

### 2. Logik – vilka checklistor körs på ett pass
För ett pass beräknar vi listan dynamiskt vid render:

```
checklistor på passet =
    (mallar kopplade till passets shift-typ, som idag)
  +  om pass.typ == "dag":
       för varje enhet med AVFÄRD på pass.datum (från lodge-kalendern):
         lägg till mall där lodge_unit == enheten   [LÅST]
```

Inget persisteras per pass – sanningskällan är kalendern + mallarnas `lodge_unit`. Det gör att avbokning/ändring/ny bokning slår igenom direkt nästa gång passet öppnas (och vid realtidsuppdatering, se nedan).

### 3. "Lodgen idag"-sektion i passvyn
Ovanför checklistorna, på **morgon- och dagpass**:
- Samma fyra grupper som i admin-översiktens kort: Avfärd / Ankomst / Pågående / Kan tillkomma.
- Hopfällbar (chevron). Default: **utfälld om det finns avfärd idag**, annars hopfälld. Tillstånd sparas per användare i `localStorage`.

### 4. Visning av låsta auto-checklistor
- Märks med liten "Från kalender · {Enhet}"-tagg.
- Ingen X-knapp för borttagning. Tooltip: "Styrs av lodge-kalendern".
- Försvinner automatiskt om bokningen avbokas.

### 5. Synk när kalendern ändras
iCloud-kalendern är read-only för oss, så vi pollar `lodge-calendar`-edge-functionen:
- Vid öppning av ett pass: hämta färsk data.
- Cache (React Query) i 2 min – `staleTime` kort så ändringar märks snabbt.
- Manuell "Uppdatera"-knapp i "Lodgen idag"-sektionen som invaliderar cachen.

Eftersom checklistorna beräknas från kalendern + `lodge_unit` (inte sparas), uppdateras passet direkt när kalenderdatan uppdateras.

---

### Filer som rörs
- Migration: `checklist_templates.lodge_unit` (nullable text + CHECK för giltiga värden).
- `src/pages/AdminChecklists.tsx` (eller redigeringsdialogen): dropdown för `lodge_unit`.
- Ny hook `useLodgeUnitsByRole(date)` som returnerar `{ departures, arrivals, ongoing, potential }`.
- Passvyn (där checklistor visas idag): inkludera auto-mallar för dag-pass + render "Lodgen idag"-sektion på morgon/dag.
- Liten badge-komponent "Från kalender · {Enhet}".

### Default-koppling (frågan om Laxen)
Jag föreslår: ingen hårdkodning. Du sätter `lodge_unit` på varje mall i checklist-editorn (t.ex. "Lägenhet Nr2 Laxen" → `Laxen`). Då följer den kalendern automatiskt – flexiblare än hårdkodad regel.

---

OK att köra på detta? När du säger ja börjar jag med migrationen.