# ALBot 0.17.0 – Zertifizierung und offene Liveabnahme (20.10.2026)

Die Sicherheitskorrekturen für den My_Ranger1-Todesfall wurden mit [PR #280](https://github.com/Riflex91/ALBot/pull/280) in `main` gemergt. Die Runtime wurde als `0.17.0-candidate` / Sequence 17 über [GitHub Actions Run #39452100947](https://github.com/Riflex91/ALBot/actions/runs/39452100947) veröffentlicht.

- Vor Multi-Pulls werden kumulierte Gegnerangriffe, Team-DPS und konservativer HP-Verlust abgeschätzt.
- Multi-Pulls werden bei fehlenden/frischen oder außerhalb der Heilerreichweite befindlichen Priests verhindert.
- Negative Überlebensprognosen sperren neue Pulls; Fehlschläge werden zeitweise quarantänisiert.
- Engagierte Gefahrenziele erhalten eine priorisierte Notfall-Zielauswahl.
- Lokale Gefahrenplanung ergänzt native `smart_move`-Navigation, ohne Welt-NavMesh oder Loader auszutauschen.
- Heal-Hit-Events und beobachtete HP-Deltas werden getrennt protokolliert; ein bloßes Skill-Return gilt nicht als Heilwirkung.

**Offlinestatus:** 1.982/1.982 Release-Tests bestanden. Linux- und Windows-CI für PR #280 erfolgreich. Runtime byteidentisch mit `main/dist/albot.runtime.js`. Größe: `828439` Bytes, SHA-256: `d93a7b43e36d9631fafe5fe26821e9d4f79b7e18682123597d9be40a5d49e396`. ECDSA-P-256-Signatur erfolgreich validiert.

**Wichtig:** Der signierte Loader und die persönliche `ALBotConfig` wurden nicht verändert. Es wurde keine Ingame-Liveabnahme durchgeführt. Erst ein beobachteter Test mit My_Ranger1, My_Ranger2 und My_Priest kann die tatsächliche Wirkung unter Spiel-Latenz und echten Gegnerpositionen bestätigen.
