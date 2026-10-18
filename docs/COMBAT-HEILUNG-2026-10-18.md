# Teamrettung mit verifizierter Heilung und Tränken – 18.10.2026

## Fehlerbild und Ursache

In der im Spiel laufenden signierten Runtime `0.10.9-candidate` verweigerten die Ranger die Teamverteidigung gegen `greenjr`, obwohl der Priest tatsächlich Heilzauber und Tränke nutzte. Die Gefahrenprognose bekam mit großen, getrimmten Status-Heartbeats nicht immer die optionalen `skills`/`capabilities` des Priests und verbuchte dann `healingDps=0`. HP-/MP-Tränke und tatsächlich gemessene Ranger-Skills wurden nicht als konservativer Beitrag berücksichtigt. Der alte Rückzug war wegen unzureichend nachgewiesener Teamüberlebenszeit nicht automatisch falsch.

## Implementiert in `main`-Quellen (`0.10.10-candidate`)

- `src/party/transport.mjs`: kompakte, nicht optional wegkürzbare `combatSupport`-Evidenz: Heal-Bereitschaft, Reichweite, MP-Kosten sowie echte HP-/MP-Trankvorräte und serverbekannte Wiederherstellungswerte; keine erfundenen Wirkungen. Ein ausstehender oder fehlschlagender Cooldown-Aufruf erteilt keine Freigabe.
- `src/combat/threat-capability.mjs`: akzeptiert nur frische, validierte Heal-Bereitschaft. Es wird höchstens ein belegter und gerade verfügbarer Heiltrank mit einem konservativen Abschlag kreditiert. Ein MP-Trank wird nur bei realem MP-Defizit und ohne Konflikt mit dem Heiltrank des angegriffenen Priests berücksichtigt. Beobachtete erfolgreiche Heilschläge werden nicht mit geplanten Zaubern doppelt gezählt.
- Ranger-Schaden: zusätzliche Wirkung gegenüber dem Basismodell wird nur aus **mehreren tatsächlich registrierten Treffern über mindestens 2,5 Sekunden** berücksichtigt und ist auf 20 % begrenzt. Ein bloß bereiter Skill, einzelner Burst oder geplantes `partyheal` gilt nicht als bereits geleistete Wirkung.
- Sicherheitsmarge: nur bei gleichzeitig längeren belegten Schaden- und Heildaten geringfügig angepasst; ohne Evidenz bleibt die ursprüngliche konservative Schwelle.
- `src/combat/farmer.mjs`: Ranger können sich bei akut gefährdetem Priest auf der aktuellen Karte an einem nachweislich außerhalb der Monsterreichweite liegenden Punkt sammeln; der normale Farmmarsch hat dann nicht pauschal Vorrang. Die Annäherung **autorisiert keinen Angriff**, wenn die Gefahrenprognose diesen weiterhin verbietet.

## Offline-Abnahme und Restrisiko

- Neue Tests für gekürzte Team-Heartbeats, fehlende Heal-/Trankbelege, echte Trankwirkung, mehrsekündigen Skill-Schaden, veraltete Heartbeats, gefährliche `greenjr`-Szenarien und sicheres Ranger-Rendezvous.
- Die CI hat im Feature-Branch **1.375/1.375 Tests** erfolgreich ausgeführt; die persönliche `ALBotConfig` blieb bytegenau erhalten und die persönlichen/generischen Build-Dateien wurden synchronisiert.
- Der Vollkatalog-Test behält sein **900-KiB-Softlimit** und das absolute 1-MiB-CODE-Limit. Die ergänzte Terser-Minimierung entfernt unbenutzten bzw. toten Code und ist durch die vollständigen Offline-Tests überprüft.
- Kein neuer Live-Test des Teamkampfs im Spiel: der Effekt auf die konkreten `greenjr`-Kämpfe ist erst nach Veröffentlichung, Neustart und neuem Testlog zu bestätigen. Ein sehr gefährlicher Kampf kann weiterhin berechtigt als `retreat` klassifiziert werden.
- Der installierte Auto-Bootstrap V2 verweist auf das **signierte Manifest im Branch `codex/w00-w01-readonly-disposition-20261018`**; der Merge in `main` allein aktualisiert die im Spiel ausgeführte Version `0.10.9-candidate` **nicht**. Für ein Release gelten der veröffentlichte Signierworkflow, die Geheimhaltung des privaten Schlüssels und der getrennte Release-Gate.
