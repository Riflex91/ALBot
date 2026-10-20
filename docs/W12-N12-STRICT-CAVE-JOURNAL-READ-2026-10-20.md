# W12/N12 – Strenger Cave-Journal-Lesepfad vor erneutem Eintritt

Stand: 20. Oktober 2026.

## Befund

ALBot nutzt bislang für viele unkritische Einstellungen die allgemeine
`p.read()`-Funktion. In `src/runtime/ports.mjs` fängt diese
fehlende `get()`-Capabilities und Fehler ab und gibt `null` zurück.
Die offizielle Adventure-Land-Funktion `get()` selbst gibt ebenso
bei beschädigtem JSON oder verweigertem `localStorage` lediglich
`null` zurück.

Für einen **persistierten Cave-Lifecycle-Datensatz** ist ein solches
`null` kein ausreichender Beleg, dass wirklich niemals ein
`cave_enter()` an den Server gesendet wurde. Nach Bot-Neustart
könnte eine defekte lokale Speicherung so fälschlich eine leere
Historie darstellen. Gerade das war durch den bisherigen
`dispatch-unknown`-Restart-Schutz ausgeschlossen werden sollen.

## Korrektur

- Die Spiel-Portschicht hat einen **separaten strengen Leser**
  `p.readCaveJournal(key)`. Für den benannten,
  validierten Cave-Lifecycle-Key liest er unmittelbar das
  ursprüngliche `cstore_`-Objekt aus derselben
  `localStorage`-Quelle, die der offizielle `set()`-Pfad nutzt.
  Parsefehler, unlesbarer Storage, nicht verfügbare Rohlesefunktion
  und übergroße/inkonsistente Rohwerte werden **nicht** zu
  `null` normalisiert, sondern explizit als Fehler signalisiert.
  Eine wirklich fehlende Storage-Zeile bleibt `null`.
- `createCaveLifecycle` verwendet diesen strengen Leser sowohl
  beim Neustart als auch **vor** jeder dauerhaften Änderung und
  **nach** dem Schreiben. Kann die Speicherung nicht verlässlich
  gelesen werden, geht der Lifecycle nach `storage-uncertain`
  und darf weder neue vorbereitete Cave-Eintritte anlegen noch
  einen bereits bekannten Versuch versenden oder verwerfen.
- Auf einem Host ohne verlässliche direkte `localStorage.getItem`-
  Schnittstelle bleibt Cave-Dispatch konservativ **gesperrt**;
  insbesondere wird nicht auf die mehrdeutige Convenience-`get()`
  zurückgefallen. Eine neue native Headless-Rohspeicher-API ist
  ein separater, zu prüfender Integrationsschritt.
- Die bisherige `p.read()`-Semantik für übrige Systeme sowie
  die offizielle Spielfunktion `get()` bleiben unverändert.
  Persönliche Einstellungen, Bank-/Goldjournale, Economy-Guards
  und Ingame-Release werden weder migriert noch überschrieben.

## Nachweis

Regressionen prüfen gültigen persistierten Datensatz,
wirklich fehlenden Datensatz, beschädigtes JSON, Lesefehler,
fehlende Hostfähigkeit, Nichtzulassung fremder Storage-Keys
und den entscheidenden Fall: **strenge Lesefunktion schlägt am
Checkpoint fehl und `cave_enter()` wird nicht ausgeführt**.

Diese Korrektur implementiert noch keinen autonomen Cave-Exit,
kein automatisches Re-Entry und keine Ingame-Serverabnahme. Der
bestehende explizite One-Shot-Dispatch bleibt bestehen, wenn
die journalführende Host-Persistenz belegbar verfügbar ist.
