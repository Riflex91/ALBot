# ALBot 0.60.0-candidate — signierte Offline-Zertifizierung (25.10.2026)

Die Korrekturen für feststehende Farmer, Upgrade-Chancen und Ausrüstungsversorgung sind in [PR #495](https://github.com/Riflex91/ALBot/pull/495) integriert. Getesteter PR-Head `024fa1c126870b39231308ba4aa63caa40cf5061`, Main-Merge `2681d52bc6f46e1e76ff23dfc36cb75857573d2c`.

## Prüfungen

- [Linux- und Windows-CI #40178351835](https://github.com/Riflex91/ALBot/actions/runs/40178351835): beide erfolgreich; jeweils vollständige Offline-Prüfung mit **2696 Tests, 0 Fehlern**.
- Build, personalisierte bot.js, Browser-/Headless-Paket, Editor, Konfigurator/Privacy, Syntax und Manifest geprüft.
- Gemeinsames Bundle: **1048571 / 1048576 Bytes**. Die bestehende Grenze wurde beibehalten; drei Terser-Optimierungsläufe sparen redundanten Code.
- Bestehender Signierworkflow, unveränderte +0.1-Regel: [0.58 / Sequenz 58](https://github.com/Riflex91/ALBot/actions/runs/40178561653), [0.59 / Sequenz 59](https://github.com/Riflex91/ALBot/actions/runs/40178635254), [0.60 / Sequenz 60](https://github.com/Riflex91/ALBot/actions/runs/40178725966). Alle erfolgreich, mit vollständigen Tests, Config-Konstanz, Editor-Build, ECDSA-P-256-Signierung und erneuter Verifikation.
- Veröffentlichtes signiertes Release: `c1a3926595e79cde58acb2848f1636415004a756`.
- Runtime: **1040486 Bytes**, SHA-256 `83a86b6b68288ab8d7001f6fba894a50cf45e87542012b8c00d5c49438de0800`.
- Runtime-Git-Blob auf Main und Release: `ff89f5c4073c7b6ae8e7a39e8c3a8120abc33104`. Source-Dateien und Runtime-Bytes lokal vollständig abgeglichen.
- Persönliche ALBotConfig bytegleich. V2-Loader, öffentlicher Trust-Key und Download-/Manifest-URLs unverändert. Der private Schlüssel wurde ausschließlich im bestehenden GitHub-Actions-Signierworkflow verwendet.
- Während der Releasevorbereitung blieb jeweils die vorherige signierte Runtime am Kanal verfügbar; neue Runtime und Signatur wurden zusammen vom Workflow publiziert.

## Enthaltene Korrekturen

Einmaliger nativer Bewegungsstop statt searching-Endlosschleife; begrenzter risikogeprüfter Ausstieg aus bestehenden Gefahrenzonen; sicherer Sammelpunkt mit separatem Gruppeneintritt; endliche Routenquarantäne und lokale Neuplanung; gültige Grace-Chancen über 100 Prozent; physische Einmalverplanung von Bankausrüstung; eigene Merchant-Accessoires; sicherer Anlaufpunkt innerhalb der bestehenden Übergabereichweite. Wiederholte Stock-, Farmraten- und Teilweg-Auswertungen werden vermieden. [Umsetzung und Einschränkungen](FARM-GEAR-CORRECTIONS-2026-10-25.md).

## Laden im Spiel und Grenzen

Der vorhandene **signierte V2-Bootstrap** lädt beim nächsten CODE-Neustart über die unveränderte Manifest-URL die neue Version. Ein erneutes Einfügen des großen Botcodes ist nicht erforderlich.

Dies ist eine kryptografisch und offline geprüfte Runtime. Die erfolgreiche Ingame-Abnahme der neuen Navigation, Übergaben und des Dauerbetriebs ist weiterhin offen. Ohne vorhandene Accessoires oder belegten, freigegebenen Beschaffungsweg bleiben entsprechende Slots unerfüllt; zusätzliche Marktkaufrechte wurden nicht erteilt. Eine harte 4-ms-Planungsgrenze oder gemessene Live-Beschleunigung wird nicht behauptet.
