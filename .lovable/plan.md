## Mål

Idag kopplas checklistor till pass per mall (shift-typ via `checklist_template_shift_types`, lodge-enhet via `checklist_templates.lodge_unit`). Vi lägger till **samma kopplingsmöjligheter på gruppnivå** så man kan styra många mallar samtidigt.

## Regler

- **Additivt (OR)**: en mall hamnar på ett pass om antingen mallens egen koppling eller dess grupps koppling matchar.
- **Oberoende fält**: en grupp kan ha shift-typer OCH/ELLER en lodge-enhet — de är två separata regler, inte ett AND-villkor.
- **Lodge-koppling triggar bara på dagpass med avfärd för enheten** (samma logik som idag).
- **Inga dubbletter**: om både mall och grupp matchar samma pass läggs mallen bara en gång.
- **Ingen mall-koppling raderas**: gruppkoppling är ett tillägg, befintliga mall-kopplingar fungerar som förut.

## Exempel

**Exempel 1 — Grupp "Säsongsstart" kopplad till shift-typ "Dag"**

Gruppen innehåller mallar: *Brandgenomgång*, *Nyckelrutiner*, *Wifi-koll*.
Ingen av mallarna har egen shift-typ-koppling.
→ Alla tre läggs automatiskt på varje nytt dagpass.

**Exempel 2 — Grupp "Lodge" kopplad till lodge-enhet "Laxen"**

Gruppen innehåller: *Lägenhet Nr2 Laxen*, *Extra städning Laxen*.
→ Båda mallarna läggs på dagpass där Laxen har avfärd.
*(Idag måste man sätta `lodge_unit = Laxen` på varje mall manuellt.)*

**Exempel 3 — Mall-koppling vinner inte, den adderas**

Grupp "Säsongsstart" kopplad till "Dag".
Mallen *Brandgenomgång* i gruppen har dessutom egen koppling till "Morgon".
→ *Brandgenomgång* läggs på både morgon- och dagpass.

**Exempel 4 — Grupp utan koppling**

Grupp "Övrigt" har varken shift-typ eller lodge-enhet.
→ Bara organisatorisk rubrik i admin/medarbetar-vyn, ingen auto-koppling. (Som idag.)

**Exempel 5 — Grupp med både shift-typ och lodge-enhet**

Grupp "Lodge-bytesdag" kopplad till shift-typ "Dag" OCH lodge-enhet "Kungsfiskaren".
→ Mallarna läggs på alla dagpass (från shift-typ-regeln) PLUS på dagpass med Kungsfiskaren-avfärd (lodge-regeln triggar inget extra här eftersom dagpass redan är täckt). I praktiken samma som bara "Dag" — användaren får varning i UI om dubbel-koppling är onödig.

## Teknisk plan

### 1. Databas
- Ny tabell `checklist_group_shift_types` (group_id, shift_type, unique(group_id, shift_type)). Speglar `checklist_template_shift_types`.
- Ny kolumn `checklist_template_groups.lodge_unit` (nullable text, samma CHECK-värden som mallens fält).
- GRANT + RLS: läs för authenticated, skriv för `can_manage_checklists()`.

### 2. Admin UI (`AdminChecklists.tsx`)
- I gruppens rad/redigering: lägg shift-typ-väljare (chips för Morgon/Dag/Kväll) och lodge-enhet-dropdown.
- Visa gruppkopplingar som chips på gruppens rubrik (likadana som mall-chips idag).
- I mall-listan: tysta chip som "ärvd från gruppen" så admin ser var koppling kommer ifrån.

### 3. Synk-logik
- `upsertShift` (i `AdminSchedule.tsx`): när nytt pass skapas, hämta mallar via union av:
  - `checklist_template_shift_types` (som idag)
  - `checklist_group_shift_types` → alla mallar i de grupperna
  - dedupa per template_id.
- `useSyncLodgeChecklists`: hämta mallar för avfärds-enheter via union av `checklist_templates.lodge_unit` + `checklist_template_groups.lodge_unit → mallar i gruppen`.

### 4. Visning (medarbetare)
Ingen ändring — checklistor visas redan grupperat. Effekten är bara att fler/färre mallar dyker upp automatiskt.

## Filer som rörs
- Migration (ny tabell + kolumn + grants/policies)
- `src/components/ChecklistGroupsManager.tsx` — koppling-fält i grupp-formulär
- `src/pages/AdminChecklists.tsx` — visa ärvda kopplingar
- `src/pages/AdminSchedule.tsx` — utöka `upsertShift`-hämtningen
- `src/hooks/useSyncLodgeChecklists.ts` — utöka mall-query

Godkänn så börjar jag med migrationen.