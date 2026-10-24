# ALBot Konfigurator – Cloudflare-bereite Vorstufe

## Privaten signierten Release im Konfigurator nach D1-Migration verankern (24.10.2026)

In **System & Synchronisierung** gibt es jetzt einen eigenen Nachweis für die veröffentlichte **D1-Signatursequenz**. Der Worker liest ihn ausschließlich nach Anmeldung über Cloudflare Access. Ist die Tabelle noch nicht eingerichtet, erscheint eine konkrete Sperrmeldung mit Verweis auf den bereits implementierten [manuellen D1-Migrationsworkflow](https://github.com/Riflex91/ALBot/actions/workflows/manual-konfigurator-d1-highwater.yml). Ein erfolgreicher Cloudflare-Deploy alleine erstellt keine Tabelle.

Sobald die D1-Tabelle erreichbar ist, lässt sich ein bereits vorhandener privat signierter Full-v1-Release durch **„Signierten Release nach Prüfung in D1 registrieren“** ausdrücklich abgleichen. Auch ein älterer oder inzwischen abgelaufener, aber privat gültig signierter Release kann als notwendige Vorgängerrevision verankert werden, bevor eine neue Profilrevision signiert wird. Die Oberfläche erfindet weder Release-SHA noch Sequenz und erlaubt keine Registrierung einer zurückgesetzten Version. Vor der Aktion werden der private Status und die unabhängig gespeicherte D1-Revision erneut vom Server gelesen und gegen die zuvor angezeigten Identitäts-/SHA-/Sequenzdaten verglichen. Nur wenn beide unverändert sind, erscheinen Signatursequenz, SHA-256, privater GitHub-Blob-SHA, Signierschlüssel-Fingerprint, bisherige Sequenz und Ablaufzeit zur **ausdrücklichen Bestätigung**. Erst danach erfolgt ein same-origin `PUT /api/profile-sync/signed-highwater`.

Der Cloudflare-Worker vertraut den Browserwerten **nicht**: Er verifiziert separat die private Repository-Identität, den vollständigen P-256-signierten Release, die Zielbindung und den D1-Vergleich. Fehlt die D1-Tabelle, scheitert ein Read oder ist der D1-Höchststand höher beziehungsweise widersprüchlich, bleibt die Registrierung gesperrt. Beim erfolgreichen Write wird der tatsächliche D1-Eintrag erneut geprüft. Nach Zustimmung wird der Status frisch geladen; ein gesperrter oder nicht authentifizierter Client kann diese Aktion nicht ausführen.

**Sicherheitsgrenze:** Die Erstregistrierung dokumentiert nur die **privat signierte Veröffentlichung**, nicht den Abruf, die Ingame-Aktivierung, ein manipulationssicheres angewendetes Journal oder einen authentifizierten ACK. Es wird kein Full-v1-Profil durch den Browser geschrieben, keine Ingame-Konfiguration ersetzt und kein persönlicher Signierschlüssel gespeichert. `applied:false` und `acknowledged:false` bleiben verbindlich. Der produktive D1-Migrationsworkflow sowie die Owner-Registrierung werden nicht automatisch durch Merge oder Deployment gestartet.

## D1-Publikationsanker kontrolliert initialisieren – manueller GitHub-Workflow

Der neue Workflow [Manual ALBot Konfigurator D1 signed high-water maintenance](https://github.com/Riflex91/ALBot/actions/workflows/manual-konfigurator-d1-highwater.yml) erlaubt die bisher ausstehende additive D1-Migration **ohne persönliche Cloudflare-Zugangsdaten in einen Chat, eine Datei oder den Quellcode zu kopieren**. Er verwendet ausschließlich die für den bestehenden Cloudflare-Deploy konfigurierten GitHub-Actions-Secrets und das vorhandene D1-Ziel `albot-konfigurator`.

**Bedienung:** In GitHub Actions den Workflow öffnen, `Run workflow` auf dem aktuellen `main` auswählen und zunächst `operation = inspect` setzen. Als `expected_main_sha` den vollständigen 40-stelligen aktuellen `main`-Commit eintragen und bei `confirm_database` exakt `albot-konfigurator`. Die Inspektion liest nur das öffentliche **Tabellenschema** aus SQLite (`sqlite_master`), keine persönlichen Profile oder Telemetriedaten. Eine erfolgreiche Inspektion bedeutet **nicht automatisch**, dass die Tabelle schon existiert; der SQL-Ausgabe ist die tatsächliche Verfügbarkeit zu entnehmen.

Für die additive Einrichtung anschließend denselben Ablauf ausdrücklich mit `operation = migrate` starten. Vor jeder Verbindung verifiziert das Repository-Skript `konfigurator/scripts/verify-d1-migration.mjs`, dass die separate Migration `konfigurator/migrations/001_signed_config_highwater.sql` **ausschließlich** das exakt erwartete `CREATE TABLE IF NOT EXISTS signed_config_highwater` enthält, mit dem Hauptschema übereinstimmt und den bereits vorhandenen Datenbanknamen, D1-Identifier und Worker-Binding `DB` verwendet. Der Schritt danach fragt sämtliche sechs Spalten in einer `LIMIT 0`-Abfrage ab und schlägt fehl, wenn Tabelle oder Spalten fehlen. Der Vorgang ist idempotent; bestehende `character_snapshots` und `bank_snapshots` werden nicht angefasst. Die Produktions-Deploypipeline führt **weiterhin niemals** Datenbankmigrationen aus.

**Wichtig nach einer erfolgreichen Migration:** Ein früher signierter privater Full-v1-Release ist dadurch noch nicht serverseitig registriert. Seine bestehende P-256-signierte Account-/Sequenz-/Digest-Evidenz muss über die **bereits vorhandene, Cloudflare-Access-geschützte** `PUT /api/profile-sync/signed-highwater`-Schnittstelle mit ausdrücklicher Owner-Bestätigung abgeglichen werden. Der Workflow selbst initiiert diesen Schritt **nicht** und benötigt keine privaten Repository-Tokens oder Signaturschlüssel. Bei unbekanntem Release/fehlendem Schlüssel bleibt die Auslieferung gesperrt.

**Statusgrenze:** Dieser kontrollierte Einrichtungsweg ist im Repository verfügbar, führt aber **nicht automatisch** eine produktive Migration aus. Ein erfolgreicher Linux-/Windows-CI-Lauf oder Cloudflare-Deploy ersetzt keinen bestätigten `migrate`-Workflowlauf. D1 bestätigt nur signierte Veröffentlichungen, keine Ingame-Anwendungen oder authentifizierten Charakter-ACKs.

## Verbindlicher D1-Publikationsanker – Signieren und Ausliefern fail-closed (24.10.2026)

Die private signierte Full-v1-Zustellung ist nun serverseitig an den D1-High-Water-Nachweis gekoppelt. `PUT /api/profile-sync/prepare` liest **vor jedem Signatur-/GitHub-Schreibvorgang** den D1-Anker. Besteht bereits ein privater Release, muss seine unabhängig überprüfte P-256-Sequenz, Profil-SHA-256 und GitHub-Blob-SHA **exakt** mit dem verankerten Konto- und Schlüsselstand übereinstimmen. Ein noch nie signierter Account darf nur dann bei Sequenz 1 beginnen, wenn auch der Anker leer ist. Ein fehlendes D1-Schema, ein beschädigter Datensatz, ein Rollback oder ein geänderter Signierschlüssel wird nicht als Anfangsstand interpretiert.

Nach dem privaten GitHub-CAS-Schreibvorgang muss der neue signierte Release mittels atomarem D1-CAS registriert und durch erneutes Lesen bestätigt werden, **bevor die API Erfolg meldet**. `GET /api/profile-sync/delivery` verlangt ebenfalls den *exakt passenden* D1-Anker; selbst eine gültige alte Signatur aus einem zurückgesetzten GitHub-Repository wird nicht mehr ausgeliefert. `GET /api/profile-sync/status` hält die Signatur-/Profilanalyse getrennt und meldet `publicationAnchorReady:false` und `deliveryReady:false`, wenn D1 fehlt, die Registrierung aussteht oder die Veröffentlichung widersprüchlich ist.

**Verteilte-Transaktion-Grenze:** GitHub und D1 bieten keinen gemeinsamen atomaren Commit. Schlägt D1 *nach* einem erfolgreichen privaten GitHub-Schreibvorgang fehl, meldet der Worker einen Fehler und blockiert jede Auslieferung. Der Benutzer kann die vorhandene private signierte Revision anschließend ausschließlich über das bereits Cloudflare-Access-geschützte, same-origin `PUT /api/profile-sync/signed-highwater` erneut signaturgeprüft registrieren. Der Worker erstellt hierbei keinen zweiten Release und schreibt kein angewendetes Ingame-Journal. Gleichzeitige Veröffentlichungen werden über GitHub- und D1-CAS und den abschließenden D1-Leseabgleich eingeschränkt; eine echte verteilte atomare Commitgarantie wird nicht behauptet.

**Vor produktiver Verwendung erforderlich:** Die additive Tabelle `signed_config_highwater` muss mit genehmigten Cloudflare-Zugangsdaten aus `konfigurator/schema.sql` angelegt werden. Für einen vorhandenen, noch nicht D1-verankerten signierten Release muss die einmalige **explizite und authentifizierte** Erstregistrierung über den High-Water-Endpunkt erfolgen. Vor diesem Schritt funktionieren bestehende signierte Konfigurationsabrufe bewusst nicht mehr. Die GitHub-Actions-Cloudflare-Deploymentpipeline führt weiterhin **keine** Datenbankmigration durch. Kein persönliches Profil, Token oder Signaturschlüssel wird automatisch bearbeitet.

Dieser Anker beweist ausschließlich den signierten *Veröffentlichungsstand*. Es gibt weiterhin **keine autorisierte atomare Ingame-Profilaktivierung**, keinen manipulationssicheren **angewendeten** Sequenznachweis und kein authentifiziertes Charakter-ACK. `applied:false` und `acknowledged:false` bleiben unverändert. Auch ein erfolgreicher Cloudflare-Deploy ist kein Ingame-Livetest.

## Serverseitiger D1-Sequenzanker für signierte Veröffentlichungen (24.10.2026)

Die Cloudflare-Access-geschützte Worker-Schnittstelle `/api/profile-sync/signed-highwater` ist ein eigenständiger, ausdrücklich benutzergesteuerter Nachweis für den **höchsten serverseitig erfassten signierten Veröffentlichungsstand**. `GET` liefert ausschließlich Konto-Sequenz-Metadaten und meldet `anchored:false`, solange noch nichts erfasst wurde. Ein explizites **same-origin PUT** mit `{ "confirm":true, "releaseSha":"<40 hex>", "sequence":N, "sha256":"<64 hex>" }` liest die vollständige private Release-Datei unmittelbar erneut aus GitHub, prüft deren privates Repository, die unabhängig im Worker gehaltene P-256-Signatur, Konto und monotonen Sequenzstand und vergleicht sämtliche bestätigten Felder. Der Browser kann weder eine beliebige Sequenz noch eine vermeintliche Anwendung behaupten.

Ein atomarer D1-`INSERT ... ON CONFLICT DO UPDATE ... WHERE` verhindert serverseitig ältere Revisionen, widersprüchliche Digests für dieselbe Sequenz und unbemerkte Signierschlüsselwechsel. Gleiche Sequenz, Digest und private GitHub-Datei-SHA sind **nur idempotente Veröffentlichungsevidenz**; ein höherer Stand wird nie mit einem niedrigeren überschrieben. Ein zweiter D1-Read bestätigt den tatsächlich gespeicherten Stand auch bei konkurrierenden Workers. Ein Fehler oder eine fehlende Tabelle führt zu **503**, niemals zu einem erfundenen Sequenzstand 0. Token, JWK-Privatmaterial und komplette Profilbytes werden nicht in D1 oder in eine Antwort geschrieben.

**Einmalige, ausdrücklich durchzuführende additive Migration:** Die vorhandene Free-tier-D1-Datenbank `albot-konfigurator` erhält die Tabelle `signed_config_highwater` aus `konfigurator/schema.sql`, beispielsweise über `cd konfigurator && npx wrangler d1 execute albot-konfigurator --remote --file=./schema.sql` mit dafür autorisierten Cloudflare-Zugangsdaten. Das reguläre Worker-Deployment führt **keine** D1-Migration aus. Ohne diese ausdrückliche Datenbankinitialisierung ist der neue Endpunkt nicht betriebsbereit; er löscht oder ändert keine vorhandenen Charakter-/Bank-Snapshots. Ein erster PUT setzt einen aktuell kryptografisch verifizierten **Publikationsanker**, kann aber nicht beweisen, dass ältere, noch nie verankerte Veröffentlichungen existierten. Die Signier- und Publikationspipeline verifiziert diesen separaten D1-Anker **noch nicht verpflichtend**, daher ist dies noch kein vollständiges End-to-End-Rollback-Protokoll.

**Grenze:** `issuedOnly:true`, `applied:false`, `acknowledged:false` bleiben für den Anker stets verbindlich. Dieser Datensatz beweist *nicht*, dass eine Ingame-Runtime den Release abgerufen, aktiviert oder verarbeitet hat; auch der signierte Release selbst ist nicht mit der separaten, geschützten **Ingame-Runtime-Signatur** gleichzusetzen. Automatische sichere Full-v1-Anwendung, authentifizierte Ingame-ACKs und eine unabhängige Spielidentitätsbindung fehlen weiterhin. Kein persönliches CODE-Profil, Signierschlüssel, Cloudflare-Secret oder offizieller Ingame-Release wurde geändert.

## Manuelles Aktivierungs-Review-Journal – keine Aktivierung (24.10.2026)

Das neue Modul `src/runtime/config-sync-review-journal.mjs` führt eine **explizit auszulösende, metadata-only Vormerkung** ein. Ein Benutzer kann ausschließlich nach einem gültigen charaktergebundenen P-256-Staging und einem erneut geprüften lokalen Safe-Point mit `ALBot.prepareConfigActivationReview()` die vorgeschlagene Profilrevision für die spätere Freigabe vormerken. `ALBot.configActivationReviewStatus()` zeigt Zielaccount, Charakter, Sequenz, SHA-256, Ablauf und mögliche Gründe für fehlende aktuelle Bestätigung. `ALBot.discardConfigActivationReview()` verwirft ausschließlich die Vormerkung dieses Charakters; andere Charaktere und das Journal des tatsächlich angewendeten Profilstands bleiben unverändert.

Persistiert wird lediglich ein begrenzter Beleg mit `state: "review-only"`. Keine privaten Full-v1-Profilbytes, Signaturen, Tokens oder Konfigurationsfelder gelangen in den Review-Speicher. Nach CODE-Neustart existiert allenfalls ein **nicht autoritativer** lokaler Vermerk; erst eine erneute unabhängige Signaturprüfung im Popup, ein wiederhergestellter sicherer Charakterzustand und ein **erneuter expliziter** Prepare-Aufruf können die aktuelle in-memory Vormerkung bestätigen. Fehlerhafte Speicherung, TTL-Ablauf, beschädigte Daten, Trust-Wechsel, Rollback- oder Charakterabweichungen führen zur Sperre.

**Sicherheitsgrenze:** Browser-`localStorage` ist manipulierbar und eignet sich nicht als vertrauenswürdiger Sequenzanker. Das Review-Intent ist weder ein Commit-Log noch ein ACK. Selbst im idealen Safe-Point bleibt `readyForActivation:false`, `applied:false`, `acknowledged:false`. Das System führt keine Mutationen an `ALBotConfig` oder `bot.cfg` aus und erhöht niemals `albot:config:applied:v1:<target>`. Die echte atomare Aktivierung, ein unabhängiger accountweiter High-Water-Dienst und authentifizierte per-Charakter-Bestätigungen fehlen weiterhin. Die Version **0.48.0-candidate** ist ein nicht signierter Quellkandidat; eine offizielle signierte Ingame-Veröffentlichung erfordert einen gesonderten geschützten Release- und Liveprüfprozess.

## Konservativer lokaler Safe-Point-Preflight (24.10.2026)

Die Ingame-Runtime kann jetzt per `ALBot.configActivationPreflight()` einen **ausschließlich lesenden** Bericht zur lokalen Sicherheit einer späteren signierten Profilübernahme ausgeben. `ALBot.configSyncStatus().safePoint` enthält dieselbe strukturierte Evidenz. Dafür müssen eine unabhängig signierte, gültige und noch im Arbeitsspeicher verifizierte Staging-Revision, ein tatsächlicher lebender Adventure-Land-Charakter und ein pausierter ALBot vorliegen. Zusätzlich prüfen die Wächter auf offene/undauerhafte Inventarjournale, laufende Executor-Aktionen, ausstehende Bank-/Logistik-/Gold-Reservierungen, Kampfziele und Team-Aggro, aktuelle Bewegungen und Smart-Move, sowie Server-/Lifecycle-Übergänge. Fehlende oder beschädigte Beobachtungswerte werden nicht als Entwarnung gewertet; die Gründe erscheinen als eindeutige `blockers` ohne geheime Profilwerte.

**Wichtig:** `locallyQuiescent: true` bedeutet nur, dass diese lokalen Zustände in **einem einzelnen Beobachtungsmoment** keine bekannten Blocker aufweisen. Das ist weder eine Autorisierung, noch eine globale Teampause, noch der Nachweis einer atomaren Full-v1-Konfiguration. `readyForActivation`, `applied` und `acknowledged` bleiben **immer false**. `activationBlockers` nennen explizit die weiterhin fehlenden Komponenten: manipulationsgeschützter accountweiter Rollback-/High-Water-Nachweis, atomare Full-v1-Anwendung mit Recovery und authentifizierter Charakter-ACK. Es wird kein `ALBotConfig`, `bot.cfg` oder angewendetes Journal geschrieben, kein signiertes Live-Release verändert und kein Browser-/Game-Token hinzugefügt.

Die Quell- und Kandidatenruntime wird dafür als **0.47.0-candidate** geführt. Der separat ECDSA-signierte Ingame-Release-Kanal bleibt bis zur eigenen geschützten Release-Freigabe auf seinem zuvor geprüften Stand. Die Cloudflare-Deploy-Pipeline veröffentlicht lediglich den Konfigurator-Worker und seine öffentlichen Assets; sie ersetzt weder diese Freigabe noch einen Live-Spieltest.

## Ingame-Popup mit sicherem Charakter-Staging verbunden (24.10.2026)

Der vorhandene Cloudflare-Access-Popup-Abruf kann in der **neu gebauten Quellruntime** eine privat signierte Full-v1-Revision nach unabhängiger Ingame-Signaturprüfung an das charaktergebundene Staging übergeben. `ALBot.openConfigSync()` öffnet ausschließlich den einmaligen, manuell freigegebenen Abruf; `ALBot.configSyncStatus()` unterscheidet `verified` von `staged` und gibt niemals Profilbytes zurück. Zur Laufzeit wird der tatsächliche Adventure-Land-Charaktername verwendet. Ein Angreifer kann keine fremde Account- oder Charakterrevision als eigenen Stand vorgaukeln, ohne die separat festgelegten Prüfschlüssel und die Signaturprüfung zu bestehen.

Nach einem CODE-Neustart kann dieselbe Sequenz **nur nach erneutem vollständigem signiertem Abruf** wieder im Speicher geprüft und vorgemerkt werden. Ein bloßes `localStorage`-Receipt begründet weiterhin keine Freigabe. Ungültiger Popup-Origin, falsches Fenster, Nonce, falscher Charakter, beschädigtes Receipt, abgelaufene Signatur oder veränderter angewendeter Cursor brechen den Vorgang ab. Das Staging erstellt **weder** einen angewendeten Profilstand `ALBotConfig`/`bot.cfg` **noch** einen Ingame-ACK; `readyForActivation`, `applied` und `acknowledged` bleiben ausdrücklich `false`.

Das Einbinden in den Runtime-Quellbuilder ist **keine Freigabe im offiziellen signierten Ingame-Kanal**: eine neue Runtime muss separat mit dem geschützten Signaturverfahren erzeugt, anhand des Releasedigests abgenommen und im Spiel bestätigt werden. Auch ein erfolgreicher Cloudflare-Deploy signiert die Game-Runtime nicht. Für aktive Konfigurationsübernahme fehlen weiterhin ein manipulationsgeschützter Rollback-Cursor, kontrollierte Safe-Points und authentifizierte Charakter-ACKs.

## Charaktergebundener, überprüfter Staging-Vertrag (24.10.2026)

Das neue isolierte Quellmodul `src/runtime/config-sync-stage.mjs` implementiert einen **Staging-only-Vertrag** für den späteren Ingame-Empfänger. Ein Staging-Versuch muss die vollständige signierte `albot.full/v1`-Revision erneut gegen einen unabhängig festgelegten P-256-Public-Key prüfen, einschließlich Zielaccount, kanonischem SHA-256, Schema, gültiger Sequenz und Ablaufzeit. Der aktuell ausgewählte Charakter muss als aktiver Charakter im signierten Profil vorhanden sein.

Erst danach schreibt das Modul ein begrenztes, charaktergebundenes **Metadaten-Receipt** in `localStorage`. Es speichert **keine privaten Profil- oder Signaturbytes** im dauerhaften Browser-Speicher. Der validierte Payload verbleibt ausschließlich im Arbeitsspeicher, kann über die Status-API nicht ausgelesen werden und wird beim Dispose verworfen. Der bestehende angewendete Sequenz-Cursor `albot:config:applied:v1:<target>` wird ausschließlich gelesen, niemals durch Staging erhöht. Ablaufzeit, Trust-Wechsel, veränderte Persistenz, konkurrierende Cursorbewegungen und korrupte Journale verhindern die Fortsetzung. Ein Neustart liefert deshalb nur `resumeRequiresReverification:true`, **niemals** eine vermeintlich bereits aktivierungsbereite Konfiguration.

**Noch nicht in den signierten Runtime-Bootstrap eingebunden:** Das Modul ist bewusst zunächst eine vollständig testbare Quellkomponente. Es verändert kein Live-`ALBotConfig`, kein `bot.cfg`, keinen Laufzeitzustand und erzeugt kein Ingame-ACK. Das persistierte Receipt ist aufgrund des manipulierbaren Browser-Speichers **kein kryptografisch verlässlicher Anti-Rollback-Anker und kein Charakter-Authentifizierungsbeweis**. Für echte Aktivierung fehlen ein unabhängig gesicherter Sequenzstand, ein atomarer Safe-Point und authentifizierte ACK-Evidenz. Es erfolgt keine stillschweigende Runtime-Neusignierung oder Livefreigabe.

## Zusätzliche Cloudflare-Sicherheitsgates (24.10.2026)

Die PR-Verifikation und der produktive Worker-Deploymentworkflow führen `konfigurator/scripts/verify-public-assets.mjs` aus. Vor dem Upload wird das tatsächlich paketierte `konfigurator/public/`-Verzeichnis geprüft: gesperrt werden symbolische Links, unerwartete Dateitypen, private Profil-/Release-Dateien, Schlüsseldateien, Sourcemaps und typische private Schlüssel- und Token-Muster. Der Guard wird nach dem Asset-Build vor der Produktivveröffentlichung **erneut** ausgeführt. Die Linux- und Windows-CI führt zusätzlich Regressionsprüfungen aus.

`konfigurator/test/security-gates.test.mjs` testet ohne Zugriff auf echte Secrets die Grenzen des Worker-Routings: Cloudflare-Access-JWT-Pflicht für geschützte API- und Websitepfade, Ungültigkeit gefälschter/abgelaufener JWTs, keine Gleichsetzung des Telemetrie-Bearers mit einer Profilfreigabe, exakte CORS-Ausnahme nur für `/api/ingest` und keine CORS- oder Schreibfreigabe für den privaten Konfigurationsabruf. Die Tests verwenden kurzlebige lokale Testschlüssel und ausschließlich synthetische Tokens.

**Geltungsgrenze:** Diese statischen und offline ausgeführten Prüfungen können weder den tatsächlichen Inhalt der Cloudflare-Access-Policies und Worker-Secrets auslesen noch eine erfolgreiche Browser- oder Ingame-Liveprüfung ersetzen. Auch eine grüne CI ist kein per-Charakter-ACK. Automatischer Ingame-Abruf und atomare Profilübernahme sind weiterhin nicht freigeschaltet.

## Nachweisbare Abrufbereitschaft und sieben Sync-Stufen (24.10.2026)

Die Systemansicht trennt nun **privat gespeichert**, **privat signiert**, **geschützt abrufbar**, **in der Runtime empfangen**, **in der Runtime geprüft**, **übernommen** und **charakterbezogen bestätigt**. Der Status `deliveryReady` wird nur bei gültiger, nicht abgelaufener, SHA-256-passender Signatur **und** erneuter Prüfung der privaten Repositorysichtbarkeit ausgegeben. Er beschreibt ausschließlich die Bereitschaft des bestehenden `/api/profile-sync/delivery`-Endpunkts hinter Cloudflare Access für das manuell geöffnete Popup. Er ist **weder ein Push ins Spiel noch ein Nachweis eines HTTP-Abrufs durch die Runtime**.

Für die Stufen Empfang/Validierung liegen serverseitig keine verifizierbaren Ereignisse vor, weshalb die Oberfläche ausdrücklich *Nicht nachgewiesen* meldet. Atomare Profilübernahme und authentifizierte per-Charakter-ACKs bleiben *Nicht implementiert*. Auch ein gefälschtes `applied:true` oder `acknowledged:true` in einem Statusobjekt kann die Nachweisstufen nicht auf bestätigt setzen. Es wird kein Game-Token erzeugt, keine Cloudflare-Access-Ausnahme erweitert und kein geheimes Profil in einen öffentlichen Branch geschrieben.

Dieser Schritt ändert **nicht** die signierte Adventure-Land-Runtime, keinen vertrauenswürdigen Signierschlüssel, keine persönlichen Profilwerte und keinen lokalen angewendeten Sequenz-Cursor. Eine spätere sichere Ingame-Aktivierung benötigt weiterhin eine unabhängige Account- und Charakteridentitätsprüfung, dauerhaft geschützte Sequenzverwaltung, Safe-Point-Transaktion und authentisches ACK. Bis zur expliziten Ingame-Abnahme wird keine Aktivierung behauptet.
 
## Manuell bestätigte und im Spiel verifizierte Konfigurationsvorschau (23.10.2026)

Die neue API `GET /api/profile-sync/delivery` steht **ausschließlich hinter Cloudflare Access** zur Verfügung. Sie gibt nur eine bereits kryptografisch überprüfte, gültige, noch nicht abgelaufene Full-v1-Revision aus dem bestätigten privaten GitHub-Repository zurück, wenn deren SHA-256 weiterhin der aktuell gespeicherten Profilrevision entspricht. **Keine neue Cloudflare-Access-Bypassregel**, kein Game-Origin-CORS für den privaten Profilinhalt und kein weiterer dauerhaft im Spiel gespeicherter Bearer-Token.

Die Ingame-Runtime erhält den **ausschließlich manuell ausgelösten** Befehl `ALBot.openConfigSync()` und den Status `ALBot.configSyncStatus()`. Beim Öffnen zeigt `config-sync.html` die genauen Datenschutzgrenzen an. Erst nach ausdrücklicher Freigabe sendet die bereits bei Cloudflare Access angemeldete Popup-Seite die signierte Revision über `postMessage` zurück an das mit Origin, Fensterquelle und einmaligem Zufallswert geprüfte Game-Fenster.

Die Ingame-Vorschau **verifiziert unabhängig vom Worker** erneut ECDSA-P-256-Signatur, Full-v1-Schema, SHA-256, Zielaccount, Ablaufzeit und steigende Sequenz. Dafür müssen vor dem Bootstrap im **persönlichen CODE** der Public Key und die feste Zielkennung *außerhalb des Cloudflare-Release-Payloads* vertrauenswürdig gesetzt werden, beispielsweise in `globalThis.ALBOT_CONFIG_SYNC_TRUST` mit den Feldern `target` und `publicJwk` (nur `kty:'EC',crv:'P-256',x,y`). Der Public Key wird **nicht** über die zu prüfende API nachgeladen; private Signierschlüssel und `INGEST_TOKEN` bleiben außerhalb dieser Konfiguration.

Die Vorschau liest streng den optionalen lokalen Datensatz `albot:config:applied:v1:<target>` als unteren Sequenzgrenzwert. Eine kaputte oder nicht lesbare Persistenz blockiert die Vorschau. Ein fehlender Eintrag bedeutet nur, dass noch keine angewendete Sequenz vermerkt ist; der lokale Browser-Speicher **ist noch kein hinreichend gegen Zurücksetzen gesicherter Rollbackschutz**. Dieser Schritt schreibt keine neuen Einträge, keine Spiel-ACKs und keine Konfiguration in die Runtime: `applied:false`, `acknowledged:false` bleiben zwingend. `verified` weist ausschließlich nach, dass ein signiertes Profil geprüft wurde; es ist kein Übernahmebeleg.

Der signierte 0.37-Release bleibt zunächst unverändert. Der Spiel-Vorschauempfänger liegt als unabhängig getestetes Quellmodul vor; die Einbindung in eine neue offiziell signierte Runtime ist eine **separate, noch nicht abgeschlossene Veröffentlichung**. Erst danach und nach Ingame-Liveprüfung kann er im Spiel genutzt werden. Ohne separate `CONFIG_SIGNING_JWK`/`CONFIG_SIGNING_TARGET`-Worker-Einrichtung oder unabhängig gepinnten Spielprüfschlüssel bleibt die Vorschau bewusst gesperrt.

**Nachfolgend noch umzusetzen:** ein Account-/Charakter-gebundener manipulationssicherer angewendeter Sequenz-Cursor, eine atomare Übernahme am Safe-Point mit vollständiger Runtime-Validierung und ein authentifizierter ACK, der unabhängig nachweisbar zwischen `verified` und `applied` unterscheidet. Bis dahin findet keine automatische Änderung der laufenden ALBot-Entscheidungen statt.


**Aktueller Betrieb, 22.10.2026:** Signierte ALBot-Runtime **0.34.0-candidate, Sequenz 34** (geschützter Signierworkflow #39808164061; Main-Runtime und Release-Runtime byteidentisch). Der Web-Konfigurator hat den privaten Full-v1-Signierablauf aus [PR #410](https://github.com/Riflex91/ALBot/pull/410), aber der gesonderte Konfigurationsschlüssel `CONFIG_SIGNING_JWK` und die stabile Zielkennung `CONFIG_SIGNING_TARGET` müssen vor einer tatsächlichen privaten Signierung ausdrücklich in Cloudflare eingerichtet sein. Ingame-Pull, atomare Übernahme und authentischer ACK sind weiterhin **nicht implementiert**. Der frühere 0.31-Banktelemetrie-Test bestätigt keine 0.34-Konfigurationssynchronisierung.


## Privaten signierten Profilstand vorbereiten (22.10.2026)

Der Konfigurator bietet unter **System & Synchronisierung** jetzt einen manuell bestätigten Signierschritt. `PUT /api/profile-sync/prepare` erfordert die **vollständig validierte Cloudflare-Access-JWT**, eine Same-Origin-Anfrage mit JSON, `confirm:true`, den exakten SHA-256-Fingerprint, den GitHub-SHA des gespeicherten Full-v1-Profils und den vorherigen Release-GitHub-SHA (oder `null`). Der Browser übermittelt niemals ein neues Profil oder den Signierschlüssel. Bei jeder Änderung dieser Werte wird mit 409 abgebrochen.

Der Worker liest das vollständige Profil ausschließlich aus dem bereits eingerichteten privaten GitHub-Konfigurationsrepository, berechnet den kanonischen SHA-256 erneut, kontrolliert den bisherigen signierten Release einschließlich historischer Signatur und Sequenz, bestätigt die **GitHub-Repositorysichtbarkeit `private:true`** und signiert eine neue Sequenz mit einem **separaten** ECDSA-P-256-Schlüssel. Der signierte vollständige Profilstand landet ausschließlich in einer separaten Datei **im privaten Konfigurationsrepository**, standardmäßig `albot/private-signed-release.json`, unter GitHub-SHA-Optimistic-Locking. Er wird weder in `Riflex91/ALBot` noch in D1 oder öffentliche Website-Dateien kopiert. Ein existierender Release mit anderer Signatur, Schlüsselidentität oder Zieldomäne verhindert die Erstellung des nächsten Releases.

### Erforderliche, noch manuell einzurichtende Worker-Einstellungen

- `CONFIG_SIGNING_JWK`: **Worker-Secret**, privater, separat zu generierender ECDSA-P-256-Schlüssel als JSON-Web-Key mit `kty,crv,x,y,d`. **Nicht** den Runtime-Release-Schlüssel oder das Telemetrie-`INGEST_TOKEN` wiederverwenden.
- `CONFIG_SIGNING_TARGET`: exakter und stabiler Zielaccount-Identifier, z. B. `ALBot/MeinAccount`, als Worker-Secret oder geschützte Variable. Er muss später bytegenau mit der gepinnten Zielkennung in der Ingame-Runtime übereinstimmen.
- `CONFIG_RELEASE_PATH`: optionaler separater Pfad im **privaten** Konfigurationsrepository, nicht identisch mit Profil- oder Richtliniendatei. Standard `albot/private-signed-release.json`.

Ohne beide Signiereinstellungen meldet die Website **Nicht eingerichtet** und bietet keine funktionsfähige Signierung an. Die signierte Revision enthält ein für 24 Stunden gültiges Paket, signiert ohne Wechsel des vertrauenswürdigen Runtime-Schlüssels. Ein Schlüsselwechsel oder Entfernen der Release-Datei erfordert später einen separaten kontrollierten Schlüssel-/Sequenzmigrationsprozess; niemals eine stillschweigende Rücksetzung.

**Begrenzung:** `signed:true` bedeutet ausschließlich, dass die **aktuelle** gespeicherte Revision in diesem **privaten Repository** signiert vorbereitet wurde. `published:false`, `applied:false`, `acknowledged:false` bleiben ausdrücklich unverändert. Es gibt noch **keine** öffentliche oder Ingame-Zustellroute, keine weitere Cloudflare-Access-Bypassregel, keinen Runtime-Autoupdater und keinen authentifizierten Charakter-ACK. Die Signatur-/Profilbytes dürfen erst nach Pinning des Public Keys im separat signierten Ingame-Code, sicherem Pull-Transport, dauerhaftem Rollback-Cursor und einem atomaren Safe-Point mit ACK verteilt bzw. aktiviert werden.


## Sicherer Konfigurationsabgleich – Revision/Signaturvertrag (22.10.2026)

Im Bereich **System & Synchronisierung** lässt sich der private GitHub-Profilstand jetzt **ausdrücklich und read-only** prüfen. Die unter Cloudflare Access geschützte Route `GET /api/profile-sync/status` lädt und validiert das Full-v1-Profil serverseitig und berechnet einen deterministischen SHA-256-Fingerprint über kanonisch sortierte JSON-Daten. Die Antwort enthält nur GitHub-SHA, Profil-SHA-256, Schemabezeichnung und Anzahl Bytes, niemals die enthaltenen Profiloptionen oder Zugangsdaten. Fehlende, ungültige oder nicht lesbare Profile gelten nicht als veröffentlicht. Ein Abruf erfolgt nur beim Öffnen des Systembereichs oder durch erneuten Nutzerklick; es gibt kein schnelles Polling oder eine neue D1-Tabelle.

**Sicherheitszustand:** `signed:false`, `published:false`, `applied:false`, `acknowledged:false`. Das ist keine vorübergehende kosmetische Anzeige, sondern der aktuelle technische Vertrag. Der Fingerprint bestätigt die Identität einer gespeicherten GitHub-Fassung, **nicht deren Signierung oder Annahme durch einen laufenden Bot**. Er gibt keinerlei Befugnis zu Verkäufen, Transfers oder Ingame-Konfigurationsänderungen.

Das neue reine Prüfmodul `konfigurator/public/config-sync-contract.mjs` definiert außerdem den späteren signierten Konfigurationsvertrag `albot-config-release/v1`: SHA-256 über kanonisches Full-v1-Profil, separat fest eingebauter ECDSA-P-256-Public-Key, exakte Zielaccount-Bindung, zeitlich begrenzte Gültigkeit und monoton steigende Sequenz. Tests prüfen manipulierte Daten, falsche Zielaccounts, abgelaufene Ausgaben, fremde Schlüssel und Replay/Rollback. Der Prüfer nimmt **selbst keine Anwendung vor**; vor einer Freigabe müssen mindestens ein ausdrücklich eingerichteter privater Signierkanal, eine dauerhafte gegen Rollback geschützte Sequenz, eine neue signierte Runtime mit sicherem Anwendungspunkt und ein authentischer Charakter-ACK real implementiert und abgenommen sein.

Es wird kein Schlüssel erzeugt, kein Token rotiert, kein Ingame-Loader geändert und kein Cloudflare-Access-Bypass erweitert. **Das private Full-Profil wird nicht in den öffentlichen Runtime-/Release-Branch kopiert.**


## Native Einstellungsansichten (22.10.2026)

Die Menüpunkte **Kampf & Fähigkeiten**, **Farmen & Welt**, **Merchant & Produktion** und **Team & Charaktere** sind keine statischen Platzhalter mehr. Sie beziehen ihre Felddefinitionen ausschließlich aus dem vorhandenen vollständigen Full-v1-Schema der Ingame-Runtime; die Worker-Route `GET /api/profile-schema` gibt dieses Schema nur unter erfolgreicher Cloudflare-Access-Prüfung aus. Änderungen an Schwellwerten, Listen und Objekten verwenden strikte Typ-/Grenzprüfung und editieren einen lokalen, flüchtigen Entwurf des vollständigen GitHub-Profils. Für ältere oder fehlende Profile wird **kein** neues Vollprofil stillschweigend generiert: der Erstimport erfolgt weiterhin in `/classic.html`.

Alle Tabs teilen denselben Entwurf. Der Knopf **Profil auf GitHub speichern** ruft ausschließlich `PUT /api/profile` mit dem letzten aus `GET /api/profile` bekannten SHA auf; der Worker prüft das vollständige ALBot-Schema samt Abhängigkeiten, und eine konkurrierende Änderung durch die klassische Werkstatt verursacht HTTP 409 statt blindem Überschreiben. Ein erneutes Laden verwirft einen ungespeicherten Entwurf nur nach Bestätigung. Die getrennten, bisherigen globalen Itemrichtlinien bleiben unter `PUT /api/policy` und können nicht versehentlich aus den Profileditoren heraus überschrieben werden.

**Weder Bearbeitung noch GitHub-Speicherung aktiviert die Konfiguration im Spiel.** Erst ein gesondert implementierter, überprüfter signierter Konfigurationskanal mit Runtime-ACK dürfte diesen Status ändern. Sensible Tokens werden vom Web-Editor weder abgefragt noch gespeichert. Die klassische Werkstatt bleibt für große Listen und zusätzliche Profilbereiche verfügbar. Kein neues kostenpflichtiges Cloudflare-Produkt, kein neues D1-Schema und keine Anpassung des Ingame-Bootstraps.


## Aktueller Stand (21.10.2026)

Die Cloudflare-Access-Ausnahme für den **exakten Pfad** `/api/ingest` wurde live aus Adventure Land geprüft: CORS-Anfragen erreichen den Worker, ungültige Tokens ergeben HTTP 401; ein gültiger Token wird akzeptiert. Automatische Charakter- und Bankuploads wurden mit der signierten Ingame-Runtime **0.31.0-candidate** bestätigt, zuletzt `bank-success`, `lastError:null`. Die inzwischen offiziell signierte Runtime **0.34.0-candidate (Sequenz 34)** ist im Release-Kanal vorhanden; ihre tatsächliche Ingame-Abnahme und insbesondere jede Ingame-Konfigurationsübernahme bleiben getrennt nachzuweisen. Alle übrigen Dashboard- und API-Pfade bleiben Access-geschützt.

Die neue Startseite zeigt ausschließlich **empfangene**, nach Datenalter eingeordnete Telemetrie. Ein Snapshot innerhalb der letzten fünf Minuten ist kein beweiskräftiger Online-Status; fehlende Bankfächer bedeuten nicht, dass sie leer sind oder dass der komplette Bankbestand bekannt ist. Bei D1-/API-Fehlern dürfen alte Caches keine scheinbar aktuellen Zähler erzeugen. Die automatische Übertragung benötigt das private Ingame-CODE-Token, **niemals eine Eingabe im Konfigurator**. Ein Relay-Fenster ist lediglich ein optionaler Ausweichweg.

**Konfigurationsänderungen:** Globale Itemrichtlinien und das Classic-Profil werden weiterhin nur versioniert in einem privaten GitHub-Repository gespeichert. Es gibt **noch keine** sichere signierte Veröffentlichung von Benutzerkonfigurationen in die laufende Spiel-Runtime. Keine Verkaufs-, Transfer- oder Spieleingriffsberechtigung aus D1-Telemetrie oder diesen neuen Ansichten ableiten.


## Sicherheit und Funktionsstand

- Die neue Oberfläche bietet Dashboard, Charakterstatus mit Inventar und schematischer Positionsdarstellung, Bankfächer und globale Itemrichtlinien.
- Globale Itemrichtlinien und das vollständige Profil werden als **zwei getrennte, SHA-versionierte Dateien im privaten GitHub-Konfigurationsrepository** gespeichert. Speichern ändert derzeit **nicht** die laufende `ALBotConfig`, verkauft keine Items und veröffentlicht keinen signierten Release.
- Der klassische vollständige Item-/Skill-/Charaktereditor wird unter `/classic.html` aus dem aktuellen Editor-Build kopiert. Über einen kleinen isolierten Cloud-Adapter kann er das vollständige Profil aus dem **privaten GitHub-Repo laden und zurückspeichern**; sein lokaler JSON-/CODE-Export bleibt unverändert. Bei vorhandenem lokalem Entwurf fragt er vor dem Ersetzen nach.
- Die Bank- und Charakteransichten lesen ausschließlich Cloudflare-D1-Telemetriesnapshots. Fehlende oder alte Bank-Maps zählen nicht als leere Bestände. Kein Snapshot autorisiert eine Bankaktion.
- Für alle Web-Seiten, statischen Assets und Konfigurations-APIs wird **eine kryptografisch überprüfte Cloudflare-Access-JWT** inklusive Signatur, Issuer, Audience, Ablauf und E-Mail-Whitelist benötigt. Für die klassische Werkstatt gelten exakte SHA-256-CSP-Hashes ihrer eingebetteten Script-/Style-Blöcke, kein generelles `unsafe-inline`.
- Der Telemetrie-Endpunkt `/api/ingest` ist davon getrennt und erfordert ein Worker-Secret `INGEST_TOKEN` (mindestens 32 zufällige Zeichen). Niemals in das öffentliche Runtime-Bundle schreiben.
- `GITHUB_TOKEN` ist ein Worker-Secret mit Schreibrechten **nur auf ein separates privates Konfigurationsrepository**, nicht auf `Riflex91/ALBot`. Der öffentliche Source- und Runtime-Branch bleibt davon getrennt.
- Der Worker ruft den jeweils aktuellen öffentlichen Item-Katalog und Build-Metadaten aus `Riflex91/ALBot/main` ab. Es gibt noch keinen Live-Config-Update-Mechanismus für Adventure Land/Headless; dieser benötigt einen gesonderten, signierten Bootstrap-/Versionsvertrag.
- Der produktive Worker wurde am 21.10.2026 nach Linux-/Windows-CI über den bestehenden Workflow deployed (siehe [Actions-Lauf 39644211739](https://github.com/Riflex91/ALBot/actions/runs/39644211739)). Dies belegt den Deployment-Aufruf, nicht die private Access-Ausnahme, die Secret-Provisionierung oder einen echten Ingame-Direktupload.

## Lokale und CI-Prüfung (ohne Cloudflare)

Im Repository:

```bash
npm ci --ignore-scripts
npm run build
npm run build:editor
npm run build:konfigurator
node --test konfigurator/test/*.test.mjs
```

Die Browseroberfläche steht unter `konfigurator/public/index.html`, der Worker unter `konfigurator/worker/index.mjs`.

## Cloudflare-Einrichtung – erst nach der Codeabnahme

1. Bei Cloudflare **Workers & Pages** einen Worker für `konfigurator/` erstellen. Wrangler installiert und konfiguriert denselben Code. Für alle Assets ist `run_worker_first=true` aktiviert.
2. Cloudflare **Zero Trust / Access** konfigurieren und die Worker-Domain nur für die eigene E-Mail erlauben. Die Access-Audience, den Team-Domain-Namen und die freigegebene E-Mail notieren.
3. Eine **private** GitHub-Repository `<Konto>/albot-private-config` erstellen, den leeren Branch `main` initialisieren und einen feingranularen GitHub-Token mit **Contents: Read & write** ausschließlich für diese Repo anlegen. Kein Token auf dem öffentlichen ALBot-Code.
4. Worker-Secrets setzen:
   - `GITHUB_TOKEN`: der eingeschränkte private GitHub-Token
   - `CONFIG_REPO`: `<Konto>/albot-private-config`
   - `CF_ACCESS_TEAM_DOMAIN`: `<Team>.cloudflareaccess.com`
   - `CF_ACCESS_AUD`: Access Application Audience Tag
   - `ALLOWED_EMAIL`: exakte erlaubte E-Mail
   - `INGEST_TOKEN`: mindestens 32 zufällige Zeichen, später nur in privater Clientkonfiguration verwendet
5. Für `/api/ingest` eine **eigene, exakte Access-Anwendungspfad-Ausnahme** konfigurieren (Bypass ausschließlich für diesen einzelnen Endpunkt); im Worker bleiben ein langer privater Bearer-Token und eine fest definierte CORS-Allowlist für **beide** offiziellen Origins `https://adventure.land` und `https://www.adventure.land` verpflichtend. Keine allgemeine Domain-Bypass-Policy setzen. Browser-Preflight `OPTIONS` auf diesem Pfad darf nicht von Access abgefangen werden. Dashboard, HTML und alle anderen `/api/*` müssen Access-authentifiziert bleiben.
6. Cloudflare D1-Datenbank `albot-konfigurator` anlegen, die **echte** `database_id` in `wrangler.toml` eintragen und `schema.sql` einmalig migrieren.
7. `cd konfigurator && npx wrangler deploy` erst danach ausführen. Browser-Login und Access-Prüfung im Live-Worker überprüfen, bevor echte Itemrichtlinien gespeichert werden.

**Wichtig:** `Cloudflare Access` muss vor der Worker-Domain aktiviert sein; bei fehlenden Access-Secrets gibt die Anwendung HTTP 503 statt einer ungeschützten Website zurück. Ohne Datenbank sind die Liveansichten leer, nicht erfunden. Der persönliche Ingame-Bootstrap bleibt bis zu einer gesonderten validierten Konfigurationssignatur unverändert.

## Reproduzierbares Auto-Deployment nach `main` (Cloudflare Free)

Die GitHub-Action [`deploy-konfigurator.yml`](../.github/workflows/deploy-konfigurator.yml) deployt bei Aenderungen unter `konfigurator/**`, `editor/**` oder am eigenen Workflow nach einem Merge auf `main` automatisch den **bereits existierenden Worker** `albot-konfigurator`. Alternativ kann sie per **Actions -> Deploy ALBot Konfigurator (Cloudflare Free) -> Run workflow** auf `main` gestartet werden. Es werden weder neue Datenbanken noch Access-Anwendungen erzeugt oder Cloudflare-Tarife geaendert.

**Einmalige Einrichtung (ausschliesslich in GitHub -> Settings -> Secrets and variables -> Actions -> Repository secrets):**

1. `CLOUDFLARE_ACCOUNT_ID`: Account-ID des bereits verwendeten kostenlosen Cloudflare-Accounts.
2. `CLOUDFLARE_API_TOKEN`: eng auf diesen Account beschraenkter Cloudflare-Token mit Berechtigung **Workers Scripts: Edit**, um den vorhandenen Worker zu deployen. Der Token darf nicht im ALBot-Code, in `wrangler.toml`, im Dashboard-Frontend oder in einer Chat-Nachricht gespeichert werden.

Ohne **beide** Secrets wird das Deployment vor dem ersten Build uebersprungen und es erscheint ein GitHub-Actions-Hinweis. Ein existierender Cloudflare-Login und dort hinterlegte Worker-Secrets werden **nicht automatisch** in GitHub uebernommen. Nach erfolgreichem Credential-Check muessen erst die Linux- und Windows-Laufzeiten sowie der komplette Node-Testumfang erfolgreich sein. Danach erstellt die Action die geschuetzten klassischen Editor-Assets neu und fuehrt `wrangler deploy` aus; `keep_vars=true` erhaelt die in Cloudflare gesetzten Worker-Secrets und Account-spezifischen Einstellungen.

Eine gruene PR-CI **alleine ist kein Cloudflare-Deployment**. Nur ein erfolgreich beendeter `deploy`-Job in diesem gesonderten Workflow bestaetigt den Deployment-Aufruf. Die Access-geschuetzten API-Daten und neue Bankpakete muessen anschliessend weiterhin im echten Browser geprueft werden. Keine `wrangler d1 execute`-Migration, kein automatisches Loeschen historischer Bankdaten, kein kostenpflichtiges Cloudflare-Produkt.

## Voraussetzungen für echte Konfigurationsübernahme

Für Hot-Reload muss künftig eine serverseitig signierte versionierte Konfiguration in einen allein lesbaren, bereinigten Clientkanal veröffentlicht werden. Der bestehende Ingame-Loader besitzt aktuell nur den verifizierten Runtime-Download mit persönlicher `ALBotConfig`. Weder GitHub-Commit noch Worker-Speichern alleine aktualisiert laufende Bots. Signaturvalidierung, Rollbackschutz, kompatible Schema-Migration, sichere Entscheidungspunkte und Charakter-ACK müssen vor Aktivierung implementiert und im Browser sowie Headless überprüft werden.

## Verbindliche Betriebsregel: Cloudflare Free, keine Kosten

- **Nur Workers Free, D1 Free und Zero Trust Access Free.** Kein bezahlter Tarif, keine nutzungsabhängigen Paid-Dienste und keine automatische Tarifumstellung für ALBot.
- Workers Free: **100.000 Requests/Tag** (Account-Gesamtnutzung, UTC-Reset). Bei Überschreitung beendet Cloudflare die Worker-Verarbeitung; **kein Paid-Upgrade durchführen**. Für sicherheitskritische Routen fail-closed statt fail-open vorsehen.
- D1 Free: **5.000.000 gelesene Zeilen/Tag**, **100.000 geschriebene Zeilen/Tag**, **5 GB gesamt**, **500 MB pro Datenbank**. Seit September 2026 lehnt D1 Free Zugriffe nach Überschreitung des Tageslimits bis Mitternacht UTC ab. Nie zum Fortsetzen automatisch upgraden.
- Zero Trust Free nur innerhalb der kostenlosen Nutzergrenze verwenden. Die konkrete Tarifwahl und weitere Cloudflare-Produkte sind in der Kontoverwaltung zu prüfen.
- **Dashboard**: höchstens ein Live-Abruf alle 60 Sekunden pro sichtbarer Instanz; nur zwei D1-Leseendpunkte; verborgene Tabs und überlappende Abrufe lösen keine neuen Anfragen aus.
- **Geplanter privater Telemetrie-Client**: frühestens alle 120 Sekunden je Charakter, maximal ein Bankpack je Zyklus. Keine Abfrage bei jedem Game-Tick, keine dauerhaften geheimen Schlüssel im öffentlichen Browser-Code, keine automatischen Uploads ohne gesonderte private Einrichtung.
- **Kapazitätsrechnung**: 12 Charaktere × 720 Meldungen/Tag = 8.640 Uploads, ein Bankpack/Zyklus 720 Uploads, ein dauerhaft geöffnetes Dashboard 2.880 Leseaufrufe/Tag, insgesamt etwa **12.240 Worker-Requests/Tag**. Das ist nur ein konservatives Szenario, kein accountweites Hard-Limit (andere Apps, Nutzer, automatisierte Zugriffe und statische Assets zählen ebenfalls).
- Zielbudget für den ALBot-Konfigurator: **unter 20.000 Worker-Requests/Tag**. Das ist eine Betriebsregel, **kein programmatisch durchgesetztes globales Kontingent**. Cloudflare-Dashboard **Workers Analytics** und **D1 Metrics** regelmäßig kontrollieren. Wenn Quoten erschöpft sind: Updates pausieren, nicht bezahlen.
- Auf einem echten Free-Konto entstehen bei Erreichen der dokumentierten Workers-/D1-Free-Limits keine automatischen Mehrkosten. **Die tatsächliche Nullkosten-Garantie erfordert, dass das Cloudflare-Konto im Free-Tarif bleibt und keine separaten kostenpflichtigen Produkte aktiviert.** Den Account-Tarif kann dieses Repository weder lesen noch erzwingen.

Offizielle Cloudflare-Dokumentation:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

## Profilimport und private Speicherung

Nach der Cloudflare-Einrichtung die Seite `/classic.html` öffnen. Falls im privaten Repo noch kein `albot/profile.json` existiert, das aktuelle eigene Profil **einmalig** über „Profil öffnen“ (JSON) oder einen bereits vorhandenen lokalen Entwurf übernehmen. Erst danach „☁ Profil auf GitHub speichern“ wählen. Bei folgenden Aufrufen lädt der Adapter automatisch das private GitHub-Profil, ohne einen lokalen Entwurf ungefragt zu überschreiben. Die globale Item-Richtlinie bleibt unter `albot/item-policies.json` und ist nicht mit den bisher aktiven `config.items` identisch.

**Absichtlich noch keine automatische Signierung/Distribution:** Ein erfolgreicher GitHub-Commit bestätigt nur Speicherung. Die Ingame-Runtime verwendet weiterhin die im vorhandenen Bootstrap bereitgestellte persönliche `ALBotConfig`. Die neue Plattform darf niemals behaupten, dass ein Cloud-Profil ohne einen implementierten signierten Konfigurationskanal übernommen wurde.

## Browser-Telemetrie und Cloudflare Access

Ein Ingame-Browser sendet bei `POST /api/ingest` mit `Authorization` einen CORS-Preflight (`OPTIONS`). Deshalb darf nur dieser **exakte Pfad** außerhalb der Login-Weiterleitung liegen. Der `POST` besitzt unabhängig vom Browser-Origin eine verpflichtende Bearer-Token-Prüfung. Der Worker antwortet auf CORS-Preflight nur für die **beiden exakt definierten offiziellen Spiel-Origins** `https://adventure.land` und `https://www.adventure.land`; alle anderen Origins erhalten 403. Eine konfigurierte `INGEST_ALLOWED_ORIGIN`-Umgebungsvariable wird nicht mehr verwendet. Kein generischer Origin-Reflector, keine fremden Websites und keine Geheimhaltungsgarantie für private Token im Game-CODE-Frame.

## Read-only Telemetrie-Snapshot (Stufe 1)

Das neue Modul `src/runtime/telemetry-snapshot.mjs` stellt validierte Read-only-Snapshot-Bausteine bereit. **Es ist noch nicht in die signierte Ingame-Runtime eingebunden**, weil der bestehende Bootstrap-Vertrag ausschließlich signierte, gemeinsam freigegebene Runtime-Artefakte erlaubt. Die Methode `ALBot.telemetrySnapshot()` ist daher noch nicht aktiv. Die Modulfunktionen erzeugen stattdessen defensive Kopien von aktuellen Charakterdaten und ausschließlich lokal beobachteten, vollständigen Bankpacks. Sie **sendet keine Requests**, enthält **keinen Token** und verändert weder Inventar noch Bank noch Item-Entscheidungen. Bank-Pakete sind keine Vollständigkeitsbeweise für den Account. Noch nicht nachgewiesene EXP-/Gold-Raten tragen `ratesMeasured:false`; das Dashboard zeigt dafür ein Strichsymbol statt einer erfundenen Zahl.

Diese Daten werden später von einem separaten **privaten** Transport/Relay an `/api/ingest` übertragen, frühestens alle 120 Sekunden je Charakter und maximal ein Bankpack je Intervall. Zugangsschlüssel dürfen nicht im veröffentlichten GitHub-Runtime-Code liegen. Bis eine sichere private Übertragung eingerichtet und getestet ist, entstehen durch diese neue Funktion **null zusätzliche Cloudflare-Requests**.

## Harte D1-Limits fuer kostenlosen Betrieb

Der Worker speichert pro Charakter hoechstens alle 120 Sekunden einen Snapshot. Fuer Bankpacks gilt dieselbe Drosselung global, unabhaengig vom Pack. Es duerfen maximal 12 Charaktere und 24 Bankpacks vorhanden sein. Weitere oder zu schnelle Schreibversuche werden mit HTTP 429 (Retry-After: 120) abgewiesen. Bei gesperrten Uploads darf der private Client keine schnellen Wiederholungen ausloesen.

Dashboard-API-Antworten schliessen Snapshots aus, die aelter als sieben Tage sind. Alte Daten verbleiben maximal innerhalb der festen Tabellenobergrenzen. Fuer die neue Logik ist keine D1-Migration und kein kostenpflichtiger Cloudflare-Dienst erforderlich.

Diese Drossel begrenzt D1-Schreiboperationen, nicht die Anzahl eingehender Worker-Requests oder fremde Cloudflare-Account-Nutzung. Workers Free muss weiterhin aktiv bleiben; echte Accountkosten und alle weiteren Produkte sind im Billing-Dashboard zu kontrollieren.

## Access-geschuetztes Browser-Relay (Opt-in)

Die separate Seite `/relay.html` ist durch dieselbe Cloudflare-Access-Anmeldung wie das Dashboard geschuetzt. Sie akzeptiert nach einem ausdruecklichen Klick nur `postMessage`-Pakete vom tatsaechlich oeffnenden Adventure-Land-Fenster und nur mit `origin=https://adventure.land` oder `https://www.adventure.land`. Sie uebertraegt diese an den gleichurspruenglichen Endpunkt `POST /api/relay-ingest`.

Bei Adventure Land wird der CODE in einem eigenen Frame innerhalb des Spielfensters ausgefuehrt. Beim Oeffnen des Relay-Popups ist `window.opener` das uebergeordnete Spielfenster, waehrend der sendende `event.source` der CODE-Frame sein kann. Deshalb akzeptiert der Receiver nur den Opener **oder dessen nachweisbare, begrenzt enumerierte Unterframes**, weiterhin ausschliesslich mit exaktem Adventure-Land-Origin. Andere Tabs/Fenster sowie beliebige Origins bleiben blockiert. Verwirft er trotzdem eine offizielle Spielnachricht, zeigt die Relay-Oberflaeche die Ablehnung statt dauerhaft nur 0 anzuzeigen. Kein neuer Worker-Request.

Der Endpunkt verlangt immer eine kryptografisch gepruefte Access-JWT, `Origin` gleich der Worker-Domain und `Content-Type: application/json`. Anschliessend gelten dieselben D1-Schreibgrenzen wie bei `/api/ingest`. Keine Cross-Origin-Freigabe und keine Access-Bypass-Regel fuer `/api/relay-ingest` anlegen. Der alte Bearer-Endpunkt bleibt davon unabhaengig weiterhin tokenpflichtig.

Das Relay zeigt eine lokale 120-Sekunden-Versuchsdrossel und besitzt keine Retry-Schleife oder Hintergrundabfragen. Es benoetigt keinen geheimen API-Schluessel im Spielcode, keine neue Datenbank und keinen kostenpflichtigen Cloudflare-Dienst. Ohne bewusst gestartetes Spielfenster und Benutzeraktivierung uebertraegt es nichts. Ein separat freigegebener Game-Sender sowie ein echter Browser-Livetest stehen noch aus; die signierte Ingame-Runtime wird durch diese Aenderung nicht veraendert.


## Geplanter Opt-in in der signierten Runtime 0.18.0-candidate

Die neue Runtime-Quelle bindet Snapshot und Sender jetzt in `src/main.mjs` und `scripts/build.mjs` ein. Die Freigabe erfolgt nur ueber den bestehenden signierten Bootstrap-Kanal. Ein GitHub-Merge allein aktualisiert keine laufenden Game-Sessions.

Im offiziellen Adventure-Land-Browser mit aktivierter UI erscheint danach der Button **Telemetrie verbinden**. Erst dessen direkter Klick darf das Relay-Popup oeffnen. Im geschuetzten Popup muss der Nutzer anschliessend **Empfang ausdruecklich aktivieren** bestaetigen. Erst nach dessen ursprungsgeprueftem Ready-Handshake sendet der Bot einen ersten Snapshot. Danach maximal ein Charakter- und bei Merchant-Betrieb ein lokal beobachteter Bankpack-Snapshot alle 120 Sekunden.

Keine Verbindung bei Start, keine automatischen Popups, keine versteckten Credentials, keine Remote-Config-Uebernahme und kein Relay im Headless-Modus. Ein Popup oder Origin-Fehler deaktiviert Telemetrie, nicht den Spielbot. Entladen der Runtime schliesst nur Listener/Timer der eigenen Verbindung, nicht das Browser-Popup des Nutzers. Ein Web-Relay ohne laufenden Sender schreibt nichts nach D1.

**Abnahmegrenze:** Das Erzeugen und Pruefen des v0.18-Quellpakets ist noch keine signierte Veroeffentlichung. Erst die unabhaengige Release-Signatur mit neuer Sequenz, kryptografischer Kanalpruefung und ein echter Browser-Livetest belegen eine spielseitig nutzbare Funktion. Niemals Unsigned-Code oder einen unbekannten CDN-Stand im vorhandenen CODE-Slot ausfuehren.

## Spiel-Sender (Staging, noch nicht im signierten Release)

Das quelloffene, rein lesende Modul `src/runtime/telemetry-relay-sender.mjs` bietet `createGameRelaySender`. Es sammelt mithilfe des bereits vorbereiteten Snapshot-Moduls ausschließlich aktuell sichtbare Charakter- und Bankdaten. Der Sendekanal ist `window.postMessage` an die fest definierte HTTPS-Adresse `/relay.html`, niemals ein direkter HTTP-Aufruf aus Adventure Land.

Sicherheitsvertrag: Der Benutzer muss das Relay-Popup aus einer direkten Benutzeraktion oeffnen und dort den Empfang anklicken. Der Sender akzeptiert den Ready-Handshake nur vom exakt geoeffneten Popup und der festen Cloudflare-Domain. Ohne beides wird kein Snapshot gesendet. Wiederholte Aufrufe sind lokal auf mindestens 120 Sekunden begrenzt; der Merchant sendet hoechstens ein beobachtetes Bankpack je Intervall. Es wird kein Token gespeichert, keine Spielaktion ausgefuehrt und kein Retry-Timer gestartet.

**Noch nicht aktiv im Spiel:** Der neue Sender ist weder in `src/main.mjs` installiert noch in `scripts/build.mjs` enthalten. Ein spaeterer signierter Release mit echten Adventure-Land-Browsertests ist weiterhin erforderlich. Ein automatischer Betrieb darf erst danach behauptet werden. Cloudflare Free und die vorhandene D1-Datenbank genuegen.

## Automatische Telemetrie ohne Relay-Popup

Nach der Freigabe des neuen **signierten** Laufzeit-Bundles sendet ALBot beim Start und danach fruehestens alle 120 Sekunden selbststaendig ueber den **bestehenden tokenpflichtigen** `/api/ingest`-Endpunkt. Der Merchant sendet maximal ein beobachtetes Bankfach pro Durchlauf; kein Popup und kein Bestaetigungsklick erforderlich. Ohne privaten Telemetrie-Schluessel wird **keine** direkte Netzwerkanfrage ausgefuehrt; das Access-Relay bleibt als Fallback erhalten.

**Einmalige private CODE-Slot-Einrichtung** (Schluessel niemals ins oeffentliche Repository, GitHub-Secrets oder den Chat kopieren): `globalThis.ALBOT_AUTO_TELEMETRY_TOKEN = '<privater-INGEST_TOKEN>';` vor dem signierten Bootstrap in deinem persoenlichen CODE-Slot setzen. Nur den separaten Cloudflare-Worker-Secret-Wert `INGEST_TOKEN` verwenden, niemals `CLOUDFLARE_API_TOKEN` oder `GITHUB_TOKEN`. Ein vorhandener Cloudflare-Secret-Wert kann nicht angezeigt werden; sichere Neuausgabe muss synchron im Worker und im privaten CODE erfolgen. Browser-Skripte derselben Game-Origin koennen auf den CODE-Wert zugreifen; vertrauenswuerdige, private Codeausfuehrung ist Voraussetzung. Die Worker-Konfiguration muss den exakt geschuetzten `/api/ingest` als einzige Telemetrie-Ausnahme von Access erlauben, Bearer-Validierung und CORS auf die offizielle Adventure-Land-Origin bleiben erhalten.

`ALBot.telemetryStatus()` meldet `mode:'automatic'`, `configured`, Status/Versuchszeiten, aber keine geheimen Werte. Bis ein freigegebener signierter Release und echte Browser-Tests vorliegen, bleibt diese Funktion ein noch nicht live gepruefter Runtime-Kandidat.

### Privaten Telemetrie-Schlüssel einmalig einrichten oder rotieren

1. Im eigenen Cloudflare-Account am **vorhandenen** Worker `albot-konfigurator` einen kryptografisch zufälligen separaten `INGEST_TOKEN` mit mindestens 32 Zeichen als **Secret** hinterlegen (Workers & Pages → `albot-konfigurator` → Settings → Variables and Secrets). Falls der alte Wert unbekannt ist, **neu erzeugen und überschreiben**; der alte Wert muss und darf nicht ausgelesen werden. **Nicht** den Repository-Secret-Wert `CLOUDFLARE_API_TOKEN` wiederverwenden.
2. Genau **denselben** privaten `INGEST_TOKEN` einmal im *persönlichen gespeicherten Adventure-Land-CODE-Slot* als `globalThis.ALBOT_AUTO_TELEMETRY_TOKEN = '<GEHEIMER_WERT>';` **vor** dem signierten Bootstrap eintragen und diesen Slot speichern. Die Variable muss im ausführenden CODE-Frame gesetzt sein, nicht nur in der übergeordneten Browserkonsole; pro benutztem privatem CODE-Slot einmal hinterlegen. Sie gehört weder in das öffentliche GitHub-Repository, noch in `ALBotConfig`-Exporte, Logs oder einen Chat.
3. Bei Cloudflare Access ausschließlich den **exakten** Pfad `/api/ingest` für `OPTIONS` und `POST` so ausnehmen, dass der Preflight ohne Access-Login beantwortet wird. `/api/relay-ingest`, `/api/bank`, `/api/characters`, die Weboberfläche und alle Konfigurations-APIs bleiben vollständig Access-geschützt. Der Worker verlangt für den direkten `POST` weiterhin den Bearer-Token.
4. Spiel mit gespeichertem CODE starten; im Spiel-CODE-Frame `ALBot.telemetryStatus()` lesen. `configured:true` belegt nur das gültige Tokenformat; `lastCharacterSuccess` bzw. `lastBankSuccess` belegen einen vom Worker bestätigten Upload. In der durch Access geschützten Weboberfläche anschließend den aktuellen Charakter und – beim Merchant in der Bank – mindestens ein beobachtetes Bankfach prüfen.

**Sicherheitsgrenze:** Der Adventure-Land-CODE-Frame ist keine vertrauenswürdige Secret-Enklave. Andere dort ausgeführte Skripte, Browser-Erweiterungen oder kompromittierter Game-Code können den Schlüssel auslesen. Ein geleakter `INGEST_TOKEN` ermöglicht gefälschte Telemetrie-Schreibversuche innerhalb der D1-Limits. Bei Verdacht den Worker-Secret-Wert rotieren, den privaten CODE-Slot aktualisieren und neu starten. Weder Cloudflare Access noch CORS schützen gegen einen Angreifer, der den gültigen Bearer-Token bereits besitzt. Eine abschließende Ingame-Liveabnahme ist gesondert erforderlich.


## Globale Bankansicht ueber mehrere Spiel-Realms

`/api/bank` zeigt pro Bankfach (`items0`, `items1` usw.) **nur den juengsten separat beobachteten Snapshot**. Wenn sich der Merchant zwischen Realms bewegt, bleiben aeltere Snapshots mit ihrem Realm unveraendert in D1 gespeichert, zaehlen aber nicht als weitere globale Bankfaecher und werden weder mit neueren Slots zusammengefuehrt noch als aktuell ausgegeben. Die Bank-Map und der beobachtende Realm bleiben sichtbar. Nicht beobachtete Packs werden niemals als leer erzeugt. Die bestehenden globalen 120-Sekunden-Schreiblimits, 7-Tage-Lesefrist und Free-Tier-Budgets aendern sich dadurch nicht.

**Bank ist accountweit:** Alle Abenteuerland-Realms greifen auf dieselben Bankpacks zu. Daher schreiben neue Telemetrie-Snapshots je `itemsN` unter demselben kanonischen D1-Schluessel `itemsN`, egal ob die Beobachtung auf `EUII`, `USIV` oder einem anderen Realm erfolgte. `realm` und `observedAt` dokumentieren ausschliesslich den letzten Beobachtungsursprung/-zeitpunkt. Bestehende `realm:itemsN`-Zeilen bleiben fuer eine verlustfreie Umstellung gespeichert und werden in der Leseansicht weiterhin nach juengstem `observedAt` pro Pack dedupliziert. Die Altzeilen belegen bis zu einer gesonderten, expliziten Migration weiterhin D1-Zeilenkapazitaet; es gibt in diesem Patch keine Datenloeschung. Die Cloudflare-Access-Instanz ist fuer einen privaten Account eingerichtet, nicht fuer mehrere unabhaengige Spieler-Accounts.

## Historische Integration PR #359 (22.10.2026)

Der private automatische Game-CODE-Telemetriesender aus [PR #359](https://github.com/Riflex91/ALBot/pull/359) ist im aktuellen `main` bereits in einer nachfolgend gehärteten Fassung integriert: `src/runtime/telemetry-auto-sender.mjs` wird im gemeinsamen Build und `src/main.mjs` verwendet. Die aktuelle Variante bietet zusätzlich begrenzte HTTP-Timeouts, konservatives Bankpack-Capture, Warteschlange und Fehlerdiagnose ohne Token-Ausgabe; diese Schutzmechanismen bleiben erhalten. Beim historischen PR-Abgleich dürfen weder dessen ältere Quellstände noch die damals erzeugten 0.24-Runtime-Artefakte über den neueren signierten Bootstrap-/Konfigurationsvertrag kopiert werden. Dies ist nur die konfliktfreie Git-Historienintegration und keine neue Signierung, Veröffentlichung oder W14-Livebestätigung.

## Historische Integration PR #361 (22.10.2026)

[PR #361](https://github.com/Riflex91/ALBot/pull/361) war ein früher `0.24.0-candidate`-Einbau desselben privaten Auto-Telemetriesenders wie #359. Der mittlerweile aktuelle `main` enthält diese Funktion bereits mit neueren Tests, begrenzter Bankpack-Warteschlange, Fetch-Abbruch und Ausfallschutz. Der abschließende PR-Abgleich übernimmt dessen Commit-Geschichte **ohne** die veralteten `bot.js`-, `dist/`-, Editor- oder Manifest-Artefakte aus 0.24 zurückzukopieren. Der bestehende signierte Release-Kanal und alle privaten CODE-Schlüssel bleiben unverändert. Es entsteht dadurch keine neue signierte Runtime oder Ingame-Livebestätigung.
