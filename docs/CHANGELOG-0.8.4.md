# Fortlaufender Betrieb und Merchant-Planung 0.8.4-full

## Neuer Livebefund

Vier Browserlogs vom 8. Oktober 2026 mit Starts 19:02–19:03 UTC. Der Merchant stoppt um 21:05:39 Uhr Berlin wegen einer ungeklärten Empfangsabsicht für shoes +4 von Ranger1. Der Ranger hatte send_item angestoßen, aber in den vorliegenden Logs ist weder Abfluss noch Empfang bestätigt: shoes +4 liegt am Ende weiterhin bei Ranger1 in Slot 19, beim Merchant fehlt es. Ursache der nicht beobachteten Spielwirkung ist aus diesem Log nicht beweisbar; keine erfolgreiche Übergabe behaupten. Zwei Goldübergaben, fünf NPC-Verkäufe, zwei Trankkäufe, eine Bankentnahme und andere Itemübergaben sind bestätigt. Der frühere Gold-/Item-Überschneidungsfehler ist für diese bestätigten Übergaben nicht erneut aufgetreten.

Die automatische Pause beim Empfänger löst bei Ranger1 zusätzlich einen reentranten Cleanup aus. Nach endValue('unknown') war job bereits gelöscht, während poll noch job.offerKey las. Dieser konkrete TypeError ist behoben: abgelaufenen Auftrag zuerst lokal sichern und aus der aktiven Referenz entfernen, danach protokollieren/abgleichen. Der doppelte unknown-Abschluss wird ebenfalls unterdrückt.

## Fehler führen zu Hinweisen

Auf Benutzerauftrag laufen Scheduler bei Runtimefehlern und ungeklärten Wertaktionen weiter. Gleiche Runtimefehler werden höchstens alle 30 Sekunden ausführlich protokolliert, Wiederaufnahme nach drei Sekunden; unvollständig ausgewählte Tickabsichten werden verworfen. Unklare Item-/Gold-/Bankwirkungen behalten ihre persistenten Journale und sperren Wertaktionen. Sie werden weder automatisch gelöscht noch blind erneut versendet. Neustart mit offenem Journal ist als eingeschränkter Betrieb möglich; runtime.warning erklärt Sperre und Fortsetzung. pauseOnUnknown bleibt ein Legacy-Profilfeld, löst aber keine automatische Pause mehr aus; persönliches Profil false. Nutzer-STOP/PAUSE, konfigurierte Pause-Regeln und Todesgrenze bleiben verbindlich.

Während einer akzeptierten Itemübergabe hält der Farmer seine normale Bewegung; der Merchant hält bei Annahme. Notwendige Sicherheitsbewegung bleibt möglich. Dies vermindert das Risiko auseinanderlaufender Partner, garantiert aber keine Serverwirkung. logistics.timeout enthält Auftragskennung, Phase und Item. Reale ungeklärte Transfers bleiben prüfpflichtig.

## Vergleich und integrierte Planung

- ALFinal src/merchant.js _claimTarget: gleicher Empfänger weiterbedient, switchCooldownMs, begrenzte serviceHistory und A→B→A-Schutz. Dieses fachliche Prinzip ist in die bestehende ALBot-Runtime übernommen, keine zweite Merchant-Runtime.
- v3 src/merchant/merchant-task-coordinator.js: exklusiver Auftrag mit Identität, Lease, Fortsetzung und Ablauf. merchant-service-planner.js prüft positionsfrische Berichte und trennt Nachschub, Abholung und Reisen. ALBot behält die Ressourcen-/Bestandsprüfungen und stabilisiert Auftragsidentitäten über Item/Level/Regel statt Inventarslot.
- v4 laufzeit/quelle/vertraege/ressourcen-sperre.ts trennt Bewegung, Inventar, Bank, Handel und Ausrüstung mit Besitzer und Unterbrechbarkeit. Diese Trennung bleibt über den bestehenden Executor erhalten; ein Laufzeitfehler hebt keine Wertreservierung auf. Im gesichteten v4-Ressourcenvertrag gibt es keine eigenständige ALFinal-artige Service-Historie.

ALBot bindet jetzt Item-, Gold- und Mluck-Service an denselben Empfänger. taskHoldMs (persönlich 30 Sekunden) bestimmt normale Bindung; schnelle Rückwechsel im doppelten Zeitfenster werden begrenzt. Dringender benötigter Tranknachschub bei niedrigen HP/MP kann wechseln. merchant.servicePlan/merchant.switchBlocked protokollieren Ziel und Grund; beim Stop wird nur der temporäre Serviceplan beendet, kein Wertjournal gelöscht.

Nicht ausführbare Aufträge werden 30 Sekunden zurückgestellt (merchant.deferred), andere Aufgaben bleiben auswählbar. Eine vorhandene passende Produktionsabsicht bleibt während taskHoldMs bevorzugt, sofern noch Bedarf besteht und keine Warte-/Fehlerbedingung vorliegt. Lokale Bank-/Verkaufsaktionen werden gebündelt, kritischer Arbeitsraum und lange wartende Aufgaben können vorgehen. Laufende Economyreisen werden bis Ankunft/Bewegungsfehler respektiert. Dies ist eine begrenzte integrierte Planung, kein Nachweis optimaler globaler Reiserouten.

## Bestände und Validierung

Verkaufsgrenze 1.000.000, Mindestchance 65 %, Bank-Teilentnahme und Autostart bleiben erhalten. Budget und Schutzregeln unverändert. Alte Journale von Merchant und Ranger1 werden nicht automatisch bestätigt. Nach Abgleich aktueller Schuhbestände beide pausieren, ALBot.acknowledgeInventory() und anschließend ALBot.start() ausführen. Bei abweichenden Beständen erst neue Logs prüfen. Der fortlaufende Betrieb ersetzt diesen Bestandsabgleich nicht.

173 Logik-/Integrationsprüfungen unter Windows bestanden, inklusive reentrantem Transfer-Timeout, Runtimefehler ohne STOP, Start mit geschütztem Journal, Servicebindung, Rückwechselschutz, dringendem Nachschub, Auftragsabkühlung und Ortsbündelung. Bundle/Werkstatt und Syntax geprüft. Keine Shadow-Tests, automatischen Logins oder Spielaktionen. Neue gemeinsame Livebestätigung, insbesondere reale Schuheübergabe, und Linux-Livebetrieb stehen aus.
