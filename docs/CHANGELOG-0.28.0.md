# 0.28.0-candidate — Farmer-first Merchant-Gear (21.10.2026)

## Auslöser (Live-Log, bisheriges 0.26.0-candidate)
Der Merchant kombinierte ein `skullamulet +2` für My_Ranger1, erzeugte danach
eine eigene Regel `Optimiertes Gear My_Merchant amulet / equip / skullamulet`
und bestätigte `gear.equip`, während My_Ranger1 und My_Ranger2 ein
`skullamulet +2` als Gear-Upgrade angefordert hatten. Kombinieren und Equip
waren separate Operationen. Das identifiziert die fehlende Prioritätsprüfung,
nicht eine automatische Equip-Wirkung der Compound-API.

## Korrektur
- `merchantSelfEquipDecision` bewertet die **physisch vorhandene** Variante
  anhand frischer, vollständiger, sessions-/realmgebundener Gear-Profile aller
  aktuell ausgewählten Farmer, Kompatibilität, echter `item_properties`,
  rollenspezifischem Gear-Score, Suitability und Mindestverbesserung.
- Jeder noch mögliche Farmer-Upgrade-Bedarf verbietet Merchant-Eigen-Equip.
  Unbekannte/veraltete Profile und fehlerhafte Stats verbieten die Aktion
  ebenfalls; sie sind kein Beweis für fehlenden Bedarf. Bereits erfüllte
  Farmer-Slots und nachgewiesen inkompatible Items blockieren nicht.
- Automatische Merchant-`equip`-Regeln aus optimierten und konfigurierten
  Gear-Zielen werden ohne diese Prüfung nicht erzeugt.
- `gear.equip` prüft erneut bei Auswahl **und** im Executor-Dispatch-Guard;
  zusätzlich wird das konkrete Item im Inventarslot durch Identität gebunden.
  Eine nachträglich auftretende Farmer-Anforderung verhindert einen bereits
  eingeplanten Eigenequip.
- Keine Veränderung an Scroll-/Compound-Quoten, Gear-Lieferjournalen,
  eigenständiger Nutzerkonfiguration, V2-Ladepfad, Schlüsseln oder URL.

## Offline-Abnahme
Fünf gezielte Node-Regressionen:
1. Farmer-Upgrades gehen Merchant-Luck vor.
2. Zwei Farmer bleiben getrennte mögliche Empfänger.
3. Ungültige/stale Profile veranlassen konservative Ablehnung.
4. Nachweislich inkompatibles Gear darf der Merchant verwenden.
5. Sowohl Auswahl als auch verzögerter Dispatch kontrollieren neu.

Neue signierte Runtime ausschließlich nach grüner Linux-/Windows-CI,
konfliktfreiem Main-Merge, Release-Workflow und gültiger
ECDSA-P-256-/SHA-256-/Bytezahlprüfung. Spiel-Liveabnahme bleibt offen.

## Zertifizierte Veröffentlichung (21.10.2026)

**Aktuell signiert und kryptografisch verifiziert: `0.28.0-candidate`, Sequence 28 (21.10.2026).** [Farmer-first-Gear-Fix PR #378](https://github.com/Riflex91/ALBot/pull/378) nach [grüner Linux-/Windows-CI 39649989650](https://github.com/Riflex91/ALBot/actions/runs/39649989650) in Main (`275094333880f74595c0007d847f1465a51bb720`). [Signierworkflow 39650511597](https://github.com/Riflex91/ALBot/actions/runs/39650511597): 2.325/2.325 Offline-Tests, ECDSA-P-256 gültig, 926463 Runtime-Bytes, SHA-256 `1367b966f64faefb8556567db32656b749e2d98adbc943e80f0579012f851261`. Veröffentlichte Runtime byteidentisch mit Main; V2-Loader, Public Key, URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme offen.** Ältere Freigabeangaben darunter sind historisch.

