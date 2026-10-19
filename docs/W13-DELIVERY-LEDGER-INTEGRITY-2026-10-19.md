# W13 – Persistiertes Recipient Delivery Ledger fail-closed

Datum: 19.10.2026. Baseline: `2d83ff2b29eaf19e382b98faf76482a8279545d5`.

## Ausgangslücke

Bei `createProduction()` wurde ein ungültiger gespeicherter
`albot:production:<owner>:deliveries`-Wert bisher ohne Sperre in
`{}` umgewandelt. Ein Neustart konnte dadurch offene
Liefernachweise verlieren; spätere Versand- oder Zielabrechnungen
konnten bereits physisch übergebene Mengen nochmals zählen.
`recordDelivery(j)` verwendete außerdem die übergebene
`j.quantity` ohne strikt nachzuweisen, dass sie eine endliche,
positive Ganzzahl war. Ein corrupt/uneindeutiger bestätigter
Transfer konnte somit einen nicht numerischen Zielstand erzeugen.

## Umsetzung

- `inspectRecipientDeliveryLedger()` prüft die vorhandene
  Version-1-Zielstruktur mit max. 1.024 Zielen, sicheren nichtnegativen
  Mengen und je max. 32 eindeutigen, wohlgeformten Transfer-IDs.
  Gültige historische Daten bleiben ohne Schema-Migration lesbar.
- Fehlerhafte persistente Lieferdaten werden **nicht** überschrieben.
  Die neue `deliveryLedgerUnsafe`-Diagnose kennzeichnet diesen
  Zustand; neue `send_item`-Zulassungen über
  `production.canRecordDelivery` und Liefergutschriften werden
  solange verweigert.
- Bestätigte Itemlieferungen erhalten nur mit gültigem Senderjournal,
  Itemnamen, Empfänger, ID und ganzzahliger positiver Menge eine
  dauerhafte Zielgutschrift. Ein fehlgeschlagener persistenter
  Schreibvorgang erzeugt keine vorgetäuschte In-Memory-Gutschrift.
- Die bestehenden idempotenten letzten 32 Transfer-IDs,
  physischen Empfängerquittungen, Mengenobergrenzen und
  übrigen Wertjournale bleiben unverändert. Eine über 32
  Transfers zurückliegende ID ist weiterhin kein unbegrenzt
  gespeicherter Receipt: Dies ist **keine** Garantie ewiger
  Deduplizierung oder vollständiger Accountallokation.

## Tests und Grenzen

Sechs neue Regressionen prüfen Neustart/Idempotenz,
beschädigte und überfüllte Persistenz, ungültige Sendebelege,
fehlgeschlagene Schreibvorgänge und den gültigen 32-ID-Vertrag.

Kein signierter Release, keine Loader-/Personal-Konfigänderung,
keine Live-Abnahme und keine neuen Wertoperationen.
