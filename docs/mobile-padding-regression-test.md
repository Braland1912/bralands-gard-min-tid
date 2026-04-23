# Regression Test Checklist: Mobile Bottom Navigation

Denna checklista säkerställer att innehåll på mobil inte döljs av bottennavigeringen efter `pb-24 md:pb-6` ändringarna.

## Admin-vyer (mobil 375-430px)

- [ ] **Översikt (AdminOverview)**
  - Navigera till /admin/dashboard på mobilbredd
  - Scrolla längst ner
  - ✅ Sista kortet/innehållet ska vara fullt synligt ovanför bottennavet
  - ✅ Ingen del av innehållet ska vara bakom "Översikt | Tidslogg | Team | Mer"

- [ ] **Tidslogg (AdminTimeLog)**
  - Navigera till /admin/timelogs på mobilbredd
  - Lägg till flera tidsstämplar om listan är tom
  - Scrolla längst ner
  - ✅ Sista tidsposten ska vara fullt synlig
  - ✅ "CSV" och "Lägg till" knappar ska nås enkelt

- [ ] **Team (AdminTeam)**
  - Navigera till /admin/team på mobilbredd
  - Se till att medlemslistan har flera poster
  - Scrolla längst ner
  - ✅ Sista medlemmen i listan ska vara fullt synlig
  - ✅ "Lägg till medlem"-knapp ska nås enkelt

- [ ] **Bjud in (InvitationManager)**
  - Navigera till /admin/invitations på mobilbredd
  - Generera några inbjudningslänkar
  - Scrolla längst ner
  - ✅ Sista inbjudningslänken ska vara fullt synlig
  - ✅ "Generera inbjudningslänk"-knapp ska nås enkelt

- [ ] **Rättelser (TimeCorrectionRequests)** – redan OK, verifikation
  - Navigera till /admin/corrections på mobilbredd
  - Scrolla längst ner
  - ✅ Sista rättelseförfrågan ska vara fullt synlig
  - ✅ Innehållet ska ha samma padding som övriga flikar

- [ ] **Schema (AdminSchedule)** – redan OK, verifikation
  - Navigera till /admin/schedule på mobilbredd
  - Scrolla till botten av veckovyn
  - ✅ Sista dagen (söndag) ska vara fullt synlig
  - ✅ "Publicera"-knappen ska nås enkelt

## Medarbetar-vyer (mobil 375-430px)

- [ ] **Startsida (Index)**
  - Logga in som medarbetare
  - Om schemasektionen är synlig, scrolla ner
  - ✅ "Se hela veckan"-länken ska vara fullt synlig
  - ✅ Inga element ska vara bakom sidfoten (om någon)

- [ ] **Min vecka (MySchedule)**
  - Navigera till /my-schedule
  - Se till att teamets vecka är utökad (flera medarbetare)
  - Scrolla längst ner
  - ✅ Sista medarbetarens schema ska vara fullt synligt
  - ✅ Innehåll ska inte klippas av

- [ ] **Min tid (MyTime)**
  - Navigera till /my-time
  - Ha några historiska tidsposter
  - Scrolla längst ner
  - ✅ Sista dagen/tidsposten ska vara fullt synlig
  - ✅ "Logga ut"-knapp ska nås enkelt

## Desktop-verifiering (för säkerhet)

- [ ] **Alla admin-flikar** – padding ska vara oförändrad på desktop
  - Öppna varje admin-flik på 1280px+ bredd
  - ✅ Ingen onödigt stor bottenpadding ska synas
  - ✅ Layout ska se identisk ut med före ändringarna

## Testmiljö

- **Enheter**: iPhone 12/13/14 (390px), iPhone SE (375px), Pixel 5 (393px)
- **Browsers**: Safari iOS, Chrome Android
- **Rotering**: Testa även landskapsläge (även om appen är optimerad för portrait)

## Noteringar vid test

| Flik | Datum testad | Testare | Resultat |
|------|--------------|---------|----------|
| Översikt | | | |
| Tidslogg | | | |
| Team | | | |
| Bjud in | | | |
| Rättelser | | | |
| Schema | | | |
| Min vecka | | | |
| Min tid | | | |

---

**Senast uppdaterad:** Efter PR med pb-24 padding-fix på admin-flikar
