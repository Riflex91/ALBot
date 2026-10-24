# ALBot 0.54.0-candidate – geschützte Offline-Zertifizierung (24.10.2026)

## Nachweiskette
- W02/W10 Entwicklungs-PR [#482](https://github.com/Riflex91/ALBot/pull/482): physische Ausrüstungsbestandsaufnahme mit vollständigen Variantenattributen einschließlich acc/rid/data, belegte statt rohe Slots, vollständiges Fail-Closed bei unlesbaren oder überzähligen Slots.
- Finaler PR-Head `eac1c9201c8638ee0fd776001907dd14cb40f854`, vollständige [Linux-/Windows-CI #40116875248](https://github.com/Riflex91/ALBot/actions/runs/40116875248) erfolgreich, `mergeable=true`/`clean` und gleichbleibende Hauptbranchbasis `28c481e4c42d040fc7ad689a3d82cfa38e7df31f`.
- Bestätigter PR-Merge `dbaf8fcebc58a5b9a83deb6ab67cc23bd939b703`. Parallel integrierter Farmweg-/Zubehör-Fix #479 und deterministische Signaturtests #481 erhalten.
- Bestehender geschützter [P-256-Signierworkflow #40117020642](https://github.com/Riflex91/ALBot/actions/runs/40117020642) erfolgreich. Signierter Release-Commit `cbcb18a7f8b9c67da3ca73c9c24ab8c2410925bc`.
- Signierte Version **0.54.0-candidate / Sequence 54**. Runtime **1.005.098 Bytes**; SHA-256 `69977528620eeb209edbbb0e25fee1bcaa5167e060469ee4352faed942a2a747`. Veröffentlichungssignatur ECDSA-P-256 geprüft. Signierter Release- und `main`-Runtime-Git-Blob identisch: `b651f52a5c52683d450922c63bde40d5b050bef6`.
- Persönliche ALBotConfig, V2-Loader, Vertrauensschlüssel und Release-URLs unverändert.

## Ausstehende Grenzen

Das Account-Ledger und seine physische Gear-Sicht bleiben read-only, `shadow-only`, ohne Sale-, Send-, Retrieve- oder Equip-Berechtigung. Vollständige accountweite Bank-Map-Quittungen, echte serverbestätigte Handelsoperationen, sichere automatische Config-Sync-Übernahme samt Charakter-ACK und W14-Ingame-Dauertest sind nicht abgenommen.
