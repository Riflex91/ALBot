# ALBot Konfigurator – Cloudflare-bereite Vorstufe

## Sicherheit und Funktionsstand

- Die neue Oberfläche bietet Dashboard, Charakterstatus mit Inventar und schematischer Positionsdarstellung, Bankfächer und globale Itemrichtlinien.
- Globale Itemrichtlinien und das vollständige Profil werden als **zwei getrennte, SHA-versionierte Dateien im privaten GitHub-Konfigurationsrepository** gespeichert. Speichern ändert derzeit **nicht** die laufende \`ALBotConfig\`, verkauft keine Items und veröffentlicht keinen signierten Release.
- Der klassische vollständige Item-/Skill-/Charaktereditor wird unter \`/classic.html\` aus dem aktuellen Editor-Build kopiert. Über einen kleinen isolierten Cloud-Adapter kann er das vollständige Profil aus dem **privaten GitHub-Repo laden und zurückspeichern**; sein lokaler JSON-/CODE-Export bleibt unverändert. Bei vorhandenem lokalem Entwurf fragt er vor dem Ersetzen nach.
- Die Bank- und Charakteransichten lesen ausschließlich Cloudflare-D1-Telemetriesnapshots. Fehlende oder alte Bank-Maps zählen nicht als leere Bestände. Kein Snapshot autorisiert eine Bankaktion.
- Für alle Web-Seiten, statischen Assets und Konfigurations-APIs wird **eine kryptografisch überprüfte Cloudflare-Access-JWT** inklusive Signatur, Issuer, Audience, Ablauf und E-Mail-Whitelist benötigt. Für die klassische Werkstatt gelten exakte SHA-256-CSP-Hashes ihrer eingebetteten Script-/Style-Blöcke, kein generelles `unsafe-inline`.
- Der Telemetrie-Endpunkt \`/api/ingest\` ist davon getrennt und erfordert ein Worker-Secret \`INGEST_TOKEN\` (mindestens 32 zufällige Zeichen). Niemals in das öffentliche Runtime-Bundle schreiben.
- \`GITHUB_TOKEN\` ist ein Worker-Secret mit Schreibrechten **nur auf ein separates privates Konfigurationsrepository**, nicht auf \`Riflex91/ALBot\`. Der öffentliche Source- und Runtime-Branch bleibt davon getrennt.
- Der Worker ruft den jeweils aktuellen öffentlichen Item-Katalog und Build-Metadaten aus \`Riflex91/ALBot/main\` ab. Es gibt noch keinen Live-Config-Update-Mechanismus für Adventure Land/Headless; dieser benötigt einen gesonderten, signierten Bootstrap-/Versionsvertrag.
- Der produktive Worker wurde am 21.10.2026 nach Linux-/Windows-CI über den bestehenden Workflow deployed (siehe [Actions-Lauf 39644211739](https://github.com/Riflex91/ALBot/actions/runs/39644211739)). Dies belegt den Deployment-Aufruf, nicht die private Access-Ausnahme, die Secret-Provisionierung oder einen echten Ingame-Direktupload.

## Lokale und CI-Prüfung (ohne Cloudflare)

Im Repository:

\`\`\`bash
npm ci --ignore-scripts
npm run build
npm run build:editor
npm run build:konfigurator
node --test konfigurator/test/*.test.mjs
\`\`\`

Die Browseroberfläche steht unter \`konfigurator/public/index.html\`, der Worker unter \`konfigurator/worker/index.mjs\`.

## Cloudflare-Einrichtung – erst nach der Codeabnahme

1. Bei Cloudflare **Workers & Pages** einen Worker für \`konfigurator/\` erstellen. Wrangler installiert und konfiguriert denselben Code. Für alle Assets ist \`run_worker_first=true\` aktiviert.
2. Cloudflare **Zero Trust / Access** konfigurieren und die Worker-Domain nur für die eigene E-Mail erlauben. Die Access-Audience, den Team-Domain-Namen und die freigegebene E-Mail notieren.
3. Eine **private** GitHub-Repository \`<Konto>/albot-private-config\` erstellen, den leeren Branch \`main\` initialisieren und einen feingranularen GitHub-Token mit **Contents: Read & write** ausschließlich für diese Repo anlegen. Kein Token auf dem öffentlichen ALBot-Code.
4. Worker-Secrets setzen:
   - \`GITHUB_TOKEN\`: der eingeschränkte private GitHub-Token
   - \`CONFIG_REPO\`: \`<Konto>/albot-private-config\`
   - \`CF_ACCESS_TEAM_DOMAIN\`: \`<Team>.cloudflareaccess.com\`
   - \`CF_ACCESS_AUD\`: Access Application Audience Tag
   - \`ALLOWED_EMAIL\`: exakte erlaubte E-Mail
   - \`INGEST_TOKEN\`: mindestens 32 zufällige Zeichen, später nur in privater Clientkonfiguration verwendet
5. Für \`/api/ingest\` eine **eigene, exakte Access-Anwendungspfad-Ausnahme** konfigurieren (Bypass ausschließlich für diesen einzelnen Endpunkt); im Worker bleiben ein langer privater Bearer-Token und eine fest definierte CORS-Allowlist für **beide** offiziellen Origins \`https://adventure.land\` und \`https://www.adventure.land\` verpflichtend. Keine allgemeine Domain-Bypass-Policy setzen. Browser-Preflight \`OPTIONS\` auf diesem Pfad darf nicht von Access abgefangen werden. Dashboard, HTML und alle anderen \`/api/*\` müssen Access-authentifiziert bleiben.
6. Cloudflare D1-Datenbank \`albot-konfigurator\` anlegen, die **echte** \`database_id\` in \`wrangler.toml\` eintragen und \`schema.sql\` einmalig migrieren.
7. \`cd konfigurator && npx wrangler deploy\` erst danach ausführen. Browser-Login und Access-Prüfung im Live-Worker überprüfen, bevor echte Itemrichtlinien gespeichert werden.

**Wichtig:** \`Cloudflare Access\` muss vor der Worker-Domain aktiviert sein; bei fehlenden Access-Secrets gibt die Anwendung HTTP 503 statt einer ungeschützten Website zurück. Ohne Datenbank sind die Liveansichten leer, nicht erfunden. Der persönliche Ingame-Bootstrap bleibt bis zu einer gesonderten validierten Konfigurationssignatur unverändert.

## Reproduzierbares Auto-Deployment nach `main` (Cloudflare Free)

Die GitHub-Action [`deploy-konfigurator.yml`](../.github/workflows/deploy-konfigurator.yml) deployt bei Aenderungen unter `konfigurator/**`, `editor/**` oder am eigenen Workflow nach einem Merge auf `main` automatisch den **bereits existierenden Worker** `albot-konfigurator`. Alternativ kann sie per **Actions -> Deploy ALBot Konfigurator (Cloudflare Free) -> Run workflow** auf `main` gestartet werden. Es werden weder neue Datenbanken noch Access-Anwendungen erzeugt oder Cloudflare-Tarife geaendert.

**Einmalige Einrichtung (ausschliesslich in GitHub -> Settings -> Secrets and variables -> Actions -> Repository secrets):**

1. `CLOUDFLARE_ACCOUNT_ID`: Account-ID des bereits verwendeten kostenlosen Cloudflare-Accounts.
2. `CLOUDFLARE_API_TOKEN`: eng auf diesen Account beschraenkter Cloudflare-Token mit Berechtigung **Workers Scripts: Edit**, um den vorhandenen Worker zu deployen. Der Token darf nicht im ALBot-Code, in `wrangler.toml`, im Dashboard-Frontend oder in einer Chat-Nachricht gespeichert werden.

Ohne **beide** Secrets wird das Deployment vor dem ersten Build uebersprungen und es erscheint ein GitHub-Actions-Hinweis. Ein existierender Cloudflare-Login und dort hinterlegte Worker-Secrets werden **nicht automatisch** in GitHub uebernommen. Nach erfolgreichem Credential-Check muessen erst die Linux- und Windows-Laufzeiten sowie der komplette Node-Testumfang erfolgreich sein. Danach erstellt die Action die geschuetzten klassischen Editor-Assets neu und fuehrt `wrangler deploy` aus; `keep_vars=true` erhaelt die in Cloudflare gesetzten Worker-Secrets und Account-spezifischen Einstellungen.

Eine gruene PR-CI **alleine ist kein Cloudflare-Deployment**. Nur ein erfolgreich beendeter `deploy`-Job in diesem gesonderten Workflow bestaetigt den Deployment-Aufruf. Die Access-geschuetzten API-Daten und neue Bankpakete muessen anschliessend weiterhin im echten Browser geprueft werden. Keine `wrangler d1 execute`-Migration, kein automatisches Loeschen historischer Bankdaten, kein kostenpflichtiges Cloudflare-Produkt.

## Voraussetzungen für echte Konfigurationsübernahme

Für Hot-Reload muss künftig eine serverseitig signierte versionierte Konfiguration in einen allein lesbaren, bereinigten Clientkanal veröffentlicht werden. Der bestehende Ingame-Loader besitzt aktuell nur den verifizierten Runtime-Download mit persönlicher \`ALBotConfig\`. Weder GitHub-Commit noch Worker-Speichern alleine aktualisiert laufende Bots. Signaturvalidierung, Rollbackschutz, kompatible Schema-Migration, sichere Entscheidungspunkte und Charakter-ACK müssen vor Aktivierung implementiert und im Browser sowie Headless überprüft werden.

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

Nach der Cloudflare-Einrichtung die Seite \`/classic.html\` öffnen. Falls im privaten Repo noch kein \`albot/profile.json\` existiert, das aktuelle eigene Profil **einmalig** über „Profil öffnen“ (JSON) oder einen bereits vorhandenen lokalen Entwurf übernehmen. Erst danach „☁ Profil auf GitHub speichern“ wählen. Bei folgenden Aufrufen lädt der Adapter automatisch das private GitHub-Profil, ohne einen lokalen Entwurf ungefragt zu überschreiben. Die globale Item-Richtlinie bleibt unter \`albot/item-policies.json\` und ist nicht mit den bisher aktiven \`config.items\` identisch.

**Absichtlich noch keine automatische Signierung/Distribution:** Ein erfolgreicher GitHub-Commit bestätigt nur Speicherung. Die Ingame-Runtime verwendet weiterhin die im vorhandenen Bootstrap bereitgestellte persönliche \`ALBotConfig\`. Die neue Plattform darf niemals behaupten, dass ein Cloud-Profil ohne einen implementierten signierten Konfigurationskanal übernommen wurde.

## Browser-Telemetrie und Cloudflare Access

Ein Ingame-Browser sendet bei \`POST /api/ingest\` mit \`Authorization\` einen CORS-Preflight (\`OPTIONS\`). Deshalb darf nur dieser **exakte Pfad** außerhalb der Login-Weiterleitung liegen. Der \`POST\` besitzt unabhängig vom Browser-Origin eine verpflichtende Bearer-Token-Prüfung. Der Worker antwortet auf CORS-Preflight nur für die **beiden exakt definierten offiziellen Spiel-Origins** \`https://adventure.land\` und \`https://www.adventure.land\`; alle anderen Origins erhalten 403. Eine konfigurierte \`INGEST_ALLOWED_ORIGIN\`-Umgebungsvariable wird nicht mehr verwendet. Kein generischer Origin-Reflector, keine fremden Websites und keine Geheimhaltungsgarantie für private Token im Game-CODE-Frame.

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
