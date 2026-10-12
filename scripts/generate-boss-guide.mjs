import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {bossProfile} from '../src/combat/bosses.mjs';
// Offline documentation generator, never part of the game bundle.
const file=process.argv[2];if(!file)throw Error('Provide official design/monsters.js source');
const scope={};runInNewContext(await readFile(file,'utf8'),scope,{timeout:2000});
const G={monsters:scope.monsters};if(!G.monsters)throw Error('No monster definitions');
const rows=Object.keys(G.monsters).map(id=>bossProfile(G,id)).filter(Boolean);
const header=`# Bosskatalog und Vorgehen

Generiert aus den offiziellen Monsterdefinitionen und den tatsächlich implementierten Mechanik-Adaptern. Referenz: [Adventure Land monsters.js](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/design/monsters.js). Laufzeitdaten G sind maßgeblich; \`ALBot.bossCatalog()\` zeigt den aktuellen Katalog.

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
`;
const lines=rows.map(r=>`| ${r.id} | ${G.monsters[r.id].hp} | ${r.mode} | ${r.recommended.join(' + ')} | ${r.supported?'Bereitschaftsprüfung aktiv':r.unsupported.join(', ')} |`);
await writeFile(new URL('../docs/BOSS-KATALOG.md',import.meta.url),header+lines.join('\n')+'\n');
console.log(JSON.stringify({profiles:rows.length,supported:rows.filter(r=>r.supported).length}));
