# Kvällsrundan: tre flöden, en enhetlig modell

## Mål
Stödja personalen i tre situationer utan dubbelregistrering:
1. **Innan rundan** – registrera förbokade/förbetalda gäster (Campio/PayPal/kontant) utan att veta plats
2. **På rundan** – tilldela plats till förbetalda gäster, lägg till nya på fasta platser (1–21 / E1–E6), ta betalt
3. **Tillfälliga platser** – tält/litet fordon på gräs, med fri beskrivning, valbart länkad till en förbetald gäst

## Datamodell (långsiktig, ren)

Migration på `evening_round_guests`:
- Tillåt `place_label = NULL` även när status = `here` (idag implicit OK, men vi formaliserar betydelsen)
- Lägg till `accommodation_type = 'temporary'` (utöver `vehicle` och `tent`)
- Lägg till kolumn `temp_description text NULL` — fri text för tält/fordon/sällskap/var de står
- Lägg till kolumn `is_prepaid boolean NOT NULL DEFAULT false` — markerar "registrerad innan rundan"
  - Sätts till `true` när gästen skapas via FAB → "Förbetald gäst"
  - Behövs eftersom en gäst utan plats inte räcker som signal (en tillfällig plats har också `place_label = NULL` ibland)

Tolkning i UI:
- `place_label = NULL` + `is_prepaid = true` → **Inkommande** (väntar på platstilldelning)
- `place_label = NULL` + `accommodation_type = 'temporary'` → **Tillfällig plats**
- `place_label != NULL` → vanlig fast plats

## UI-flöden

### FAB (floating action button) med bottom sheet
Ersätter dagens enstaka "lägg till"-knapp. Tre val:

1. **Förbetald gäst** (registrera innan rundan)
   - Fält: namn, reg.nr (valfri), nationalitet, betalmetod, belopp, valuta, ankomst/avresa, notes
   - Ingen plats
   - Sparas med `is_prepaid = true`, `accommodation_type = 'vehicle'` (default)

2. **Ny gäst på fast plats** (det vanliga – dagens flöde)
   - Som idag: väljer 1–21 / E1–E6, betalning, etc.

3. **Tillfällig plats** (tält/fordon på gräs)
   - Fält: `temp_description` (obligatorisk), nationalitet, antal personer (i notes), betalning
   - Toggle: "Koppla till förbetald gäst" → väljarlista med inkommande gäster
     - Vald gäst får `accommodation_type = 'temporary'` + `temp_description` ifylld (ingen ny rad skapas)

### Listan på rundan

Ny sektion överst när det finns inkommande:
```
┌─ Inkommande (3) ────────────────────────┐
│ [Chip] Eva K. • Campio • 450 SEK        │
│ [Chip] Familjen Berg • PayPal • 600 SEK │
│ [Chip] Anna L. • Kontant • 300 SEK      │
└─────────────────────────────────────────┘
Tryck för att tilldela plats
```
- Klick på chip → öppnar platsväljare (befintliga lediga platser + "Tillfällig plats")
- Vid val: gästens `place_label` (eller `accommodation_type = 'temporary'` + `temp_description`) sätts, `is_prepaid` behålls för spårbarhet

Under: dagens lista med fasta platser och tillfälliga platser blandat sorterat.

### Knapprad ovanför listan
Bredvid "Förläng tidigare gäst" (i `EveningRoundExtendSearch`):
- **"Tillfällig plats"** – snabbväg som öppnar flöde 3 direkt

## Filer som påverkas

**Migration**
- `supabase/migrations/<timestamp>_add_prepaid_and_temporary.sql`

**Hooks**
- `src/hooks/useEveningRoundGuests.ts` — utöka typer (`is_prepaid`, `temp_description`, `'temporary'`), nya helpers `assignPlace()`, `linkPrepaidToTemporary()`

**Komponenter (nya)**
- `src/components/EveningRoundAddSheet.tsx` — FAB + bottom sheet med tre val
- `src/components/EveningRoundIncomingList.tsx` — inkommande-sektionen överst
- `src/components/EveningRoundAssignPlaceDialog.tsx` — platsväljare för inkommande gäst
- `src/components/EveningRoundTemporaryDialog.tsx` — formulär för tillfällig plats

**Komponenter (uppdaterade)**
- `src/pages/EveningRound.tsx` — visa inkommande-sektion, byt ut nuvarande FAB
- `src/components/EveningRoundModal.tsx` — stöd `accommodation_type = 'temporary'` + `temp_description`
- `src/components/EveningRoundCard.tsx` — visa "Tillfällig"-badge + beskrivning för temp-platser, "Förbetald"-badge för inkommande
- `src/components/EveningRoundExtendSearch.tsx` — lägg in "Tillfällig plats"-knapp bredvid förläng-knappen

## Inte i scope
- Ändring av export/CSV (kan göras senare när modellen sätter sig)
- Admin-vy för inkommande historik (kan läggas till om behov visar sig)

Klar att bygga?