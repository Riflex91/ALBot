> Historischer Stand 0.9.0. Für den aktuellen Kandidaten gelten [Einrichtung 0.10.0](EINRICHTUNG-0.10.0.md) und [Implementierungsstand 0.10.0](IMPLEMENTIERUNGSSTAND-0.10.0.md).

# ALBot 0.9.0 – Einrichtung des Kandidaten

Stand: 12.10.2026. Neue Projekte in **bestehenden Anbieter-Konten**, neue Schlüssel, keine Migration alter Bot-Daten. Die Laufzeit funktioniert ohne Cloud. Der aktuelle Umfang und noch offene Teile stehen in [IMPLEMENTIERUNGSSTAND-0.9.0.md](IMPLEMENTIERUNGSSTAND-0.9.0.md). Dies ist keine Behauptung eines vollständig implementierten autonomen Bots.

## 1. Bot aktualisieren

1. Aktuelles persönliches Werkstattprofil und laufendes CODE-Skript sichern. Vor dem Wechsel alle Charaktere über `ALBot.stop()` stoppen. Offene Wertjournale nicht löschen; unklare Transfers/Verkäufe zuerst anhand der Spielbestände klären.
2. `editor/Bot-Werkstatt.html` aus diesem Branch öffnen. Das vorhandene Profil importieren, Charaktere und Rollen prüfen. Explizite Itemregeln, Reserven und Gold-/Verlustbudgets bleiben maßgeblich. Neue Exporte starten gemäß bestehendem Vertrag automatisch.
3. Unter Produktion die gewünschten Optionen auswählen. `skillSupplies` liefert Material für tatsächlich konfigurierte Skills nach, Zielmenge standardmäßig 20. `autoHelpers` vergleicht vorhandene Scrolls und Offerings über echte Servervorschauen. `tokenBuy` erlaubt vorhandene Token für explizite lokale Produktionsziele; Standardhöchstwert ein Token pro Kauf. `dismantle` erlaubt ausschließlich verifizierten, wirtschaftlich lohnenden Verkaufsüberschuss. Die letzten drei Optionen sind zunächst aus und müssen bewusst eingeschaltet werden.
4. Mindestchance und Verlustbudget nicht für einen Test erhöhen. `merchant.bankWorkspace` reserviert standardmäßig zwei freie Plätze je Bankpack. `bankReclaim` räumt ausschließlich durch zulässige Regeln freigegebene Gegenstände auf; geschützte Items werden bei Platzmangel nicht geopfert. Gold belegt keinen Itemslot.
5. Mit der Werkstatt das vollständige Bot-Skript exportieren. Dasselbe exportierte Skript im Browser-CODE und im bestehenden Headless-Client als `CODE/main.js` verwenden. Nicht die unkonfigurierte Runtime über ein persönliches Profil schreiben. Login und Verbindungsaufbau bleiben Aufgaben des vorhandenen Clients.
6. Zuerst einen Merchant mit realistischen Budgets laufen lassen, anschließend die Farmer. `ALBot.status()` und `ALBot.testReport()` prüfen: `inventoryBlocked`, offenes Journal, Produktionsentscheidungen, Bankkapazität, Lernen und Cloudstatus. Die neuen Funktionen haben Offline-Nachweise; ein neuer gemeinsamer Browser-/Headless-Livetest steht aus.

Entwicklung: Node >=22.9, im Repository `npm ci`, `npm run build`, `npm run build:editor`, `npm test`. Das Bundle bleibt unter dem bestehenden Limit von 1.048.576 UTF-8-Bytes.

## 2. Kosten zuerst prüfen

Neue Projekte erhalten nicht automatisch neue kostenlose Kontingente. Alle vorhandenen Projekte und alten Bots im Anbieter-Konto mitzählen. **Solange ein kostenloser Betrieb im vorhandenen Konto nicht bestätigt werden kann, Cloud ausgeschaltet lassen.** Der lokale Bot lernt und arbeitet weiter.

Der Worker ist ein optionales Backup kleiner Lernzusammenfassungen. Er verwendet keine KI-API, keine Supabase Edge Functions, kein Realtime, kein R2 und kein D1. Er lädt keine alten Daten und lädt keine Strategien in den Bot zurück.

| Schutz | Implementierte Grenze |
|---|---:|
| Bot-Upload | nur Merchant, höchstens einmal pro Stunde, 24 Versuche/UTC-Tag |
| Zentrale Zulassung | zusammen 24 Snapshots/UTC-Tag, atomar in einem Durable Object |
| Nachricht | maximal 16 KiB, 64 feste Lernstatistiken |
| Supabase | maximal ein REST-Upsert je zugelassenem Snapshot; maximal vier aktuelle Charakterzeilen |
| Backblaze | maximal drei API-Aufrufe je Snapshot, keine automatischen Wiederholungen |
| Archiv | insgesamt maximal 1 MiB zugelassene Nutzdaten über die gesamte Lebensdauer des Budgetzählers |
| Prüfung | nach sieben Tagen ohne erneute Kontingentprüfung keine weiteren Provider-Schreibvorgänge |

Das sind **Anwendungsgrenzen**, keine Zusicherung für das gesamte Anbieter-Konto. Empfangene HTTP-Anfragen und CORS-Preflights können bereits vor der Zulassung beim Anbieter zählen. Deshalb ist der Free-Tarif selbst Teil der Voraussetzung. Auch Datenbank-/Dateimetadaten und vorhandene Fremdprojekte gehören zur Kostenprüfung. Ein bezahlter Plan mit bloßem Warnlimit genügt nicht als Garantie gegen Mehrkosten.

Nach Erreichen von 1 MiB bleibt das Archiv geschlossen. Den Zähler nicht löschen, den Durable-Object-Namen nicht wechseln und keinen täglichen Reset des Lebenszeitzählers einbauen. Eine spätere Retention-/Abrechnungsintegration ist separat zu implementieren. Das kleine Limit ist bewusst konservativ.

## 3. Neue Cloudflare-Ressourcen

1. Im vorhandenen Konto den Workers-Tarif und dessen gemeinsame Nutzung prüfen. Für diese Anleitung muss Workers Free einschließlich SQLite Durable Objects verfügbar sein. Keinen kostenpflichtigen Tarif oder Zusatzdienst aktivieren.
2. `cloud/wrangler.jsonc` lokal kopieren bzw. bearbeiten: eindeutiger neuer Workername; keine alten Ressourcen-IDs. Die Migration `new_sqlite_classes` erstellt das neue Budgetobjekt. Klassenname `BudgetLedger` und Binding `BUDGET` beibehalten.
3. Wrangler gemäß offizieller Anleitung installieren und im bestehenden Konto anmelden. Aus `cloud` zuerst `wrangler deploy --dry-run` ausführen. Danach `wrangler deploy` zum Erstellen dieses neuen Workers verwenden. Die ausgelieferten Flags bleiben dabei zunächst `false`.
4. Einen neuen zufälligen Bot-Token mit mindestens 32 Zeichen erzeugen und ausschließlich als Worker-Secret `BOT_TOKEN` setzen: `wrangler secret put BOT_TOKEN`. Eingabe erfolgt im Terminal-Prompt. Token nicht in Git, Logs oder einen Chat schreiben.
5. `CHARACTERS` auf die tatsächlichen erlaubten Namen setzen (Komma-getrennt, maximal vier). `ALLOWED_ORIGINS` enthält im Browser standardmäßig `https://adventure.land`; weitere tatsächlich verwendete Spiel-Origin-Adressen explizit ergänzen, kein `*`.
6. Erst nach den folgenden Provider-Schritten die jeweiligen Flags aktivieren. `FREE_PLANS_CONFIRMED=true` und `BUDGET_VERIFIED_AT` als aktuellen ISO-UTC-Zeitpunkt setzen, **nach** Prüfung von Tarif und Restkontingenten. Änderungen erneut deployen. Das Datum später nur nach erneuter Prüfung aktualisieren.

Konfiguration und Secrets gehören ausschließlich zu diesem neuen Worker. Ein unautorisierter POST auf `/snapshot` muss 401 liefern; ohne Budgetfreigabe liefert ein autorisierter Aufruf 503. Ein vollständiger Provider-Livetest wurde bei der Implementierung nicht ausgeführt.

## 4. Neues Supabase-Projekt

1. Im bestehenden Login ein neues Projekt in einer **Free-Organisation** anlegen, soweit das freie Projektkontingent reicht. Falls hierfür ein bezahlter Plan nötig wäre: Supabase ausgeschaltet lassen. Kein Upgrade auslösen.
2. Ausschließlich im neuen Projekt `cloud/supabase-setup.sql` im SQL-Editor ausführen. Danach die eingebauten Prüfqueries lesen: RLS aktiv, keine Grants für `anon` oder `authenticated`. Es gibt absichtlich keine öffentliche Lesepolicy.
3. Neue Projekt-URL als Worker-Variable `SUPABASE_URL` hinterlegen. Den serverseitigen Schlüssel des neuen Projekts über `wrangler secret put SUPABASE_SERVICE_KEY` eintragen. Der Schlüssel darf niemals im Browser, im Botprofil oder im Headless-Botcode stehen.
4. Worker-Variable `SUPABASE_ENABLED=true` setzen. Ein erfolgreicher Backup-Aufruf aktualisiert höchstens eine Zeile pro erlaubtem Charakter in `public.albot_learning`.

Keine alte Datenbank importieren. Kein Realtime, keine Edge Function, kein zusätzlicher Storage-Bucket erforderlich. Die SQL-Datei ist eine Einrichtungsvorlage, keine bereits ausgeführte Migration.

## 5. Neuer Backblaze-Bucket

1. Im bestehenden B2-Konto die gesamte Speichernutzung und die kostenlosen Kontingente kontrollieren. Bei den verfügbaren kostenpflichtigen Kategorien die täglichen Dollar-Caps auf null setzen; keine bloßen E-Mail-Warnungen als Kostensperre behandeln. Vor Aktivierung prüfen, wie die aktuelle B2-Oberfläche diese Caps auf Speicher und Transaktionen anwendet.
2. Einen neuen **privaten** Bucket nur für ALBot anlegen. Keine alten Objekte kopieren. Optional eine kurze Lifecycle-Retention, beispielsweise sieben Tage, konfigurieren; sie ersetzt den eingebauten Lebenszeitdeckel nicht.
3. Einen neuen auf diesen Bucket beschränkten Application Key mit nur den für Uploads benötigten Berechtigungen erstellen. Keine Master-Schlüssel verwenden.
4. `B2_BUCKET_ID` als Worker-Variable, `B2_KEY_ID` und `B2_APPLICATION_KEY` als Worker-Secrets hinterlegen (`wrangler secret put ...`). `B2_ENABLED=true` erst nach der Kostenprüfung setzen.
5. Backups erscheinen unter `albot/<Charakter>/<Zeitpunkt>.json`. Sie enthalten ausschließlich die begrenzten Lernstatistiken. Kein Restore in die Laufzeit ist implementiert.

## 6. Merchant mit dem neuen Worker verbinden

Nur auf dem Merchant **vor** dem ALBot-Bundle lokal setzen:

```js
globalThis.ALBotCloudConfig = {
  enabled: true,
  url: "https://DEIN-WORKER.DEIN-SUBDOMAIN.workers.dev",
  token: "HIER-LOKAL-DEN-NEUEN-BOT-TOKEN-EINTRAGEN"
};
```

Die URL muss zur neuen `workers.dev`-Adresse passen; andere Domains werden derzeit abgewiesen. Zugangsdaten gehören in eine lokale private Startdatei, nicht in das geteilte Werkstattprofil. Wer den Merchant-Browsercode lesen kann, kann diesen begrenzten Bot-Token lesen; Supabase-/B2-Schlüssel bleiben ausschließlich im Worker.

ALBot neu laden, Bericht lesen. `disabled` bedeutet fehlende Freigabe/Fähigkeit; `offline` Netzwerkfehler; `cloud-unavailable` Provider-/Einrichtungsfehler; `quota-exhausted` ausgeschöpftes Budget oder Duplikat. Nach einem Fehler gibt es keine schnelle Wiederholung, frühestens nach einer Stunde. Zum Abschalten `enabled:false` setzen und neu laden; Worker-Providerflags ebenfalls deaktivieren, wenn keine Backups mehr gewünscht sind.

## Quellen für die laufende Kostenprüfung

- [Cloudflare Durable Objects Preise und Free-Tarif](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Supabase Kostenkontrolle](https://supabase.com/docs/guides/platform/cost-control)
- [Supabase API und RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Backblaze Caps und Alerts](https://www.backblaze.com/docs/en/cloud-storage-data-caps-and-alerts)
- [Backblaze Upload-API](https://www.backblaze.com/apidocs/b2-upload-file)

Tarife ändern sich. Vor Freigabe die aktuellen Angaben und die tatsächlichen Konten prüfen. In dieser Implementierung wurden keine Anbieter-Ressourcen angelegt, keine Schlüssel übernommen und keine kostenpflichtigen Dienste aktiviert.
