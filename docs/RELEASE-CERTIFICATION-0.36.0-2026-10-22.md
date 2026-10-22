# ALBot 0.36.0-candidate — signierte Offline-Zertifizierung

**Stand:** 22.10.2026. **Status:** Zertifiziert für signierten Offline-Build; W14-Ingame-/Langzeitabnahme ausstehend.

## Freigabebasis

- Vollständig integrierter Ausgangsstand: `main` `b9efdc6e100c3e3d9351369d99b220246e6c3f4c` (inklusive aller bis dahin gemergten PRs, zuletzt #420).
- Releaseversion: `0.36.0-candidate`; signierte monoton steigende Sequence **36** (zuvor **35**).
- [PR #421](https://github.com/Riflex91/ALBot/pull/421) nach erfolgreicher vollständiger Linux- und Windows-CI auf `7c8840884b5000e522a57e5ce321159d17516b8d` konfliktfrei nach main gemergt.
- Signatur ausschließlich durch den bestehenden GitHub-Actions-Workflow [39821966672](https://github.com/Riflex91/ALBot/actions/runs/39821966672), auf dem ursprünglichen geschützten Release-Branch; Abschlussstatus `success`.
- Der Signierworkflow hat den Runtime-Build erneut ausgeführt, **2440** vollständige Offline-Tests mit **0 Fehlern** bestanden und das unveränderte persönliche Konfigurationssegment ausdrücklich überprüft.

## Signiertes Artefakt

- Manifestformat: `albot-release-v1`
- Version: `0.36.0-candidate`
- Sequence: `36`
- Runtimebytes: **946860**
- SHA-256: `68ab546e675c6fdb0d2e6878f7814c213517f81361d548dda646745d087aec31`
- Signaturverfahren: **ECDSA P-256 / SHA-256**, überprüft mit dem bestehenden gepinnten Public Key durch `npm run verify:release`.
- Release-Commit: `3d244dc0dfa6334bf2377f1ca8e1cbbfe16657cd`.
- Runtime-Git-Blob in Release **und** getestetem main: `d76e5f6c2556ff2d9b93d2f065e4df1e9d8bc1a3` — byteidentisch.
- Weitere identische Git-Blobs: `bot.js`, `dist/albot.js`, `dist/albot.bootstrap.auto.js`, `editor/Bot-Werkstatt.html` und `src/version.mjs`.
- Bestehender [signierter Manifestkanal](https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json) und [Runtime](https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js) unveränderte URLs.

## Grenze der Zertifizierung

Der geprüfte Stand belegt Offline-Testabdeckung, Build-Parität, Signaturintegrität, unveränderte persönliche Einstellungen und Veröffentlichung auf dem signierten V2-Kanal. Er **belegt weder** tatsächliche Ausführung im Adventure-Land-Spiel **noch** die noch offene W14-Dauerlauf-/Recovery-/Merchant-Abnahme. Spätere Codeänderungen an main sind nicht ohne erneute Versionserhöhung und Signierung Bestandteil von Sequence 36.
