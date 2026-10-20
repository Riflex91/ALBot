# W12/N12 – Begrenzter cave_info-Requestlebenszyklus (20.10.2026)

## Anlass

Der bereits integrierte read-only-Cave-Adapter bildet `cave_info()` und
den aktuellen Server-Snapshot ab. `cave_info()` ist laut
`kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`
ein asynchroner öffentlicher RPC-Wrapper um `cave_request('info')`.
Die Antwort ist ausschließlich eine **Besuchs-/Resume-Auskunft**,
keine Bestätigung eines neu eröffneten oder wiederaufgenommenen Runs.

Ein ausbleibender RPC konnte den bisherigen Adapter dauerhaft
`visitPending:true` halten. Außerdem blieb eine bereits zuvor
bestätigte `visit.available:true`-Auskunft während einer neu
gestarteten Leseanfrage bis zum Ablaufen des allgemeinen
Zwei-Minuten-Caches erhalten. Eine fehlgeschlagene neue Anfrage darf
niemals die vorherige Berechtigung wiederverwenden.

## Implementierung

- Jeder explizit ausgelöste Cave-Info-RPC bekommt ein **15-Sekunden-
  Antwortfenster**. Ein lokaler `status()`- oder `sample()`-Aufruf
  erkennt abgelaufene Calls; eine erst später eintreffende Promise
  wird darüber hinaus unmittelbar beim Auflösen erneut geprüft.
- Bei Zeitüberschreitung oder zurückspringender Monotonieannahme:
  `visitPending:false`, `visit:null`,
  `visitError:'request-timeout'`, alte Requestgeneration
  ungültig. Kein automatischer zweiter API-Aufruf.
- Der vorhandene Mindestabstand von **60 Sekunden ab ursprünglichem
  Request** gilt auch nach Timeout. Ein neuer Versuch benötigt
  ausdrücklich wieder `ALBot.refreshCaveVisit()`; ein alter
  verspäteter Erfolg/Fehler kann die neue Antwort nicht überschreiben.
- Sobald eine neue explizite Anfrage beginnt, verfallen die vorherige
  `available`-/`resume`-Auskunft und ihr Zeitstempel. Ein Fehler
  stellt diese alten Rechte **nicht** wieder her.
- Fehlende oder Fehler werfende öffentliche Capability-Adapter
  verhindern die Anfrage, ohne eine andere Spiel-API zu versuchen.
- Bestehende eigene Instanz-/Teilnehmer-/Pause-/Währungs-/Vote-Checks
  sowie `canEnter`, `canResume`, `canVote`, `canExit` und
  `executable:false` bleiben unverändert.

## Abnahme

Neue Tests prüfen: nie beantworteter RPC, Zeitfenstergrenze,
Verspätung ohne zwischenzeitliches Polling, verspäteten alten Erfolg
nach neuer expliziter Anfrage, Fehler nach zuvor erfolgreicher
Berechtigung, Capability-Ausnahme, Uhrsprung und späte Ablehnung.

Damit wird der **read-only**-Zustandsreader restart- und
antwortsicherer. Die eigentlichen Cave-Entry-/Resume-/Vote-/Exit-
Mutationen benötigen noch separate vor dem Dispatch persistierte
Journale und echten Ingame-Servernachweis. W12/N12 ist ausdrücklich
weiter offen; der signierte Runtimekanal bleibt unverändert.
