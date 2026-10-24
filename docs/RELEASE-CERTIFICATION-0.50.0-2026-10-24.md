# ALBot 0.50.0-candidate – signierter Offline-Zertifizierungsbericht (24.10.2026)

## Freigabekette

- W06/G09-Entwicklung: [PR #468](https://github.com/Riflex91/ALBot/pull/468) implementiert pro Farmer sitzungsgebundene endliche Materialquoten einschließlich TTL/Realm-/Sessionbelegen und Guards für Farmziel sowie Materialkampf. Ein bereits laufender Marsch bleibt beobachtbar, neue Kampfaktionen benötigen eine aktuelle Zuteilung.
- Finaler Entwicklungs-Head `361ba927a665399a03eddd4889d3395407004e7b`, [vollständig erfolgreiche Linux-/Windows-CI #40100822956](https://github.com/Riflex91/ALBot/actions/runs/40100822956), `mergeable=true` und `mergeable_state=clean` bei unveränderter PR-Basis `39aea09a20f1196a6d28676de747406c86729759`.
- Bestätigter main-Merge `287bf80e6206fd9e96122e49b73fccb96128fb71`; aktuelle Config-Sync-Sicherheitsfunktion PR #467 sowie andere integrierte Gear-/Materialänderungen erhalten.
- Ausschließlich bestehender geschützter [Signierworkflow #40100996547](https://github.com/Riflex91/ALBot/actions/runs/40100996547) abgeschlossen und erfolgreich. Signierter Release-Branch-Commit `b9d26a760f6f299ce956f06b20310e6bc20b5d1e`.
- Signierter Release **0.50.0-candidate / Sequence 50**, Runtimegröße **995231 Bytes**, SHA-256 `09d84d9c1d8f7f3a580869593b9e3574e3dac473129aa5abd22d401dabbe8872`. ECDSA-P-256 und SHA-256 im geschützten Workflow verifiziert; signierte Runtime und main haben identischen Git-Blob `591816b900cef6720563ba63b6f117423458db3e`.
- Personalisiertes `ALBotConfig`, signierter V2-Bootstrap, öffentliche Schlüssel, Release-URLs und geheime Signiermittel unverändert.

## Ausstehende Nachweise

Die Quotenbindung ist nur eine auf beobachteten Heartbeats beruhende Autorisierungsgrenze für bestehende Farmsteuerung. Dies ist keine verbindliche Adventure-Land-Serverquittung und keine vollständig beidseitig bestätigte Materialhandelsoperation. W02–W14 einschließlich W14-Ingame-Langzeittest bleiben teilweise offen. Offline-CI darf nicht als Live-Erfolg ausgegeben werden.
