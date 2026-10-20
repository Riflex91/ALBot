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
- Der Worker selbst wird vor Inbetriebnahme noch nicht bereitgestellt, weil Cloudflare-Benutzerkonto, D1-ID, Access-Audience und Secret-Werte fehlen.

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
5. Für \`/api/ingest\` eine **eigene, exakte Access-Anwendungspfad-Ausnahme** konfigurieren (Bypass ausschließlich für diesen einzelnen Endpunkt); im Worker erzwingen wir weiterhin den langen Bearer-Token und CORS-Allowlist für \`https://adventure.land\`. Keine allgemeine Domain-Bypass-Policy setzen. Browser-Preflight \`OPTIONS\` auf diesem Pfad darf nicht von Access abgefangen werden. Dashboard, HTML und alle anderen \`/api/*\` müssen Access-authentifiziert bleiben.
6. Cloudflare D1-Datenbank \`albot-konfigurator\` anlegen, die **echte** \`database_id\` in \`wrangler.toml\` eintragen und \`schema.sql\` einmalig migrieren.
7. \`cd konfigurator && npx wrangler deploy\` erst danach ausführen. Browser-Login und Access-Prüfung im Live-Worker überprüfen, bevor echte Itemrichtlinien gespeichert werden.

**Wichtig:** \`Cloudflare Access\` muss vor der Worker-Domain aktiviert sein; bei fehlenden Access-Secrets gibt die Anwendung HTTP 503 statt einer ungeschützten Website zurück. Ohne Datenbank sind die Liveansichten leer, nicht erfunden. Der persönliche Ingame-Bootstrap bleibt bis zu einer gesonderten validierten Konfigurationssignatur unverändert.

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

Ein Ingame-Browser sendet bei \`POST /api/ingest\` mit \`Authorization\` einen CORS-Preflight (\`OPTIONS\`). Deshalb darf nur dieser **exakte Pfad** außerhalb der Login-Weiterleitung liegen. Seine eigentliche \`POST\`-Verarbeitung besitzt eine unabhängige, konstante Bearer-Token-Prüfung. Vom Worker antwortet der Pfad auf Preflight nur für \`https://adventure.land\`; jeder andere Origin erhält 403. Falls Adventure Land aus einer anderen origin ausgeführt wird, erst nach Prüfung \`INGEST_ALLOWED_ORIGIN\` konfigurieren. Das ist keine Erlaubnis für fremde Websites und keine Garantie, dass ein Token im öffentlich sichtbaren Code geheim bleibt. Der spätere private Browser-/Headless-Adapter muss Schlüssel getrennt vom öffentlichen Runtime-Repository halten.

## Read-only Telemetrie-Snapshot (Stufe 1)

Das neue Modul `src/runtime/telemetry-snapshot.mjs` stellt validierte Read-only-Snapshot-Bausteine bereit. **Es ist noch nicht in die signierte Ingame-Runtime eingebunden**, weil der bestehende Bootstrap-Vertrag ausschließlich signierte, gemeinsam freigegebene Runtime-Artefakte erlaubt. Die Methode `ALBot.telemetrySnapshot()` ist daher noch nicht aktiv. Die Modulfunktionen erzeugen stattdessen defensive Kopien von aktuellen Charakterdaten und ausschließlich lokal beobachteten, vollständigen Bankpacks. Sie **sendet keine Requests**, enthält **keinen Token** und verändert weder Inventar noch Bank noch Item-Entscheidungen. Bank-Pakete sind keine Vollständigkeitsbeweise für den Account. Noch nicht nachgewiesene EXP-/Gold-Raten tragen `ratesMeasured:false`; das Dashboard zeigt dafür ein Strichsymbol statt einer erfundenen Zahl.

Diese Daten werden später von einem separaten **privaten** Transport/Relay an `/api/ingest` übertragen, frühestens alle 120 Sekunden je Charakter und maximal ein Bankpack je Intervall. Zugangsschlüssel dürfen nicht im veröffentlichten GitHub-Runtime-Code liegen. Bis eine sichere private Übertragung eingerichtet und getestet ist, entstehen durch diese neue Funktion **null zusätzliche Cloudflare-Requests**.

## Harte D1-Limits fuer kostenlosen Betrieb

Der Worker speichert pro Charakter hoechstens alle 120 Sekunden einen Snapshot. Fuer Bankpacks gilt dieselbe Drosselung global, unabhaengig vom Pack. Es duerfen maximal 12 Charaktere und 24 Bankpacks vorhanden sein. Weitere oder zu schnelle Schreibversuche werden mit HTTP 429 (Retry-After: 120) abgewiesen. Bei gesperrten Uploads darf der private Client keine schnellen Wiederholungen ausloesen.

Dashboard-API-Antworten schliessen Snapshots aus, die aelter als sieben Tage sind. Alte Daten verbleiben maximal innerhalb der festen Tabellenobergrenzen. Fuer die neue Logik ist keine D1-Migration und kein kostenpflichtiger Cloudflare-Dienst erforderlich.

Diese Drossel begrenzt D1-Schreiboperationen, nicht die Anzahl eingehender Worker-Requests oder fremde Cloudflare-Account-Nutzung. Workers Free muss weiterhin aktiv bleiben; echte Accountkosten und alle weiteren Produkte sind im Billing-Dashboard zu kontrollieren.

## Access-geschuetztes Browser-Relay (Opt-in)

Die separate Seite `/relay.html` ist durch dieselbe Cloudflare-Access-Anmeldung wie das Dashboard geschuetzt. Sie akzeptiert nach einem ausdruecklichen Klick nur `postMessage`-Pakete vom tatsaechlich oeffnenden Adventure-Land-Fenster und nur mit `origin=https://adventure.land` oder `https://www.adventure.land`. Sie uebertraegt diese an den gleichurspruenglichen Endpunkt `POST /api/relay-ingest`.

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
