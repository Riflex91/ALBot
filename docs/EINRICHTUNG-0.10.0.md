# ALBot 0.10.0 – Einrichtung und vollständige Liveabnahme

Neue Projekte in den bestehenden Anbieter-Konten, ausschließlich neue Schlüssel und leere ALBot-Ressourcen. Keine Datenübernahme aus v3/v4/v5/ALFinal. Diese Anleitung ersetzt für den aktuellen Kandidaten die Einrichtung von 0.9.0. [Implementierungsumfang und Grenzen](IMPLEMENTIERUNGSSTAND-0.10.0.md).

## 1. Bot vorbereiten

1. Den Branch aus [PR #32](https://github.com/Riflex91/ALBot/pull/32) beziehen; vor einem Merge liegt der Kandidat nicht in `main`. Eigenes Werkstattprofil und laufendes CODE-Skript sichern.
2. Charaktere mit `ALBot.stop()` stoppen. Offene Wertjournale anhand tatsächlicher Bestände und Quittungen klären; keine Journale pauschal löschen.
3. `editor/Bot-Werkstatt.html` öffnen, eigenes Profil importieren, Charaktere/Rollen/Realm und Itemregeln prüfen. Das neue Schema ergänzt optionale Einstellungen. Keine Beispielcharaktere übernehmen.
4. Produktion aktivieren und die gewünschten Upgrade-/Compound-/Craft-/Exchange-Pfade freigeben. `purposeAllocation`, `finiteHelpers`, `skillSupplies`, `autoMarket`, `bossTactics` und `adaptiveLearning` sind neue bzw. vorhandene lokale Optionen. In neuen vollständigen Profilen sind die genannten Zusatzprüfungen aktiv; bisherige konkrete Aktionsfreigaben bleiben maßgeblich.
5. `autoHelpers` ist standardmäßig aus: Für den erweiterten Scroll-/Offering-Vergleich bewusst aktivieren. `finiteHelpers` ergänzt dann die Mehrschrittplanung. `tokenBuy` und `dismantle` bleiben ebenfalls opt-in. Mindestchance und Verlust-/Goldbudgets nicht für einen Test erhöhen. Prüfe insbesondere Schutzregeln für seltene Items.
6. Bankarbeitsplätze standardmäßig zwei je Pack; bei knappem Platz freigegebene Entlastungsregeln prüfen. Gold benötigt keine Plätze. Ein volles Inventar ist kein Grund, geschützte Gegenstände automatisch zu veräußern.
7. Für Bosse `world.bosses` und die konkrete `allowedBosses`-Liste konfigurieren. Teamrotation nur aktivieren, wenn der Bot die vorgesehenen Accountcharaktere starten/stoppen darf. Feste Leader/Mitglieder bleiben vorrangig. Bossfreigabe allein überstimmt weder Bereitschaft noch Karten-/Instanzfreigaben.
8. Vollständiges Skript aus der Werkstatt exportieren. Derselbe Export gehört in Browser-CODE und im vorhandenen Headless-Client nach `CODE/main.js`. Login/Verbindung bleiben beim Client. Exportiertes Skript kann gemäß Profil automatisch starten; für Einrichtungsprüfungen Autostart vorher ausschalten.

Diagnose: `ALBot.status()`, `ALBot.testReport()`, `ALBot.bossCatalog()`. Der Bot benötigt keine Cloud, um lokal zu arbeiten und zu lernen. Zugangsdaten nicht in das geteilte Werkstattprofil schreiben.

Entwicklungsprüfung mit Node >=22.9: `npm ci`, `npm run build`, `npm run build:editor`, `npm test`.

## 2. Kostenfreigabe vor jeder Aktivierung

Neue Projekte haben **keine automatisch neuen kostenlosen Kontingente**. Bestehende Projekte und andere Bots im selben Konto mitzählen. Wenn ein zusätzlicher kostenfreier Betrieb nicht möglich ist, den betreffenden Dienst ausgeschaltet lassen. Keine bezahlte Organisation, Tarifänderung, Zusatzkapazität oder KI-Gateway-Credits aktivieren.

| Dienst/Grenze | Tatsächliche Umsetzung |
|---|---|
| Merchant-Upload | Höchstens ein Versuch/Stunde und 24 Versuche/UTC-Tag, lokal gespeichert |
| Worker-Zulassung | Ein Durable Object begrenzt Snapshots **und Restore-Anfragen gemeinsam** auf 24/UTC-Tag |
| Payload | Snapshot höchstens 16 KiB; höchstens vier dauerhaft registrierte Charaktere |
| Supabase | Höchstens ein Upsert je Snapshot; bis zu vier aktuelle Zeilen, kein historisches Zeilenwachstum |
| B2 | Höchstens vier API-Aufrufe je Snapshot inklusive optionaler Löschung; keine automatischen Retries |
| B2-Speicher | Acht Versionen pro Snapshot-Charakter, höchstens vier Charaktere: maximal 32 Dateien bzw. 512 KiB JSON-Nutzdaten bei 16 KiB/File |
| Weitere Speicherdaten | Begrenzte Receipt-Manifeste und bis zu vier aktuelle Lerncheckpoints im Durable Object; Provider-Metadaten und Datenbank-Grundgröße gehören zusätzlich zur Anbieterquote |
| KI | Standardmäßig aus, höchstens ein Versuch/UTC-Tag, festes Modell, maximal 256 Ausgabetokens |
| Erneute Prüfung | Nach sieben Tagen ohne manuell erneuerte Kosten-/Kontingentfreigabe verweigert der Worker weitere Aufträge |

24 Snapshots täglich ergeben in 31 Tagen höchstens 744 Supabase-Upserts und 2.976 B2-Aufrufe. Restores verbrauchen dieselbe Quote und verringern diese Obergrenzen. Empfangene HTTP-Anfragen/Preflights können bereits vor der Zulassung als Cloudflare-Nutzung zählen.

Diese Grenzen kontrollieren ALBot. Sie messen nicht die gesamte Nutzung anderer Projekte im Konto und garantieren auf einem bezahlten Tarif keine Gebührenfreiheit. Es gibt keine automatisch verifizierte kontoweite Abrechnungsintegration über alle drei Anbieter. Voraussetzung sind passende **Free-Tarife und echte Anbieter-Caps**, nicht nur E-Mail-Warnungen.

## 3. Cloudflare neu einrichten

1. Bestehendes Konto auf **Workers Free** einschließlich SQLite Durable Objects prüfen. Für optionale KI zusätzlich sicherstellen, dass Workers AI wirklich im Free-Tarif arbeitet: Dort ist das tägliche Gratisbudget eine harte Grenze; Workers Paid kann Überschreitungen abrechnen.
2. In `cloud/wrangler.jsonc` einen neuen eindeutigen Workernamen setzen. `main`, `BUDGET`-Binding, Klasse `BudgetLedger` und Migration `new_sqlite_classes` beibehalten. Keine alte Worker-ID oder Durable-Object-Daten übernehmen. Die Datei enthält optional das `AI`-Binding, aktiviert Inferenz aber nicht.
3. `CHARACTERS` auf die tatsächlich genutzten Namen setzen, Komma-getrennt, maximal vier. Diese vier Namen sind auch über spätere Umbenennungen der Konfiguration hinweg eine dauerhafte Speichergrenze. `ALLOWED_ORIGINS` auf tatsächlich verwendete Spiel-Origin-Adressen begrenzen, standardmäßig `https://adventure.land`, kein `*`.
4. Wrangler installieren und im bestehenden Konto anmelden. Im Verzeichnis `cloud` zuerst `wrangler deploy --dry-run`, anschließend `wrangler deploy` ausführen. Alle Provider-/KI-Flags zunächst auf `false` lassen.
5. Einen neuen zufälligen Bot-Token mit mindestens 32 Zeichen erzeugen und als Secret setzen: `wrangler secret put BOT_TOKEN`. Token ausschließlich über den Terminal-Prompt eingeben, nicht ins Repository, einen Chat oder Logs schreiben.
6. `BOUNDED_RETENTION=true` **vor dem ersten Snapshot** beibehalten. Der Worker fixiert den Retention-Modus beim ersten Snapshot und verweigert spätere Moduswechsel. Die aktuelle Rotation ist für die neuen leeren Ressourcen vorgesehen.
7. Nach der nachfolgenden Providerprüfung `FREE_PLANS_CONFIRMED=true` und `BUDGET_VERIFIED_AT` auf den aktuellen ISO-UTC-Zeitpunkt setzen. Nur nach echter erneuter Kostenprüfung aktualisieren; kein automatisches Fortschreiben des Datums.
8. Optional KI: `AI_ENABLED=true` **und** `AI_FREE_PLAN_CONFIRMED=true` ausschließlich nach bestätigtem Workers-Free-Status. Festes Modell: `@cf/meta/llama-3.2-1b-instruct`. Kein frei konfigurierbarer kostenpflichtiger Modellname, kein externer KI-Key, keine AI-Gateway-Credits nötig. Bei erschöpfter Quote oder ungültigem Ergebnis arbeitet der Bot lokal weiter.
9. Änderungen mit `wrangler deploy` veröffentlichen. Diese Implementierung hat nur den Dry-run ausgeführt, keinen Worker in deinem Konto angelegt.

## 4. Supabase neu einrichten

1. Neues Projekt in einer **Free-Organisation** innerhalb des vorhandenen Logins erstellen, sofern noch ein kostenloser Projektplatz frei ist. Wenn ein bezahlter Plan nötig wäre, `SUPABASE_ENABLED=false` lassen.
2. Ausschließlich im neuen Projekt `cloud/supabase-setup.sql` über den SQL-Editor ausführen. Anschließend dessen Prüfqueries kontrollieren: RLS aktiv, keine Grants für `anon`/`authenticated`, keine öffentliche Lesepolicy.
3. Neue Projekt-URL als Worker-Variable `SUPABASE_URL` setzen. Den neuen serverseitigen Projekt-Key mit `wrangler secret put SUPABASE_SERVICE_KEY` hinterlegen. Der Key gehört **niemals** in den Browser-/Headless-Bot.
4. `SUPABASE_ENABLED=true`, anschließend Worker erneut deployen. Ein Snapshot speichert den Merchant-Checkpoint samt enthaltenen Teamaggregaten in `public.albot_learning`.

Keine alte Datenbank importieren. Kein Realtime, keine Edge Function, kein Supabase-Storage-Bucket erforderlich. Ein leeres Projekt benötigt bereits eigenen Datenbankspeicher; das Bot-Payloadlimit beschreibt nicht diese Grundgröße.

## 5. Backblaze neu einrichten

1. Gesamtnutzung im bestehenden B2-Konto und Gratisgrenzen prüfen. Verfügbare tägliche Dollar-Caps auf null setzen und anhand der aktuellen Oberfläche bestätigen, welche Speicher-/Transaktionskategorien tatsächlich gesperrt werden. Benachrichtigungen allein genügen nicht.
2. Einen neuen **privaten, leeren ALBot-Bucket** erstellen. Keine alten Dateien oder Versionen übernehmen. Keine automatische Lifecycle-Löschung der Bot-Dateien konfigurieren: Sie würde die eigenen Receipt-Manifeste ungültig machen; die Bot-Rotation löscht selbst.
3. Neuen auf diesen Bucket beschränkten Application Key erstellen, für `albot/` begrenzen, soweit die Oberfläche dies unterstützt. Er benötigt `writeFiles` und `deleteFiles` für Upload sowie Löschung der exakt protokollierten alten Dateiversion. Keinen Master-Key verwenden. Optionales manuelles Lesen kann mit einem getrennten Key erfolgen.
4. `B2_BUCKET_ID` als Worker-Variable setzen, `B2_KEY_ID` und `B2_APPLICATION_KEY` über `wrangler secret put ...` als Secrets hinterlegen. `B2_ENABLED=true` erst nach der Kostenprüfung und dann erneut deployen.
5. Dateien erscheinen unter `albot/<Charakter>/<Zeitpunkt>.json`. Pro Snapshot-Charakter bleiben maximal acht durch ALBot bestätigte Versionen. Im normalen Betrieb lädt nur der Merchant hoch; Teamlernen befindet sich im Snapshot.

Bei verlorener Upload-/Löschquittung bleibt ein dauerhafter Pending-Marker und B2-Archivierung stoppt. Der Bot und lokale Lernprozess laufen weiter. **Nicht** den Budgetzähler/Marker löschen oder einen neuen Durable-Object-Namen wählen, um dies zu umgehen. Zuerst B2-Dateiversionen und gespeichertes Receipt-Manifest abgleichen; erst nach nachgewiesener Wirkung ist eine gezielte administrative Reparatur zulässig. Es gibt absichtlich keinen ungesicherten öffentlichen Reset-Endpunkt.

## 6. Bot mit dem Worker verbinden

Auf dem Merchant **vor dem exportierten Bundle** in einer privaten lokalen Startdatei setzen:

```js
globalThis.ALBotCloudConfig = {
  enabled: true,
  url: "https://DEIN-WORKER.DEIN-SUBDOMAIN.workers.dev",
  token: "HIER-LOKAL-DEN-NEUEN-BOT-TOKEN-EINTRAGEN"
};
```

Aktuell werden nur neue HTTPS-`workers.dev`-Adressen akzeptiert. Wer lokalen Botcode lesen kann, kann diesen eingeschränkten Bot-Token lesen; Supabase-/B2-Secrets bleiben nur im Worker. Farmer liefern ihre kleinen Lernaggregate per bestehendem Teamheartbeat an den Merchant; dafür benötigen sie keine Providerzugangsdaten.

Für einen expliziten Restore muss dieselbe private Worker-Konfiguration auch beim betreffenden Charakter vorhanden sein. Dann:

```js
ALBot.stop();
await ALBot.restoreLearning();
ALBot.testReport();
// Nach Prüfung der Diagnose:
ALBot.start();
```

Restore ist höchstens einmal pro Stunde pro lokalem Charakter möglich und zählt zur gemeinsamen Worker-Tagesquote. Nur maximal einen Tag alte Aggregate mit passendem Realm/Definitions-/Team-/Gearkontext werden übernommen; lokale vorhandene Evidenz bleibt maßgeblich. Ein frischer leerer Worker kann nichts wiederherstellen. Es werden keine Wertjournale, offenen Transfers oder KI-Vorschläge restauriert. B2-Archive werden nicht automatisch in neue Projekte importiert.

Cloudstatus: `disabled` = fehlende lokale Freigabe/Fähigkeit; `offline` = Netzwerkfehler; `cloud-unavailable` = Provider-/Einrichtungsproblem; `quota-exhausted` = Budget/Identitätsgrenze/Duplikat; `restored`, `restore-rejected`, `restore-unavailable` betreffen den expliziten Restore. Keine schnelle Fehlerwiederholung, Upload frühestens nach einer Stunde.

## 7. Liveabnahme in dieser Reihenfolge

| Schritt | Durchführung | Erwarteter Nachweis |
|---|---|---|
| Start/Stop | Zunächst ein Merchant, dann Farmer, Browser und Headless mit demselben Export | Richtige Version/Charaktere/Realm, frische Heartbeats, kein doppelter Scheduler, Stop beendet eigene Jobs |
| Bestandsaufnahme | Gear, Zutaten, Reagenzien, Schlüssel, seltene Varianten und Bank prüfen | Schutzgründe und Reservierungen nachvollziehbar; Gold zählt nicht als Slot |
| Gleichzeitige Ziele | Zwei freigegebene Ziele mit derselben Zutat und verschiedene Empfänger konfigurieren | Bedarf wird summiert, kein Doppelverbrauch/versehentlicher Verkauf |
| Mutation | Mit entbehrlichen zulässigen Items echte Vorschau, Upgrade und Compound prüfen | Richtige Scrolls, gleiche Compound-Identität/Level, Preis-/Chance-/Verlustlimit, bestätigter Ausgang |
| Seltene Mutation | Ultimate-Scroll nur testen, wenn ohnehin bewusst freigegeben und vorhanden | Erhaltener Input plus verbrauchter Scroll nach bestätigtem Fehlschlag gilt nicht als unklare Aktion; keinen seltenen Scroll nur für diesen Test opfern |
| Merchant | NPC-Verkauf, vorhandener Live-Bid, explizites Listing, später automatisches Listing bei echten Umsatzbelegen | Exakte Quittungen; neue ungeprüfte Marktpreise lösen keinen automatischen spekulativen Verkauf aus |
| Ablauf | Eigenes automatisches Listing nach TTL prüfen; Preis/Slot zwischen Planung und Dispatch ändern | Unverändertes Angebot wird quittiert zurückgenommen; verändertes Angebot bleibt unangetastet |
| Bankdruck | Knappes Inventar/Bank mit tatsächlich freigegebenem Überschuss | Freie Arbeitsplätze, sichere Entlastung oder begründetes Warten, keine geschützten Notverkäufe |
| Skills/Lieferung | Konfigurierte Reagenzien knapp werden lassen; Farmer neu starten | Begrenzter Bedarf, keine doppelte Lieferung nach Sessionwechsel, offene Vorgänge bleiben gesperrt |
| Normales Farmen | Mehrere vollständige Episoden, danach Gear/Realm ändern | Messdaten sichtbar, keine Erfolgsübertragung auf fremden Kontext, Fehler führen zu Abwertung statt Budgetlockerung |
| Bosse | Erst einfacher ausdrücklich erlaubter Boss mit sicherem Rückzug, dann anspruchsvollere Profile | Gruppe/HP/MP/Heilreserve, Guard-Phase, Adds und Abbruchgrund im Bericht; Katalogeintrag allein genügt nicht |
| Progression | `progressionAdvice` aktivieren; Browser und Headless vergleichen | Validierte `get_progression()`-Hinweise oder diagnostizierter lokaler Fallback, kein freier Kauf-/Bossbefehl |
| Cloud | Einen regulären Snapshot abwarten | Eine Supabase-Zeile/Update, eine private B2-Datei, keine alten Projektdaten, korrekter Budgetzähler |
| Rotation | Nach acht normalen Merchant-Backups die nächste Rotation prüfen | Älteste exakt protokollierte Version gelöscht, maximal acht Versionen des Merchant bleiben |
| KI optional | Mindestens fünf eigene Episoden und einen regulären KI-Tagesversuch abwarten | Nur gültige begrenzte Gewichte; Modellfehler/Quota/Schemafehler beeinträchtigen lokalen Betrieb nicht |
| Restore | Gestoppten Charakter mit passendem Kontext gezielt wiederherstellen | Nur Lernaggregate; keine Freigabe eines offenen Wertjournals |
| Ausfall/Restart | Cloud vorübergehend deaktivieren; Bot mit offenem Vorgang stoppen/neuladen | Lokaler Betrieb bleibt möglich, kein schneller Cloudretry, kein doppelter Wertdispatch |

Für jeden fehlgeschlagenen Schritt Testbericht und tatsächlichen Spiel-/Providerzustand sichern, ohne Tokens/Secrets. Ein unklarer Wertvorgang ist ein Reparaturfall, kein Anlass für pauschales Entsperren. Boss- und Wirtschaftserfolg müssen live gemessen werden; Offline-Tests ersetzen diese Abnahme nicht.

## Offizielle Quellen für die Einrichtung

- [Cloudflare Workers AI: Preise und Free-Hartgrenze](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Verwendetes Llama-Modell und JSON-Ausgabe](https://developers.cloudflare.com/workers-ai/models/llama-3.2-1b-instruct/)
- [Durable Objects Preise](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Supabase Kostenkontrolle](https://supabase.com/docs/guides/platform/cost-control)
- [Supabase API-Schutz/RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Backblaze Caps und Alerts](https://www.backblaze.com/docs/en/cloud-storage-data-caps-and-alerts)
- [Backblaze Dateiversion löschen](https://www.backblaze.com/apidocs/b2-delete-file-version)

Tarife und Kontingente vor Aktivierung aktuell prüfen. Es wurden keine neuen Providerprojekte angelegt, keine Secrets übernommen und keine Live-Spielaktionen ausgeführt.
