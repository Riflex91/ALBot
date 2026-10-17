# Live-Abnahme: Merchant, Elixiere und Teamkampf (PR #134)

Diese Prüfung läuft **ausschließlich offline**. Sie liest vorhandene ALBot-Testreports (JSON und JSONL), führt weder Spielaktionen noch Markt-, Bank- oder GitHub-Schreibvorgänge aus und ändert keine persönliche ALBotConfig.

## Ablauf unter Windows (PowerShell)

Alle vier Charaktere müssen **denselben Realm, dieselbe Bot-Version und denselben Testlauf** verwenden. Nach einem 10–15-minütigen Live-Test die Berichte der drei aktiven Farmer und des Merchants exportieren.

Im Repository mit den tatsächlichen Dateipfaden ausführen:

~~~powershell
node scripts/CHECK-LIVE-TEAM.mjs --strict --require-three-farmers --require-elixirs --max-departures 12 --max-idle-seconds 60 --out LIVE-AUDIT.json "C:\Logs\test-My_Merchant-<timestamp>-part001.json" "C:\Logs\test-My_Ranger1-<timestamp>-part001.json" "C:\Logs\test-My_Ranger2-<timestamp>-part001.json" "C:\Logs\test-My_Priest-<timestamp>-part001.json"
~~~

Für JSONL dieselben Pfade verwenden. Existieren mehrere Teile einer **identischen Sitzung**, sämtliche zugehörigen JSONL-Dateien angeben. Der Analyzer führt Zeilen über die Event-Sequenz zusammen und erkennt fehlende Abschnitte. Verschiedene Neustarts eines Charakters dürfen nicht miteinander vermischt werden.

Ohne --strict ist das Werkzeug eine Diagnosehilfe. Mit --strict führen Fehler und Warnungen zu Exit-Code 1; auch **fehlende Ereignisse** verhindern eine uneingeschränkte Live-Abnahme. Mit --require-three-farmers fehlen bei weniger als drei Farmberichten zwingende Nachweise. --require-elixirs verlangt in jedem Farmer-Equipment-Snapshot ein ausgerüstetes Elixier. Eingabefehler liefern Exit-Code 2, erfolgreiche Prüfung 0.

## Nachweisgrenzen

- **Merchant-Pursuit:** depart, retarget, stop und andere Verfolgungsereignisse werden je Empfänger gezählt. Viele Abfahrten ohne passende Übergaben sind ein Leistungsindikator, aber kein Beweis für den konkreten Auslöser der Fahrt.
- **Item-Pingpong:** Gegenläufige inventory.intent/send-Ereignisse derselben Item-Variante innerhalb von 120 Sekunden werden erkannt. Zusammengehörige send/receive-Intents werden über ID, Absender, Empfänger und Variante korreliert. Ein Intent allein ist **keine** bestätigte Serverübergabe.
- **Elixiere:** Die Auswertung trennt korrelierte Übergaben von einem **im abschließenden Equipment-Snapshot ausgerüsteten** Elixier. Die physisch mitgeführten Elixiere des Merchants werden separat angezeigt.
- **Kampfpausen:** Nur aufeinanderfolgende sample-Einträge werden ausgewertet; große Abstände, laufende Wertaktionen und beobachtete Angriffe unterbrechen einen Idle-Zeitraum. Das **beweist nicht**, dass ein erreichbares, freigegebenes Monster vorhanden war. Für diese Aussage braucht es zusätzliche Spawn-/Reichweiten-/Sicherheits-Telemetrie.
- **Abgeschnittene Logs:** Die bisherigen Ranger-Reports enthielten verworfene Ringpuffereinträge. Ein vollständiger JSONL-Stream erlaubt deren Rekonstruktion; ein unvollständiger oder nur später Teil wird im Strict-Modus nicht als vollständiger Nachweis akzeptiert.

Die Grenzen 12 Merchant-Abfahrten und 60 Sekunden beobachtete Kampfpausen sind **konfigurierbare Abnahmeschwellen**, keine universellen Optimalwerte. Bei anderer Testdauer entsprechend anpassen.

## Regressionen und Veröffentlichung

~~~powershell
npm test
npm run build
node scripts/sync-personal-code.mjs --check
~~~

Offline-Tests und Build-Parität bestätigen keinen erfolgreichen Elixiertransfer und keine Verringerung der Verfolgungen im echten Spiel. Die personalisierte bot.js darf nur nach bestandener Synchronisationsprüfung und unveränderter ALBotConfig veröffentlicht werden.

## Ausgangsbefund aus dem alten 0.10.9-Livetest

- Merchant: 63 logistics.pursuit-Ereignisse zu My_Priest; der Test bestätigte mehrfaches hpbelt +0 Hin-und-zurück.
- Priest: coat +5 und pants +5 bestätigt angelegt; Belt am Testende leer.
- Ranger2 und Priest: kein ausgerüstetes Elixier; Merchant trug elixirint0; mehrere Marktangebote fehlten.
- Beide Ranger griffen an und nutzten 3shot. Die früheren Stichproben enthalten Kampfpausen, aber nicht den vollständigen Nachweis erreichbarer Monster während dieser Pausen.

**Wichtig:** Diese Ausgangswerte stammen aus der **alten Runtime vor den PR-#134-Änderungen**. Für die Abnahme sind neue Live-Logs notwendig.
