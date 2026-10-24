# ALBot 0.45.0-candidate – Zertifizierungsbericht (24.10.2026)

**Abnahmeart:** offline geprüft, kryptografisch signiert – keine W14-Ingame-Liveabnahme.

## Nachweiskette
- Funktion: W03/W04 dauerhafte Bankreserve-Folgenquittung über Browser/CODE-Neustart, unter Erhalt der vollständigen Einzel-/Teilbank-Wertjournale, physisch bestätigter Quellen und gesperrter unbestätigter APIs.
- Funktions-PR [#455](https://github.com/Riflex91/ALBot/pull/455), exakter finaler Head `2b1f759c10d3372f1a91a67611bb2780a61de15b`, Hauptbranch-Merge `e2ba873f109362d846f369df561ced77714196a1`.
- Vollständige Linux- und Windows-Prüfung erfolgreich: [Actions 40093465914](https://github.com/Riflex91/ALBot/actions/runs/40093465914). Vor Merge: `mergeable=true`, `mergeable_state=clean`, Hauptbranch entsprach der geprüften PR-Basis.
- Geschützter bestehender Signierworkflow [Actions 40093598213](https://github.com/Riflex91/ALBot/actions/runs/40093598213) erfolgreich. Signierter Branch-Commit: `000083056eab5888e1384a8cf79590db695d7e2c`.
- Signierte Version **0.45.0-candidate / Sequence 45**, **974040 Bytes**, SHA-256 `2f3771c5c4770abbdbd1363580219c68ac7d038beede6e93d0f19ba1509bd4d2`, ECDSA-P-256-Signaturprüfung im Workflow erfolgreich.
- Veröffentlichte signierte Runtime und getestete main-Runtime teilen denselben Git-Blob `0e1fe85998ba76c9450424fc68e2face1562cbd1`. Persönliche ALBotConfig, bestehender V2-Bootstrap, öffentliche Vertrauenswurzel und Release-URLs unverändert.

## Begrenzung
Der Folgecursor gibt weder eigenständig eine neue Bankoperation noch eine irreversible Veräußerung frei. Nach ungeklärtem physischen/Serverergebnis bleibt die Folge gesperrt, anstatt einen Wert-Dispatch erneut zu probieren. Die vollständige kontoweite Ressourcenreservierung und dauerhafter Adventure-Land-Liveabnahmetest W14 sind nicht abgeschlossen.
