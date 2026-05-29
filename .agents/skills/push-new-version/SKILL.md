---
name: push-new-version
description: Notify all users of a new version of Bråland Gård 2026 by updating release notes and prompting publish. Use when the user says something like "pusha ut", "skicka ut ny version", "meddela alla om uppdateringen", or asks to notify users after shipping changes.
---

# Pusha ny version till alla användare

Appen visar en `UpdateBanner` baserad på innehållet i `public/release-notes.txt`. När filen ändras och en ny version publiceras får alla öppna klienter en notis om att ladda om.

## Steg

1. **Sammanfatta ändringarna** sedan förra release-noten på svenska. Ton: varm, enkel (15-årsnivå), inga emojis. Max 1–3 korta meningar eller en liten punktlista.
2. **Skriv över `public/release-notes.txt`** med den nya texten. Versionsnummer/datum bakas in automatiskt vid build — skriv bara själva beskrivningen.
3. **Verifiera** att filen är uppdaterad (`code--view public/release-notes.txt`).
4. **Be användaren publicera** så ändringen når alla:

```
<presentation-actions>
<presentation-open-publish>Publish your app</presentation-open-publish>
</presentation-actions>
```

## Riktlinjer

- Skriv ur medarbetarens perspektiv ("Nu kan du …", "Ny hjälpsida finns under menyn").
- Nämn bara det som faktiskt påverkar användaren — hoppa över interna refaktorer.
- Inga emojis, inga engelska ord när svenska finns.
- Rör inte versionsnummer eller datum manuellt.
