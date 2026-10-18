# ALBot – optionaler verifizierter Bootstrap (18.10.2026)

## Ziel

Die Spiel-CODE-Datei `dist/albot.bootstrap.js` enthält die **unveränderte persönliche `ALBotConfig`** und einen kleinen Launcher statt der vollständigen Runtime. Die Runtime wird von GitHub als separate Textdatei geladen, **vor Ausführung SHA-256-verifiziert** und erst anschließend im bestehenden CODE-Kontext ausgewertet.

**Der Bootstrap ist ein Opt-in-Kandidat.** Er ersetzt derzeit weder `bot.js` noch den Browser-/Headless-Start im Spiel. Weder ein CORS- noch ein CSP-/Eval-Livetest im Adventure-Land-Code-Runner wurde durchgeführt.

## Artefakte und Befehle

Nach `npm ci --ignore-scripts`:

```bash
npm run build
node scripts/sync-personal-code.mjs --write
npm run build:bootstrap
npm run check:bootstrap
npm test
```

Die Runtime-Quelle liegt unter `dist/albot.runtime.js`. Der Bootstrap liegt unter `dist/albot.bootstrap.js` und wird nicht im herkömmlichen `bot.js` gespeichert. Er enthält **keine** Inline-Runtime. `scripts/bootstrap-support.mjs` erzeugt den Launcher aus dem persönlichen Konfigurationspräfix und berechnet den SHA-256-Digest **aus den UTF-8-Bytes** der tatsächlich gebauten Runtime. `scripts/build-bootstrap.mjs --check` erkennt jede Drift.

## Abruf, Bindung und Fehlerverhalten

- Aktuelle Quelle: `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js`. Der Branchname ist nicht kryptografisch unveränderlich; **der eingebettete SHA-256-Digest ist die Integritätsbindung**. Bei jedem neuen Build müssen Quell-Runtime und Bootstrap gemeinsam veröffentlicht werden.
- Der Bootstrap fordert die Runtime mit `fetch`, `credentials:'omit'` und `cache:'no-store'` an. Unbekannte HTTP-Status, fehlende WebCrypto- oder Fetch-Fähigkeit, ein Timeout, ungültiges UTF-8, eine unerwartete Runtime-Kennung oder ein Hash-Mismatch führen zum **Abbruch ohne Runtime-Ausführung**. Auch ein späterer Branch-Update startet nicht automatisch eine neue Codeversion: Ein noch nicht aktualisierter Launcher stoppt sicher.
- Die Ausführung nutzt erst nach dem Integritätsnachweis indirektes globales `eval` im CODE-Kontext. Dies muss **im tatsächlichen Adventure-Land-Browserrunner** wegen möglicher Content-Security-Policy-/Cross-Origin-/Iframe-Einschränkungen geprüft werden. Keine Datei oder Aussage aus Offline-CI kann diesen Test ersetzen.
- `globalThis.ALBotBootstrapStatus` zeigt `loading`, `launched` oder `blocked` einschließlich eines Grunds. `globalThis.ALBotBootstrapReady` ist das Start-Promise. Ein fehlgeschlagener Abruf hat bewusst **keinen ungesicherten Netzwerkfallback**.
- Fremde URLs und manipulierter Code sind keine vertrauenswürdige Betriebsquelle. Der Generator erlaubt keine unverschlüsselten URLs und schreibt keine Accountgeheimnisse in die Runtime.

## Verifikation, Rückweg und Größe

Die Offline-Tests unter `test/bootstrap-runtime.test.mjs` simulieren Fetch, Hash, Codeausführung, Fehlermeldungen und das Fail-Closed-Verhalten. Die gewöhnliche vollständige persönliche `bot.js` wird beibehalten und vor/nach Synchronisierung JSON-semantisch auf **alle** Konfigurationseinträge verglichen. Bei einem in der Spielumgebung fehlschlagenden Bootstrap ist diese unveränderte `bot.js` der Rückweg.

Die Codefenster-Grenze betrifft weiterhin den **Launcher**, nicht die nachgeladenen Runtime-Bytes. Dieser Ansatz reduziert das Wachstum der in CODE eingefügten Datei erheblich, garantiert aber keine unbegrenzte Verfügbarkeit: Transport/CORS/CSP, Host-Verfügbarkeit, Laufzeitspeicher, der 8-MiB-Download-Sicherheitsguard und eventuelle separate Headless-Runtime-Limits bleiben relevant. Der bisherige vollständige Inline-Build und dessen strengere 900-KiB-Integrationstest bleiben während der Migration bewusst bestehen.

## Freigabegrenze

**Keine Liveinstallation oder Änderung des Spiel-CODE-Slots in dieser Runde.** Bevor der Launcher zur Standardstartdatei wird, sind ein isolierter Browser-Smoke-Test ohne Autostart-Wertaktionen, CORS-/Eval-Funktionstest, ein Neustart mit korrektem Digest und ein absichtlicher Hash-Fehlertest im CODE-Runner nötig. Bank-/NPC-/Goldaktionen sind nicht Bestandteil dieser Bootstrap-Abnahme.
