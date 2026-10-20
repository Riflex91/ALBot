# W05/W08 – Eingangsbelege für Gear-Vergleich und Offline-Prioritäten

Stand: 20. Oktober 2026.

## Ursache

Die bisherige rollenübergreifende Gear-Fairness bewertete ein als
`complete:true` markiertes Profil auch dann als gültig, wenn in einem
kanonischen Slot ein Item ohne echten Namen oder mit einer ungültigen
Leveldefinition lag. Das aktualisierende `createGear.refresh()` legte
trotz fehlender Itemdefinition ein synthetisches `null` im Slot ab
und speicherte diesen Snapshot als vollständig.

Ein unbekanntes, aber vorhandenes Item durfte so als echte Ausrüstungslücke
in die automatische Priorisierung eingehen. Das ist keine belegte
fehlende Ausrüstung.

## Korrektur

- Nur physisch vollständige, kanonische Gear-Snapshots mit gültiger
  Klassen-/Charakterlevel-Angabe und mit einem bekannten Itemnamen
  sowie gültigem Itemlevel pro belegtem Slot aktualisieren das lokale
  Offline-Profil. Echte, explizite `null`-Slots bleiben fehlend.
- Ungültige/undefinierte belegte Slots, unbekannte Itemdefinitionen
  und nichtkanonische Felder werden nicht als belegter Mangel umgedeutet.
  Ein solcher neuer Peerbeleg wird **nicht** übernommen. Ältere gültige
  Beobachtungen behalten ihr ursprüngliches Datum und werden weiterhin
  über die schon vorhandene Frische- und Realmgrenze verworfen.
- Der Fairness-Score selbst akzeptiert nur vollständig belegte 15-Slot-
  Profildaten, sichere Itemnamen/Levels und gültige kanonische
  Zielslots sowie bekannte Gear-Rollen.
- Unverändert: Freigabe und Höhe expliziter Gearziele, Kauf-/Equip-
  Guards, Rollenverträglichkeit, persönliches Profil, geschützte
  Ausrüstung, tatsächlicher Budget-, Min-Chance- und Ausführungspfad.

## Tests und Grenzen

Gezielte Regressionen prüfen ungültige Belegfelder, nicht existierende
Itemdefinitionen, nachfolgende korrupte Heartbeats, gültige echte
Lücken, zusätzliche UI-Slots und die reine rollenübergreifende
Bonusermittlung.

Dies ist eine konservative W05/W08-Korrektur der **Belege**,
keine vollständige statbasierte Rollenbewertung, keine neue
Spiel-Liveabnahme und keine Signierung der Ingame-Runtime.
