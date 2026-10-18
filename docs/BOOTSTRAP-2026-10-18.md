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

## Autostart-Smoke-Test (18.10.2026)

Die personalisierte Bootstrap-Konfiguration enthält bereits `general.autostart=true`. Nach der erfolgreichen SHA-256-Prüfung verlangt der Bootstrap nun bei aktiviertem Autostart ausdrücklich `ALBot.status().running===true`. Bei abgelehntem Start wird `ALBotBootstrapStatus.phase='blocked'` gesetzt, einschließlich des Grundes; ein gelungener Start erzeugt die Meldung **ALBot Bootstrap: SHA-256 OK; Autostart AKTIV** und `phase='running'`.

**[GitHub Actions 39141853243](https://github.com/Riflex91/ALBot/actions/runs/39141853243): Linux 1.348/1.348 und Windows 1.348/1.348**, alle drei Jobs erfolgreich. Vollständiger persönlicher JSON-Vorher-/Nachhervergleich bestanden. Bootstrap 11.240 UTF-8-Bytes, unveränderter Runtime-SHA256 `e18f1c66ddc216caf62d162207ad98817568e0af968276082a1bcd3db5797319`. Aktualisierter Loader wurde im Repo veröffentlicht (Sync-Commit `342b2fb`); der temporäre CI-Workflow ist danach entfernt worden.

**Manueller Live-Test:** Zuerst nur einen Farmer auswählen (z. B. `My_Ranger1`), nicht den Merchant. Bestehenden CODE-Inhalt und Slot sichern, den laufenden CODE-Runner stoppen, den vollständigen GitHub-Inhalt `dist/albot.bootstrap.js` in einen Testslot kopieren und starten. Bei eingeschaltetem Autostart sind echte Spielaktionen (Bewegung/Kampf) möglich. Das Game-Log muss **SHA-256 OK; Autostart AKTIV** zeigen; `ALBot.status().running` muss `true` sein. Bei `blocked`, CORS/CSP-Fehlern oder unerwartetem Verhalten den CODE-Runner stoppen und den alten Slot wiederherstellen. Ein bloßes Speichern des Slots ersetzt keinen bereits laufenden CODE-Runner.

Die erfolgreiche Node-/Windows-CI ist **kein** tatsächlicher Game-Iframe-Test. Browser-Fetch, WebCrypto, CORS und indirektes globales Eval müssen bei dieser manuellen Live-Abnahme geprüft werden.

## Live-Rückmeldung vom 18.10.2026

Der Nutzer hat im Anschluss an die Anleitung zum Test mit eingeschaltetem `general.autostart=true` ausdrücklich zurückgemeldet: **„der bootstrap funktioniert“**. Damit ist das grundlegende Laden und Starten im tatsächlich verwendeten Adventure-Land-CODE-Runner **nutzerbestätigt**. Dies ist kein durch GitHub Actions oder den Assistenten selbst ausgeführter Live-Test. Es liegen im Gespräch noch **keine** übermittelten Game-Logs, Laufzeiten oder separat überprüften Ergebnisse für alle vier Charaktere vor. Insbesondere belegt die Rückmeldung noch keine längere fehlerfreie Spielsitzung und keine abgeschlossene Bank-, Gold- oder Merchant-Transaktion.

Die bestehende persönliche Konfiguration einschließlich `autostart=true` bleibt unverändert, die vollständige `bot.js` bleibt als Rückweg erhalten. Bei künftiger Runtime-Aktualisierung müssen Bootstrap und Runtime gemeinsam mit neuem SHA-256 veröffentlicht und erneut geprüft werden. `main` bleibt unberührt; PR #157 bleibt Draft.
