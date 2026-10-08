# 0.6.2-full · Kampfrisiko und zusammenhängende Merchant-Reisen

Die vier Browserlogs vom 8. Oktober 2026 ab 18:04 Uhr Deutschland zeigen mindestens acht Todesfälle, Monsterhunt gegen Prat, Warten unter Beschuss und wechselnde HP-/MP-Einkaufsreisen. Keine gemeldeten Laufzeitincidents bedeutet hier keinen erfolgreichen Test.

Vollbetrieb bewertet bekannte Gegner-HP, Angriff, Frequenz, konservativ geschätzte Verteidigung, aktuell kampfbereite Farmer und die konfigurierte Aggrogrenze. Merchant und entfernte/tote/fehlende Farmer gelten nicht als Kampfstärke. Unbekannte Werte werden nicht freigegeben. Dieselbe Prüfung gilt für Quests, Events, Bosse, Farm-/Materialziele und sichtbare Gegner. Prat wird mit den beobachteten Rangerwerten abgelehnt; Goo/Bee bleiben möglich. Die Schätzung garantiert keinen Sieg und rechnet unbekannte Heilung/Kiting/Crits nicht als sicheren Vorteil an.

Tod oder gefährlicher Angriff sperrt das Ziel für farming.deathWindowMs (standardmäßig zehn Minuten), namengebunden und maximal 32 Ziele. Die Sperre übersteht Pause und Reload. strategy.failedTarget und strategy.riskRejected enthalten den Grund und die Risikowerte. Wertjournale werden nicht gelöscht.

Gruppenwarten und Questbegleitung unter Beschuss weichen aus. Nicht kampfbereite Gruppen starten keine neue gemeinsame Aktivitätsreise. Erholung und Merchant-Rückzug blockieren neue Economy-/Abholreisen. Händler reisen nicht zu bedrohten, schwer verletzten oder in gefährlichen Aggro-Spawns befindlichen Farmern. Bereits laufende Abholwege werden bei gefährlichem/verlorenem Peer neu geprüft. NPC-Reisen bleiben bis zur Ankunft oder den vorhandenen Wegtimeouts zusammenhängend; Wartealter anderer Aufträge bricht den Weg nicht mehr alle zwei Sekunden ab. Notwendige sichere Logistik darf weiterhin Vorrang erhalten.

109 gezielte Prüfungen inklusive neun neuer Fehlerregressionen bestanden. Kein Shadow-Test, kein Login. Erneute Browser-/Headless-Livebestätigung ausstehend. Profil und Autostart bleiben erhalten.
