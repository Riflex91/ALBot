# Bosskatalog und Vorgehen

Generiert aus den offiziellen Monsterdefinitionen und den tatsächlich implementierten Mechanik-Adaptern. Referenz: [Adventure Land monsters.js](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/design/monsters.js). Laufzeitdaten G sind maßgeblich; `ALBot.bossCatalog()` zeigt den aktuellen Katalog.

**Unterstützt bedeutet: der Mechanik-Adapter kann die Bereitschaft bewerten, nicht: die Gruppe kann diesen Gegner besiegen.** Unmodellierte Mechaniken bleiben gesperrt. Der Bot vergleicht Schaden, Trefferfrequenz, Vermeidung, Burst, Adds, Heilung, HP/MP und maximale Kampfzeit. Positive Heilreserve stammt aus beobachteten Heilereignissen. Ohne diesen Nachweis muss der Kampf vollständig in das HP-Budget passen.

## Ablauf

1. Boss/Event explizit in der Werkstatt erlauben. Instanzzugänge und Kartenfreigaben müssen vorhanden sein; unbekannte Portale werden nicht blind betreten.
2. Frische, lebende Gruppe im selben Realm zusammenbringen. Richtwert: Warrior/Paladin als Tank, Priest als Heiler, Mage/Ranger als Schaden. Bei 1-HP-Gegnern zählt wirksame Trefferfrequenz; Priest plus zwei Ranger ist eine Kandidatenkombination, keine universelle Optimalitätsbehauptung.
3. Vor Pull mindestens 80 % HP und 50 % MP je Mitglied, bestätigte Rollen und ein Schaden-/Zeitbudget innerhalb der Vorgabe. Rotation und Skills benutzen die vorhandenen Waffen-, Reagenzien- und Mana-Prüfungen.
4. Während fullguard/fullguardx keine Angriffe. Auf beobachteten Ablauf der Schutzphase warten. Keine blind angenommene Ablaufzeit aus der Grunddefinition.
5. Einen Hauptgegner gemeinsam bekämpfen. Der Tank kann über die bestehende Skilllogik taunten. Bereits angreifende, bekannte Adds werden als zusätzliche Ziele zugelassen, sofern ihre eigene Risikoprüfung besteht. Kein unkontrollierter Flächenschaden auf weitere Monster.
6. Bei Teamverlust, HP-/MP-Mangel, neuer Mechanik, zu vielen Adds oder unzureichendem Schaden abbrechen. Bestehende Flucht-, Kiting-, Heal- und Recovery-Module bleiben zuständig.

## Mechaniken

- **Reflexion:** Nur physische Angreifer erhalten Angriffsfreigabe. Mage/Priest-Schaden wird nicht zum nötigen DPS gerechnet; der Priest kann weiter heilen.
- **Frozen:** Die Serverlogik reduziert Frequenz auf 30 %. DPS/HPS werden entsprechend konservativ reduziert, statt Frost nur als kosmetischen Effekt zu behandeln.
- **Burn:** Fireball kann fünf Sekunden Brandschaden und bei Wiederholung höhere Intensität verursachen. Das Heilbudget reserviert zusätzlich zum Einschlag konservativ den akkumulierten DoT; Rüstung oder Resistenzen werden dafür nicht als sichere Entlastung vorausgesetzt.
- **Rime Djinn:** Vor Pull und in der Shell wird geprüft, ob verbleibender Schildschaden im Zeitfenster mit 50 % Reserve möglich ist. In BREAK_SHELL kann ein Warrior mit bereits ausgerüstetem Basher über den geprüften Stomp-Pfad unterbrechen. Kein blindes Waffenwechseln oder erfundener Dispel.
- **Vampire:** rbuff/mlifesteal ist eine Spielerbelohnung nach dem Sieg. Tatsächlich am Gegner vorhandener Lifesteal wird dagegen als zusätzliche Heilung abgezogen.
- **Teleportierende Bosse:** Nur beobachtete aktuelle Positionen und bereits erlaubte Reiserouten verwenden. Nach Ortswechsel Teamnähe erneut prüfen.

Die Tabelle umfasst die expliziten Bosse und special/cooperative/boss-markierten Definitionen der Referenz. Sie ist keine Zusage, dass beliebige Instanzen, künftige Events oder alle gewöhnlichen Monster mit Sondermechaniken unterstützt sind. Solche Gegner müssen eine eigene bestehende Risikoprüfung bestehen; neue Bossmechaniken werden abgewiesen.

## Profile

| Gegner | HP der Referenz | Modus | Kandidatengruppe | Adapter / Grund der Sperre |
|---|---:|---|---|---|
| cutebee | 300 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| crabx | 4200 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| crabxx | 960000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| rharpy | 320000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| fvampire | 240000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| mvampire | 240000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| phoenix | 160000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| bgoo | 100000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| rgoo | 1000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| skeletor | 80000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| stompy | 640000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| mrgreen | 36000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| slenderman | 66666 | damage | warrior + priest + ranger | Bereitschaftsprüfung aktiv |
| mrpumpkin | 36000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| greenjr | 4200 | damage | warrior + priest + ranger | Bereitschaftsprüfung aktiv |
| jr | 3200 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| icegolem | 16000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| grinch | 24000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| goldenbat | 24000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| tinyp | 5600 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| tiger | 12000 | damage | warrior + priest + ranger | Bereitschaftsprüfung aktiv |
| goblin | 50 | damage | warrior + priest + ranger | Bereitschaftsprüfung aktiv |
| pinkgoo | 40 | hits | priest + ranger + ranger | Bereitschaftsprüfung aktiv |
| snowman | 1200 | hits | priest + ranger + ranger | Bereitschaftsprüfung aktiv |
| dragold | 25600000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| wabbit | 32000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| franky | 120000000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
| rimedjinn | 640000 | damage | warrior + priest + mage | Bereitschaftsprüfung aktiv |
