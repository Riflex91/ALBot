# W12/N12 – Dedizierte Cave-Priest-Einzelheilung mit frischer Team-Triage

Stand: 20.10.2026.

## Serververtrag

Adventure Land am fixierten Quellstand `kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`, `js/runner_functions.js`:

- `heal(target)` sendet einen Einzelheilungs-Aufruf gegen den angegebenen Charakter;
- `can_heal(target)` weist Monster zurück und verwendet die native `can_attack`-Prüfung (Reichweite, Deaktivierung, gemeinsamer Attack-/Heal-Cooldown);
- `is_on_cooldown('heal')` berücksichtigt den Skill-Share. Die N12-Implementierung prüft diese beiden nativen Belege erneut, statt einen Schaden oder einen erfolgreichen Heal aus einer Promise-Rückgabe zu erfinden.

## Umsetzung

- Die bestehende `caveTeamCoordination` bietet jetzt zusätzlich `healStatus()`. Sie verlangt dieselben frischen und exakt instanzgebundenen Team-, Priest-, Position-, Realm-, Originalroster- und Runbelege wie die Ranger-Verteidigung. Nur für **Heilbereitschaft** dürfen tatsächlich verletzte, aber noch lebende Mitglieder unter 70 % HP liegen (`minHealthRatio:.01`). Die bisherige **70-%-Angriffsschwelle bleibt für Ranger unverändert**. Abwesende, tote, fremde, zu weit entfernte oder veraltete Teammitglieder blockieren.
- Eigenes `src/world/cave-priest-healing.mjs`: ein aktiver und nicht handlungsblockierter Priest in einer bestätigten, nicht pausierten Cave-Instanz wählt ausschließlich unter den drei konfigurieren Teammitgliedern einen tatsächlich sichtbaren Charakter mit höchstens 80 % HP. Eine aktuelle, höchstens drei Sekunden alte Team-Herzschlaginformation für die anderen Mitglieder, passender Floor und Realm, Sichtbarkeit und aktuelle maximale Heildistanz 140 sind erforderlich.
- Die Priorität richtet sich zuerst nach **niedrigstem aktuellem HP-Anteil**, dann absolut fehlender HP und eindeutigem Namen. Fehlende MP-Kostenbelege, zu geringe MP mit 10-%-Reserve, native `can_heal`-Ablehnung oder Cooldown sowie Wirtschaft-/Account-/Instanzsperren verhindern die Aktion.
- `Executor.run('cave.priest.heal',['attack','mana'])` begrenzt die Aktion. Guard und unmittelbar nachgelagerter Netzwerk-Invoke prüfen die **gesamte Team-/Run-/Floor-/Heilziel-Bindung erneut** und verwenden das frisch aufgelöste identische Zielobjekt. Ein vor Ausführung verschwundenes, voll geheiltes, falsch instanziiertes oder inzwischen nicht mehr sichtbares Ziel erhält keinen Heilaufruf.
- Ein erfolgreicher Promise-Rücklauf bestätigt **noch keine HP-Heilung**: Die Executor-Aktion wartet auf einen passenden aktuellen HP-Anstieg; die Anzahl angenommener Aufträge ist nur Telemetrie, keine Game-Kill- oder Heal-Quittung.
- `farmer.tick()` behält die bestehende Overworld-Isolation auf Cave-Maps bei. In ihrer Cave-Verzweigung hat die neue dedizierte Einzelheilung Vorrang vor dem bereits abgesicherten defensiven Ranger-Basisangriff. Normale Skillrotationen, AoE, neutrales Farming, neue Spawnwege und normale Follow-Routen bleiben während der Cave-Verzweigung deaktiviert.
- `ALBot.status().cavePriest` diagnostiziert Ziel, Sperrgrund und Zahl angenommener Heilungsaufträge ohne Veröffentlichung mutierbarer Spielobjekte.

## Grenzen und Nachweise

Neue Offline-Regressionen in `test/roadmap-n12-cave-priest-healing.test.mjs` umfassen den ursprünglich unvereinbaren 70-%-Kampf-/Heilbereitschaftsfall, native Heal-Capability, Heilmana, Selbstheilung, Gruppen-/Floor-/Realm-/Priest-Abstand, bei gestaffeltem Executor veraltete Ziele und zuletzt fehlende Sichtbarkeit unmittelbar vor dem Spiel-API-Aufruf sowie einen integrierten Farmer-Cave-Tick ohne gewöhnliche Skill-/Bewegungsaktionen.

**Offen:** echte Ingame-Livetests, nachweisbare serverseitige HP-Heilbestätigungen, Cave-Heal-Kollisionen zwischen mehreren Heilerklassen, gefahrarme Instanznavigation, Mehrgegner-Combat, Ressourcenökonomie, Loot und Crypt-/Cave-Expeditionscontroller. Der getrennte signierte Ingame-Release und persönliche Einstellungen bleiben unverändert.
