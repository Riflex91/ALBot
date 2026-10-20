# W02/W04 – Sichere Mengenbelege in reservierten Zwischenplatzfolgen

Stand: 20. Oktober 2026.

## Ausgangspunkt

Der existierende physische Sequenzplaner `planPhysicalSlotSequence`
sucht bis zu acht einzeln erlaubte Schritte bei endlichem Suchraum und
ist **kein** Executor, kein Bank- oder Marktjournal. Die einzelnen
Bank-API-Aufrufe und deren physische Wiederaufnahme bleiben auf den
bereits vorhandenen Single-/Partial-/Reclaim-Verträgen.

Der Planer hatte bisher `item?.q ?? 1` als Mengenbeleg verwendet:
ein ausdrücklich vorhandenes, aber ungültiges `q: null` wurde dadurch
wie ein implizites Einzelitem behandelt. Außerdem wurden deklarierte
eingehende/produzierte Itemmengen ohne Abgleich mit einem im
`item`-Beleg ebenfalls enthaltenen `q` in neue Stacks normalisiert.
Ein Plan konnte so trotz widersprüchlichem Quellbeleg `feasible:true`
liefern.

## Korrektur

- **Nur tatsächlich fehlendes** `q` steht für ein unge­stapeltes
  Einzelitem. Vorhandene Mengen müssen positive, sichere Ganzzahlen sein.
- Ein fehlerhaftes Eingangs-Inventar kann keinen physischen Slotplan
  begründen; `reason:invalid-inventory` ohne ausführbare Schritte.
- Ein eingehender oder deterministisch produzierter `item.q`-Wert,
  falls vorhanden, muss gültig und exakt gleich der erklärten Menge sein.
- Ganze Bankentnahme, Receive, Entfernen, Stapel-Merge und deterministische
  Produktion haben hierfür Regressionstests; legale ungestapelte Items und
  konsistente Mengen bleiben zulässig.
- Unverändert: explizite Aktionsberechtigungen, vor Dispatch erneut
  validierte Bankjournale, Grenzen der maximalen Schritt-/Zustandszahl,
  Inventar-Overflow-Regeln und persönliche Konfiguration.

## Abnahmegrenzen

Dies ist ein enger Belegschutz für W02/W04, **kein** vollständiges
Multi-Aktions-Recovery-Journal und **kein** Nachweis echten Spielbetriebs.
Keine signierte neue Ingame-Runtime ohne gesonderte Freigabe.
