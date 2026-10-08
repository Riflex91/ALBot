# 0.6.1-full · Reparatur des ersten Vollbetriebs-Laufs

Vier Browserberichte vom 8. Oktober 2026 (17:44–17:46 Uhr Deutschland) ausgewertet. Ranger1/Ranger3: use_skill(monsterhunt) → no_skill → falsche Inventarsperre. Korrekt interact(monsterhunt), eigener Queststatusabgleich ohne Inventarjournal, zusammenhängende Leaderreise und Wiederaufnahme nach bestätigter Antwort. Bekannte alte Fehlaufruf-Journale ohne Slots/Kosten werden gezielt entfernt; echte unbekannte Wertaktionen bleiben gesperrt. Follower starten keine konkurrierende Questreise. Eigene Aggro unterbricht die Anreise zugunsten von Kampf/Erholung.

Merchant: der erste Trankhändler pots hat keinen Kartenstandort. Die Suche überspringt Händler ohne Position und bevorzugt erreichbare Standorte auf der aktuellen Karte. hpot0/mpot0-Nachkauf kann dadurch fancypots verwenden.

Browserlogs prüfen die Ordnerfunktion in Spiel- und CODE-Fenster. Bei fehlender Funktion ist die Ordner-Schaltfläche deaktiviert; benannter JSON-Download und Browser-Speicherorte werden direkt erklärt. Keine Zusage automatischer Desktopausgabe ohne Browserunterstützung/Ordnerfreigabe. Headlessausgabe bleibt unverändert. ALBot.logCapabilities() meldet mode und directory.

100 gezielte Bot-/Werkstatt-Prüfungen bestanden, Größenprüfung einschließlich 1276 Itemregeln. Kein Shadow-Test und kein Login. Erneute Livebestätigung steht aus.

Follower erhalten den Questbesitz per Teamstatus, brechen konkurrierende Combat-/Farmwege ab und begleiten den Leader. Bei pausiertem Leader stoppen alte Folge-/Kampfwege.
