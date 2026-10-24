# ALBot 0.53.0-candidate — Offline-Zertifizierung (24.10.2026)

## Gegenstand
- Geschützter Release-Kanal: `codex/w00-w01-readonly-disposition-20261018`
- Neu signierter Stand: `0.53.0-candidate`, Manifest-`sequence: 53`
- Entwicklungs-PR: [#476](https://github.com/Riflex91/ALBot/pull/476), Merge nach `main`: `93f7bafaad30c6f9e85ee74d8d1327ffed06cc28`
- Release-Anforderung: `8bf4e9fb7fd3ac8e45c6e3834eaad6a7ef1e27a3`
- Signierter Veröffentlichungs-Commit: `83b7090657c830ea999cd561b1f6d53fb787ab65`

## Reproduzierbare Prüfungen
- [Linux-/Windows-PR-CI #40114166805](https://github.com/Riflex91/ALBot/actions/runs/40114166805): beide Jobs erfolgreich.
- [Geschützter Signierworkflow #40114473479](https://github.com/Riflex91/ALBot/actions/runs/40114473479): 2622 Offline-Tests, 0 Fehler; ECDSA-P-256-Signatur erstellt und mit dem gepinnten öffentlichen Schlüssel verifiziert.
- [Reproduktions- und Artefaktlauf #40114669367](https://github.com/Riflex91/ALBot/actions/runs/40114669367): 2622 Offline-Tests, 0 Fehler; `npm run verify:release` erfolgreich; Quellcode-/Runtime-/Bootstrap-Abgleich.

## Signierte Runtime
- Runtime-Bytes: **1000476**
- SHA-256: `74cb919cf6b8b5ddf49240d27889c61df470c4d823acdf1c67dda49c8c58186f`
- Signiertes Manifest: [dist/albot.release.json](https://github.com/Riflex91/ALBot/blob/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json)
- Runtime: [dist/albot.runtime.js](https://github.com/Riflex91/ALBot/blob/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js)
- Loader: dynamisch auf den unveränderten Manifest-Kanal gepinnt; P-256-Signaturprüfung, SHA-256- und Sequenzkontrolle bleiben aktiv.

## Verhaltensänderungen
- Normale Farmsicherheit unabhängig vom `testLogging`-Schalter.
- Ablaufende Offensiv-Buffs werden im prognostizierten Zeithorizont konservativ entfernt; bestätigte Monster-Debuffs bekommen nur verifizierte, begrenzte Wirkung.
- Bestehende Aura-, Schutz-, Heilungs- und mechanische Ausschlussregeln bleiben wirksam.
- Persönliche Einstellungen: `world.risk: assertive`, `farming.maxCombatSeconds: 45`. `farming.mode: balanced` bleibt auf kombinierte XP-/Gold-Optimierung eingestellt.

## Geltungsgrenze
Diese Zertifizierung belegt Build-Konsistenz, Offline-Regressionen, signiertes Manifest und kryptografische Integrität. Sie **belegt keine authentifizierte Ingame-Liveabnahme, Kampf-Dauerteststrecke oder erfolgreiche Anwendung sämtlicher Statuswirkungen unter echten Serverbedingungen**. Keine privaten Signierschlüssel oder persönlichen Telemetrie-Tokens werden veröffentlicht.
