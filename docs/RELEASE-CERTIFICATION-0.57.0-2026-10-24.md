# ALBot 0.57.0-candidate — signierte Offline-Freigabe (24.10.2026)

## Nachweiskette

- Integration der aktuellen Farmer-Navigation aus [PR #491](https://github.com/Riflex91/ALBot/pull/491) in `main`: `aa3b6c3ee070a1cbbb67db1770b24f3f3fcc40cb`.
- Vollständige Linux- und Windows-Offline-Prüfung auf exaktem PR-Head `3df42ace8ac20a48c37a7e63997d155f745b51e5`: [GitHub Actions #40124486861](https://github.com/Riflex91/ALBot/actions/runs/40124486861), beide erfolgreich.
- Der bestehende Signierer fordert pro signiertem Release **+0.1 Minor-Version**. Daher reguläre, vollständig geprüfte GitHub-Actions-Veröffentlichungen:
  - 0.55.0-candidate / Sequenz 55, [#40125940594](https://github.com/Riflex91/ALBot/actions/runs/40125940594).
  - 0.56.0-candidate / Sequenz 56, [#40126047772](https://github.com/Riflex91/ALBot/actions/runs/40126047772).
  - 0.57.0-candidate / Sequenz 57, [#40126153596](https://github.com/Riflex91/ALBot/actions/runs/40126153596).
- **Alle drei Signierläufe erfolgreich:** vollständige Offline-Tests, persönliche ALBotConfig-Konstanz, V2-Bootstrap unverändert, Editor-Build, Signaturerstellung ECDSA-P-256 und erneute Prüfung signierter Runtime-Bytes.
- Finale geschützte Veröffentlichung auf `codex/w00-w01-readonly-disposition-20261018`: Commit `7cf861e1158e0838dbce4d6b8c26934a1b0badc8`.
- Manifest: `version=0.57.0-candidate`, `sequence=57`, `bytes=1032743`, SHA-256 `2517d22acecf80ad27e43754df1ed125932824d6e56a30562836b0ef84ca75d9`.
- Finales `dist/albot.runtime.js` Git-Blob `4c7816a8b651d833b2e13e79491ad82e1a6e2f8b` ist auf `main` und dem Release-Branch **identisch**. Persönliche Konfiguration ist bytegleich; der öffentliche Trust-Key und die im CODE installierte V2-Release-URL wurden nicht geändert.
- `main` enthält nun zusätzlich das exakte, signierte Manifest als dokumentierten Referenzstand, und `bootstrap.contract.json` dokumentiert Sequenz 57. Das ist **kein** neuer Signierschritt und **keine** heimliche Änderung des bereits installierten Loaders.

## Live-Abnahme und Restrisiken

**Die Kryptografie/CI-Freigabe belegt keine Ingame-Spielrisikofreiheit.** Für den neuen weltweiten physischen Wegplaner bestehen weiterhin offene Risiken: reales `can_move` als kollisionsprüfende Runtime-Schnittstelle, bewegliche Monster, lange Reichweite, Portale, Kampfeinstieg in aggressive Ziele, Priest-Heilung und koordinierte Führung von drei Farmern. Die Ingame-Validierung ist weiterhin `pending`. Der Nutzer hat die Veröffentlichung explizit angefordert. Beim nächsten CODE-Neustart liest der signierte V2-Autoloader das neue Manifest; bis zu einem kontrollierten Spieltest nicht als beaufsichtigungsfreien Dauereinsatz behandeln.
