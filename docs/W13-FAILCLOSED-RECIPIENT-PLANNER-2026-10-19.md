# W13 – Fail-closed-Planung automatischer Empfängerlieferungen (19.10.2026)

## Reproduzierte Integrationslücke

`pendingDeliveryRuleNeeds()` berechnet aus Produktions- und Gearzielen
automatische `send`-Regeln. Die spätere Regelauswahl kann explizite
Itemvarianten bereits über `exactAutoDeliveryVariant()` vollständig
prüfen. Der frühere Lieferplaner verwendete stattdessen direkt
`identity({...g.variant})`. Nicht serialisierbare beziehungsweise zyklische
Zieldaten konnten eine Exception auslösen und so die Merchant-Planung
abbrechen. Ungültige Varianten durften weder als berechtigter exakter
Bestand noch als generisches Itemziel gelten.

## Integration

- Der vorgelagerte Planer verwendet nun exakt dieselbe kanonische
  `exactAutoDeliveryVariant()`-Prüfung wie die automatisch generierte
  Senderregel, einschließlich Item/Level-Konsistenz, maximaler
  Identitätslänge und serialisierbarer Varianten.
- Ungültige Empfänger, Itemnamen, Mengen oder Level liefern keine neue
  Lieferregel. Die Zahl der ausgewerteten Ziele ist auf 128 begrenzt.
- Fehler eines persistierten `delivered()`-Zählers oder einer
  physischen `available()`-Abfrage erzeugen für dieses Ziel keine
  Sendeabsicht. Nicht-integer Mengen beziehungsweise widersprüchliche
  Gesamt-/Variantenbestände bleiben bereits durch den vorhandenen
  Bestandsguard abgelehnt.
- Gültige generische und exakte Ziele konkurrieren weiterhin um den
  **gleichen** physischen Item-/Levelpool; verschiedene Empfänger
  dürfen eine Kopie nicht doppelt einplanen.
- Keine Änderung am eigentlichen `send_item`-Executor, Empfangs- und
  Versandjournal, bestehenden Delivery-Receipts, Benutzerschutz,
  Reservierungsregeln oder signierten Bootstrap-Release.

## Nachweise

Fünf zusätzliche Tests in
`test/roadmap-w13-failclosed-recipient-planner.test.mjs` behandeln
nicht serialisierbare Varianten, gültige disjunkte Empfängerplanung,
ungültige Lieferzähler, Abfrageexceptions und ungültige Ziele.

Die Arbeit ist ein **Laufzeit- und Planungsschutz**, keine abgeschlossene
kontoübergreifende W10/W13-Lootmission. Vollständige
Empfängerallokation, Lieferkettenrecovery und Ingame-Liveabnahme bleiben
offen. Der signierte Release wird nicht automatisch aktualisiert.

## Versionsintegration

Diese W13-Änderung wurde nach dem parallel gemergten PR #226
auf den aktuellen `main`-Versionsstand `0.10.12-candidate`
übernommen. Die generierten Entwicklungsartefakte werden aus der
kombinierten Source regeneriert, nicht mit veralteten 0.10.11-Dateien
überschrieben. Der separate signierte Release wird nicht verändert.
