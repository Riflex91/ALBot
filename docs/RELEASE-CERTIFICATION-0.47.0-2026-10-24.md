# ALBot 0.47.0-candidate – Signierte Offline-Zertifizierung (24.10.2026)

**Abnahmeart:** Offline-CI + kryptografische Releaseprüfung. Kein W14-Ingame-Dauertest.

## Nachweise

- Implementierung: W02/W04 physisch frei verfügbare statt durch andere Bindungen bereits belegter Betriebsvorräte; Bankstaging und Bankreserve-Neustart-Recovery verwenden konsistent die freie Menge, während native Einzelbankjournale den vollständigen physisch beobachteten Bruttobestand protokollieren.
- Entwicklungs-PR [#459](https://github.com/Riflex91/ALBot/pull/459), exakt finaler Head `ab73f951e73e9e66cd6419dcceb98db2c4ad1ae8`, Merge-Commit `bfbceb6aca0806880f54e8ec174846b8699341c4`.
- Vollständige Linux- und Windows-CI auf diesem Head erfolgreich, [Actions #40096988180](https://github.com/Riflex91/ALBot/actions/runs/40096988180); vor Merge `mergeable=true`, `mergeable_state=clean`, main exakt der PR-Basisstand.
- Zwischenversion `0.46.0-candidate` / Sequence 46 wurde zunächst auf dem zuvor geprüften und gemergten PR #457 signiert: [Signierworkflow #40097235491](https://github.com/Riflex91/ALBot/actions/runs/40097235491). Ohne diese echte Sequenz wurde keine spätere Version signiert.
- `0.47.0-candidate` / Sequence **47** ausschließlich mit geschütztem [Signierworkflow #40097339649](https://github.com/Riflex91/ALBot/actions/runs/40097339649) veröffentlicht und verifiziert. Release-Commit `87491ad0685c6768edc0ba9c22a6a6321020b1d8`.
- Runtime **984395 Bytes**, SHA-256 `003ee8e03b429e4405fa3de497084cec19cff534eeab23117d43ecd04daae3bb`, gültige ECDSA-P-256-Manifestprüfung im geschützten Workflow; Release- und main-Runtime mit identischem Git-Blob `1d1e11e27c7de293f055f172e0ce9ad0c41b98b7`.
- Persönliche ALBotConfig, V2-Bootstrap, öffentliche Schlüssel, Signierschlüssel und Release-URLs bleiben unangetastet.

## Offene Grenzen

W02/W03/W04 sind nicht vollständig: echte kontoweite Mehr-Charakter-Bestandsreservierung, beidseitig bestätigte Lieferungen und echte Ingame-Wiederaufnahme ungeklärter Serverantworten bleiben offen. Der hier dokumentierte Offline-Test ist keine echte W14-Liveabnahme.
