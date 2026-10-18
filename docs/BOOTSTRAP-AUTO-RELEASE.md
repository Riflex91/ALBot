# ALBot: Bootstrap einmal installieren – signierte Runtime-Releases

Stand: 18. Oktober 2026. **Opt-in-Testkandidat auf Draft-PR #157.**

## Was einmalig installiert wird

Die **neue** Datei [dist/albot.bootstrap.auto.js](../dist/albot.bootstrap.auto.js)
enthält deine unveränderte persönliche `globalThis.ALBotConfig` mit
`general.autostart=true` und einen **dauerhaft fest eingebauten öffentlichen
ECDSA-P-256-Prüfschlüssel**.

Dies ist bewusst **nicht** dieselbe Datei wie der zuvor erfolgreich live
getestete feste SHA-256-Bootstrap `dist/albot.bootstrap.js`. Eine **einmalige**
Ersetzung des bisherigen CODE-Slots durch `dist/albot.bootstrap.auto.js` ist
erforderlich, damit künftige Runtime-Updates ohne erneutes Einfügen der
Startdatei funktionieren. Bis zur Liveabnahme bleibt die ältere Version
unverändert verfügbar.

## Ablauf bei jedem Bot-Start

1. Der CODE-Runner führt den kleinen Autostart-Loader aus.
2. Der Loader ruft per HTTPS mit `cache:no-store` und ohne Cookies
   `dist/albot.release.json` vom freigegebenen GitHub-Kanal ab.
3. Er prüft die **ECDSA-P-256-SHA-256-Signatur** mit seinem unveränderlichen
   öffentlichen Schlüssel. Die Signatur umfasst Format, monoton steigende
   Release-Sequenz, Version, Runtime-URL, Byte-Länge und SHA-256-Hash.
4. Erst danach lädt er die so freigegebene Runtime; der Browser muss Länge,
   SHA-256 und Runtime-Versionskennung exakt bestätigen.
5. Erst jetzt wird die Runtime ausgeführt. Bei `autostart=true` muss die
   echte `ALBot.status().running`-Rückmeldung `true` sein, sonst erscheint
   ein Fehler. Eine abweichende/ältere signierte Release-Sequenz wird bei
   verfügbarem `localStorage` abgewiesen.

**Kein Hot-Swap während eines Kampfes:** Eine freigegebene neue Version wird
beim **nächsten CODE-Start/Neustart**, nicht mitten im laufenden Runner geladen.

**Fehlerfall:** HTTP/CORS/CSP/WebCrypto, unsigniertes oder manipuliertes
Manifest, abweichende Runtime, zu große Datei oder Startverweigerung
führen zu `ALBotBootstrapStatus.phase='blocked'`; niemals zu einem
ungeprüften Fallback. Die gesamte Runtime darf maximal 8 MiB groß sein
(Transport-/Speicher-Sicherheitsgrenze), und CODE sowie System-RAM haben
weiterhin eigene Grenzen.

## Signierschlüssel: einmalig geheim konfigurieren

Der private P-256-Schlüssel wurde **außerhalb des GitHub-Repositories**
erzeugt. Nur der öffentliche Schlüssel `release/public-key.json` ist dort
abgelegt. Für neue signierte Veröffentlichungen musst du den privaten
Schlüssel **einmalig** als GitHub-Actions-Repository-Secret hinterlegen:

1. Die gesondert übergebene Sicherungsdatei
   `ALBot-Release-Private-Key.pem` sicher herunterladen und aufbewahren.
   Diese Datei **niemals** committen, ins Spiel kopieren oder posten.
2. In GitHub das Repository `Riflex91/ALBot` öffnen:
   **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: **`ALBOT_RELEASE_SIGNING_KEY_PEM`**.
   Als Wert den **vollständigen Inhalt** der PEM-Datei inklusive
   BEGIN-/END-Zeilen einfügen.
4. Das Secret bleibt in GitHub Actions verborgen. Fehlt es, wird ein
   Release **nicht** signiert und **nicht** veröffentlicht.

Das initiale Release `sequence=1` ist bereits korrekt signiert
und benötigt das Secret **nicht zum Laden**, sondern erst beim nächsten
genehmigten neuen Release.

## Bei zukünftigen Updates

Der Repository-Workflow `.github/workflows/publish-signed-runtime.yml`
führt Build, sämtliche Tests, persönliche Konfigurationsprüfung, Editor-Build,
Signaturerzeugung und kryptografische Gegenprüfung aus. Er veröffentlicht
**Runtime und signiertes Manifest gemeinsam in einem Commit**.

Solange die Funktion auf dem **Draft-Branch** bleibt, kann der signierende
Workflow durch einen genehmigenden Commit mit dem Beginn
`release(request): ` auf diesem Branch ausgelöst werden. Ein späterer
manueller `workflow_dispatch`-Start über die GitHub-Actions-Oberfläche
setzt voraus, dass die Workflow-Datei auch auf dem Default-Branch liegt.
Normale Entwicklungskom­mits lösen **keine** signierte Freigabe aus.
Der Freigabeschritt bleibt ausdrücklich notwendig, damit nicht jede
ungetestete Änderung sofort im Spiel startet.

**Am bestehenden CODE-Slot ist dann nichts zu ändern:** Nach erfolgreichem
Release genügt der nächste CODE-Neustart, damit der installierte Auto-Loader
die signierte neue Runtime bezieht. Das ist der entscheidende Unterschied
zum alten Bootstrap mit fest verdrahtetem Runtime-Hash.

Die persönliche Konfiguration steckt weiterhin im Loader. Änderungen
**an den persönlichen Einstellungen oder am öffentlichen Signierschlüssel**
erfordern daher einen neuen Bootstrap im CODE-Slot; reine Runtime-Versionen
nicht.

## GitHub/CI-Tests und noch offener Live-Test

[Verifikation 39143035510](https://github.com/Riflex91/ALBot/actions/runs/39143035510):
Linux 1.356/1.356, Windows 1.356/1.356, null Fehler. Die Tests decken
Signaturfehler, abweichende Bytes, Fehlstarts, HTTP-Ausfälle, Rollback und
den Wechsel von Release 1 auf Release 2 **ohne Bootstrap-Änderung** ab.
Der veröffentlichte erste Manifestbeleg wurde gegen den im CODE
eingebauten P-256-Schlüssel überprüft. Die vollständige persönliche
Konfiguration wurde unverändert übernommen.

**Noch offen:** Dieser **neue** ECDSA-Loader benötigt einen eigenen
echten CODE-Runner-Test mit aktiviertem Autostart. Die Nutzerbestätigung
des bisherigen SHA-256-Bootstraps ist ein positiver Vorbefund, aber
kein Beweis für die neue Browser-ECDSA-Prüfung. Zunächst nur einen
Farmer testen; den ursprünglichen CODE-Slot sichern und beim Fehler
zurückwechseln. Der Code wird in dieser Entwicklungsrunde nicht
automatisch im Spiel installiert.
