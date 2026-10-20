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
5. Cloudflare D1-Datenbank \`albot-konfigurator\` anlegen, die **echte** \`database_id\` in \`wrangler.toml\` eintragen und \`schema.sql\` einmalig migrieren.
6. \`cd konfigurator && npx wrangler deploy\` erst danach ausführen. Browser-Login und Access-Prüfung im Live-Worker überprüfen, bevor echte Itemrichtlinien gespeichert werden.

**Wichtig:** \`Cloudflare Access\` muss vor der Worker-Domain aktiviert sein; bei fehlenden Access-Secrets gibt die Anwendung HTTP 503 statt einer ungeschützten Website zurück. Ohne Datenbank sind die Liveansichten leer, nicht erfunden. Der persönliche Ingame-Bootstrap bleibt bis zu einer gesonderten validierten Konfigurationssignatur unverändert.

## Voraussetzungen für echte Konfigurationsübernahme

Für Hot-Reload muss künftig eine serverseitig signierte versionierte Konfiguration in einen allein lesbaren, bereinigten Clientkanal veröffentlicht werden. Der bestehende Ingame-Loader besitzt aktuell nur den verifizierten Runtime-Download mit persönlicher \`ALBotConfig\`. Weder GitHub-Commit noch Worker-Speichern alleine aktualisiert laufende Bots. Signaturvalidierung, Rollbackschutz, kompatible Schema-Migration, sichere Entscheidungspunkte und Charakter-ACK müssen vor Aktivierung implementiert und im Browser sowie Headless überprüft werden.

## Betriebskosten

Die Ausgabe einzelner Änderungs-Events und Charakter-Herzschläge im Bereich 15–30 Sekunden ist für vier Bots vorgesehen. Bankfächer werden nur nach tatsächlichen Bankbeobachtungen hochgeladen. Cloudflare-Free-Quoten sind anwendungs- und accountabhängig zu prüfen. Der derzeitige Code versendet **noch keine automatische Bot-Telemetrie**.

## Profilimport und private Speicherung

Nach der Cloudflare-Einrichtung die Seite \`/classic.html\` öffnen. Falls im privaten Repo noch kein \`albot/profile.json\` existiert, das aktuelle eigene Profil **einmalig** über „Profil öffnen“ (JSON) oder einen bereits vorhandenen lokalen Entwurf übernehmen. Erst danach „☁ Profil auf GitHub speichern“ wählen. Bei folgenden Aufrufen lädt der Adapter automatisch das private GitHub-Profil, ohne einen lokalen Entwurf ungefragt zu überschreiben. Die globale Item-Richtlinie bleibt unter \`albot/item-policies.json\` und ist nicht mit den bisher aktiven \`config.items\` identisch.

**Absichtlich noch keine automatische Signierung/Distribution:** Ein erfolgreicher GitHub-Commit bestätigt nur Speicherung. Die Ingame-Runtime verwendet weiterhin die im vorhandenen Bootstrap bereitgestellte persönliche \`ALBotConfig\`. Die neue Plattform darf niemals behaupten, dass ein Cloud-Profil ohne einen implementierten signierten Konfigurationskanal übernommen wurde.
