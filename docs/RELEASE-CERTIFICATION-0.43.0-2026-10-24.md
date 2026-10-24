# ALBot 0.43.0-candidate – Offline-Release-Zertifizierung (24.10.2026)

- **Implementierung:** W04 PR #448, finaler PR-Head `7eef47fdde697c45a197e5b0d1204db7381cb6ba`, Merge-Commit `3531170d8bd99b39bc7b99d1ef4f9410677b2184`.
- **PR-Abnahme:** GitHub Actions `40091552424`, Linux `verify` und Windows `windows-verification` erfolgreich auf exakt demselben PR-Head; Merge unmittelbar vor Freigabe `mergeable=true`, `mergeable_state=clean`, und unveränderter main-Basisstand geprüft.
- **Geschützter Signierpfad:** ausschließlich `.github/workflows/publish-signed-runtime.yml`, Lauf `40091743604`, erfolgreich; veröffentlichter Signierbranch-Commit `39c678e73165861ac1a837b664096f6a6de32d6b`.
- **Signiertes Manifest:** `albot-release-v1`, Version `0.43.0-candidate`, Sequenz `43`, Runtime `967916` Bytes, SHA-256 `847a53b86d8bd072f586dbddf6b9f00ab695128d38295b9f9267ac9c7a2520c6`. P-256-Verifikation und Bytevergleich im geschützten Workflow erfolgreich. Der Runtime-Git-Blob im Releasebranch und in main ist identisch: `c8f6b13e4db0c607d40469658c18c5dd498acbf0`.
- **Vertrauen:** installierter V2-Loader, ECDSA-P-256-Public-Key, Manifest-/Runtime-URLs, Signiergeheimnis und persönliche `ALBotConfig` unverändert. `bootstrap.contract.json` dokumentiert nur den neuen bestätigten Ist-Zustand.
- **Umfang:** W04 vollständige finale Stapelreserve trotz deaktivierter Teilentnahme; physischer Reserve- und Bankbeleg, Journal-/Dispatch- und explizite Mengenregeln weiterhin nötig.

## Offene Grenzen

W04 ist nur dieses Teilpaket: accountweite, vollständig persistierte mehrstufige Reservestaging-Lifecycle-Recovery über Browser-/Realm-Wechsel bleibt offen. W02/W03, W05/W08, W06/G09, W07/N01/G12, N05/N10, Crypt, Cave und Quest/Loot enthalten weitere Roadmap-Lücken. **W14 wurde nicht im Spiel bestanden**: kein zusammenhängender Ingame-Dauertest mit echten Serverquittungen, Tod/Revive, Browserrotation und unbekannten Antworten liegt für Version 0.43 vor.

Diese Datei dokumentiert Offline-/Signatur-Abnahme, niemals simulierte Live-Bestätigung.
