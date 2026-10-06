// This data contract is shared by the editor and the future bot runtime.
const text = (title, value = '', extra = {}) => ({type:'string',title,default:value,maxLength:160,...extra});
const num = (title, value, min=0, max=1e12) => ({type:'number',title,default:value,minimum:min,maximum:max});
const int = (title,value,min=0,max=1e12) => ({...num(title,value,min,max),type:'integer'});
const flag = (title,value=false) => ({type:'boolean',title,default:value});
const choice = (title,values,value=Object.keys(values)[0]) => ({...text(title,value),enum:Object.keys(values),'x-labels':values});
const obj = (title,properties,description='') => ({type:'object',title,description,properties,required:Object.keys(properties),additionalProperties:false});
const list = (title,items,description='') => ({type:'array',title,description,items,default:[],maxItems:500});
const ids = (title,catalog='') => list(title,text('ID','',{'x-catalog':catalog,minLength:1}));
const classes={auto:'Automatisch',warrior:'Warrior',ranger:'Ranger',mage:'Mage',priest:'Priest',rogue:'Rogue',paladin:'Paladin',merchant:'Merchant'};
const roles={all:'Alle Rollen',farmer:'Farmer',merchant:'Merchant'};
const actions={keep:'Behalten / schützen',consume:'Verbrauchen',equip:'Ausrüsten',send:'An Charakter liefern',bank:'Bank einlagern',retrieve:'Bank entnehmen',sell:'NPC-Verkauf',buy:'NPC-Kauf',list:'Markt anbieten',wishlist:'Kaufgesuch',marketBuy:'Markt kaufen',upgrade:'Upgrade',compound:'Compound',exchange:'Exchange',craft:'Craft',farm:'Gezielt farmen'};
export const ACTIONS = actions;
export const ITEM_RULE = obj('Item-Regel',{
  name:text('Regelname','Neue Regel',{minLength:1}),enabled:flag('Aktiv',true),priority:int('Priorität (höher gewinnt)',0,-10000,10000),
  item:text('Item-ID','hpot1',{'x-catalog':'items',minLength:1}),role:choice('Rolle',roles),character:text('Nur Charakter (leer = alle)','',{'x-catalog':'characters'}),
  minLevel:int('Ab Item-Level',0,0,99),maxLevel:int('Bis Item-Level',99,0,99),statType:text('Stat-Typ (leer = alle)'),property:text('Eigenschaft p (leer = alle)'),title:text('Item-Titel (leer = alle)'),
  map:text('Nur Karte (leer = alle)'),server:text('Nur Realm, z. B. EUII (leer = alle)'),task:text('Nur Aktivität (leer = alle)'),
  action:choice('Aktion',actions),keep:int('Mindestbestand behalten',0),targetCount:int('Zielbestand',100),requestBelow:int('Nachschub anfordern bei Bestand ≤ (0 = unter Zielbestand)',0),maxCount:int('Maximalbestand',1000),batch:int('Maximale Menge je Aktion',100,1),
  recipient:text('Lieferempfänger','',{'x-catalog':'characters'}),teamReserve:int('Zusätzliche Teamreserve',0),
  minPrice:int('Mindestverkaufspreis pro Stück',1,1),maxPrice:int('Maximaler Kaufpreis pro Stück',1000,1),priceSource:choice('Preisquelle',{fixed:'Fester Grenzpreis',market:'Aktuelle Marktbeobachtung',npc:'NPC-Preis'}),
  goldBudget:int('Goldbudget je Auftrag',10000),lossBudget:int('Maximaler möglicher Itemverlust in Gold',0),
  targetLevel:int('Ziellevel bei Verarbeitung',1,0,99),scroll:text('Scroll-ID (leer = nach Grade)','',{'x-catalog':'items'}),offering:text('Offering-ID (leer = keines)','',{'x-catalog':'items'}),minChance:num('Mindest-Erfolgschance (0–1)',1,0,1),
  recipe:text('Rezept / Exchange-Ziel'),pack:text('Bankfach (leer = automatisch)'),slot:text('Equipment-/Stand-Slot (falls erforderlich)'),
  fallback:choice('Wenn Aktion nicht möglich',{hold:'Behalten und warten',notify:'Behalten und Hinweis',bank:'Bankauftrag erstellen'}),ttlMs:int('Auftrag gültig (ms)',120000,1000,86400000)
});
ITEM_RULE.required=ITEM_RULE.required.filter(k=>k!=='requestBelow');
const condition=obj('Bedingung',{field:choice('Messwert',{hpRatio:'Eigener HP-Anteil',targetHpRatio:'Ziel-HP-Anteil',mpRatio:'MP-Anteil',freeSlots:'Freie Slots',gold:'Gold',enemyCount:'Gegner in Reichweite',itemCount:'Item-Menge',map:'Karte',rip:'Tot',task:'Aktivität'}),operator:choice('Vergleich',{lt:'Kleiner',lte:'Kleiner/gleich',eq:'Gleich',neq:'Ungleich',gte:'Größer/gleich',gt:'Größer'}),value:text('Vergleichswert','0.5',{minLength:1}),item:text('Item-ID für Item-Menge','',{'x-catalog':'items'})});
const skill=obj('Skill-Regel',{name:text('Name','Neue Skill-Regel',{minLength:1}),enabled:flag('Aktiv',true),skill:text('Skill-ID','',{minLength:1}),class:choice('Klasse',classes),character:text('Nur Charakter','',{'x-catalog':'characters'}),priority:int('Priorität',0,-10000,10000),target:choice('Ziel',{enemy:'Aktueller Gegner',self:'Eigener Charakter',lowestHp:'Gruppenmitglied mit wenig HP',lowestMp:'Gruppenmitglied mit wenig MP',leader:'Kampf-Leader'}),minMp:num('Manareserve nach Skill (Anteil)',0.2,0,1),maxTargets:int('Maximale Ziele',1,1,20),everyMs:int('Frühestens erneut nach (ms)',1000,100,3600000),conditions:list('Alle Bedingungen müssen gelten',condition)});
export const DESCRIPTOR = {
  format:'albot-settings',formatVersion:1,schemaId:'albot.config/v1',
  schema:obj('ALBot-Konfiguration',{
    general:obj('Projekt & Betrieb',{
      name:text('Profilname','Mein Super-Bot',{minLength:1}),autostart:flag('Beim Laden starten'),environment:choice('Ausführungsart',{auto:'Automatisch erkennen'},'auto'),
      combatTickMs:int('Kampfintervall (ms)',250,100,5000),economyTickMs:int('Economy-Intervall (ms)',2000,500,60000),planningTickMs:int('Strategie-Intervall (ms)',10000,1000,600000),
      transport:choice('Teamtransport',{auto:'Lokales IPC, sonst CM',ipc:'Nur lokales IPC',cm:'CM'}),allowRemoteCM:flag('CM zu konfigurierten externen Teammitgliedern'),
      maxPending:int('Maximal offene Aufträge',32,1,256),messageTtlMs:int('Nachrichten gültig (ms)',10000,1000,120000),ui:flag('Ingame-Bedienpanel im Browser',true),
      autoUpdate:flag('Versionierte Botupdates'),updateChannel:text('Updatekanal','stable'),pauseOnUnknown:flag('Unklare Wertaktionen anhalten',true)
    },'Dieselbe Konfiguration für Browser und Headless. Login und Reconnect bleiben Aufgaben des Clients.'),
    characters:list('Charaktere & Rollen',obj('Charakter',{
      name:text('Exakter Charaktername','',{minLength:1}),enabled:flag('Aktiv',true),class:choice('Klasse',classes),role:choice('Rolle',{farmer:'Farmer',merchant:'Merchant'}),
      group:text('Gruppe','team1',{minLength:1}),region:text('Region','EU',{minLength:1}),server:text('Server','II',{minLength:1}),rotation:flag('Darf für Aufgaben rotieren',true),
      catchUp:flag('Levelaufholen bevorzugen'),goldReserve:int('Eigene Goldreserve',10000),gearRole:choice('Ausrüstungsziel',{auto:'Automatisch',dps:'Schaden',tank:'Tank',healer:'Heilung',economy:'Economy'}),farmTargets:ids('Eigene Farmziele (leer = global)')
    }),'Namen müssen im Headless-Client zusätzlich konfiguriert sein. Rollenüberschreibungen entstehen durch charakterbezogene Regeln.'),
    farming:obj('Farmer & Überleben',{
      enabled:flag('Farmen',true),targets:ids('Erlaubte Monster-IDs'),mode:choice('Zielbewertung',{balanced:'Ausgewogen',xp:'Erfahrung',gold:'Gold',materials:'Materialbedarf'}),autoTravel:flag('Automatisch zum Farmziel reisen',true),
      loot:flag('Loot sammeln',true),lootEveryMs:int('Lootintervall (ms)',1000,300,60000),freeSlots:int('Freie Slots reservieren',3,1,42),
      hpBelow:num('HP auffüllen unter Anteil',0.75,0,1),mpBelow:num('MP auffüllen unter Anteil',0.5,0,1),restBelow:num('Ruhe unter HP-Anteil',0.4,0,1),resumeAbove:num('Weiter ab HP-Anteil',0.85,0,1),potions:flag('Tränke verwenden',true),
      respawn:flag('Automatisch wiederbeleben',true),respawnDelayMs:int('Respawn-Wartezeit (ms)',15000,10000,600000),maxDeaths:int('Tode bis Pause',3,1,100),deathWindowMs:int('Todesfenster (ms)',600000,60000,86400000),
      kiting:flag('Kiting',true),rangeBuffer:int('Reichweitenpuffer',15,0,200),maxAggro:int('Maximale gleichzeitige Aggroziele',2,1,30),avoidOthers:flag('Fremde Ziele respektieren',true),pvp:flag('PvP ausdrücklich erlauben')
    }),
    party:obj('Gruppe & Skills',{
      enabled:flag('Gruppenbetrieb',true),group:text('Gruppenkennung','team1',{minLength:1}),leader:text('Kampf-Leader (leer = Rollenwahl)','',{'x-catalog':'characters'}),merchant:text('Zuständiger Merchant','',{'x-catalog':'characters'}),
      selection:choice('Teamwahl',{fixed:'Feste aktivierte Charaktere',adaptive:'Nach Aufgabe und Fähigkeiten'}),maxFarmers:int('Maximale Farmer',3,1,20),followDistance:int('Folgeabstand',180,20,2000),focusFire:flag('Gemeinsames Ziel',true),waitForTeam:flag('Auf fehlende Teammitglieder warten',true),
      healing:flag('Gruppenheilung',true),energize:flag('Mana teilen',true),buffs:flag('Gruppenbuffs',true),revive:flag('Gruppenmitglieder wiederbeleben',true),aoe:flag('AoE erlauben'),aoeMaxTargets:int('AoE-Zielgrenze',3,1,20),
      rotationCooldownMs:int('Charakterwechsel frühestens nach (ms)',60000,10000,3600000),aura:choice('Paladin-Aura',{auto:'Situationsabhängig',off:'Keine Automatik',bulwark:'Bulwark',sanctuary:'Sanctuary',zeal:'Zeal',warding:'Warding'}),auraHoldMs:int('Aura mindestens halten (ms)',30000,5000,600000)
    }),
    skills:list('Individuelle Skill-Regeln',skill,'Diese Regeln präzisieren die Standardrotation. Höhere Priorität wird zuerst bewertet; Cooldowns und Live-Voraussetzungen bleiben verpflichtend.'),
    merchant:obj('Merchant & Logistik',{
      enabled:flag('Merchant-Automatik',true),goldReserve:int('Merchant-Goldreserve',100000),maxSpendPerHour:int('Maximale Goldausgaben pro Stunde',1000000),
      pickup:flag('Beute abholen',true),supply:flag('Farmer versorgen',true),maxDelivery:int('Menge je Lieferung',100,1),minFreeSlots:int('Arbeitsplätze im Inventar',4,1,42),
      position:obj('Standplatz',{enabled:flag('Fester Standplatz'),map:text('Karte','main'),x:num('X',0,-1000000,1000000),y:num('Y',0,-1000000,1000000)}),
      stand:flag('Stand automatisch öffnen'),mluck:flag('Mluck-Service',true),mluckOthers:flag('Mluck auch für andere Spieler'),massBuffs:flag('Produktions-/Exchange-Buffs',true),
      bank:flag('Bankaufträge',true),consolidate:flag('Bankbestände zusammenlegen'),expandBank:flag('Bankkapazität kaufen'),bankBudget:int('Budget für Bankerweiterung',0),
      taskHoldMs:int('Aufträge mindestens halten (ms)',30000,1000,600000),starvationMs:int('Maximale Wartezeit dringender Aufträge (ms)',120000,1000,3600000),
      ponty:flag('Ponty-Angebote prüfen'),pontyMaxSpend:int('Ponty-Budget je Kauf',100000),bargainRatio:num('Maximaler Anteil am geschätzten Marktwert',0.65,0,1),giveaways:flag('An Giveaways teilnehmen'),merrit:flag('Merrit-Belohnungen'),fishing:flag('Fishing'),mining:flag('Mining'),toolBudget:int('Werkzeugbudget',10000)
    }),
    items:list('Alle Items · Regeln',ITEM_RULE,'Ein Regelsatz für Farmer und Merchant. Charakterregeln vor Rollenregeln, danach Varianten und Priorität. Gesperrte, ausgerüstete oder reservierte Items bleiben geschützt.'),
    production:obj('Produktion & Gear',{
      enabled:flag('Produktionsaufträge'),upgrade:flag('Upgrade zulassen'),compound:flag('Compound zulassen'),exchange:flag('Exchange zulassen'),craft:flag('Craft zulassen'),
      gear:flag('Ausrüstung automatisch verbessern'),offlineProfiles:flag('Offline-Charaktere berücksichtigen',true),minImprovement:num('Mindestverbesserung als Anteil',0.05,0,10),
      lossBudget:int('Verlustbudget pro Stunde (Goldwert)',0),minChance:num('Globale Mindest-Erfolgschance',1,0,1),maxChainDepth:int('Maximale Produktionstiefe',8,1,32),maxFarmHours:num('Maximale Farmzeit je Materialauftrag (Stunden)',12,0,168),
      acquireBy:ids('Erlaubte Beschaffungswege (bank, npc, market, farm, craft, exchange)'),
      goals:list('Produktionsziele',obj('Ziel',{name:text('Zielname','Neues Ziel',{minLength:1}),enabled:flag('Aktiv',true),item:text('Zielitem','',{'x-catalog':'items',minLength:1}),level:int('Ziellevel',0,0,99),quantity:int('Menge',1,1),recipient:text('Empfänger','',{'x-catalog':'characters'}),budget:int('Gesamtbudget',100000),priority:int('Priorität',0,-10000,10000)}))
    }),
    world:obj('Welt, Bosse & Entwicklung',{
      bosses:flag('Bosse'),events:flag('Events'),quests:flag('Quests'),anniversary:flag('Saisonbelohnungen'),allowedBosses:ids('Erlaubte Boss-IDs'),allowedEvents:ids('Erlaubte Event-IDs'),excludedMaps:ids('Gesperrte Karten'),
      risk:choice('Risikoprofil',{conservative:'Vorsichtig',balanced:'Ausgewogen',aggressive:'Aggressiv'}),serverHop:flag('Serverwechsel'),allowedRealms:ids('Erlaubte Realms, z. B. EUII'),hopCooldownMs:int('Serverwechsel-Cooldown (ms)',300000,60000,86400000),
      magiport:flag('Abgesprochener Magiport'),learning:flag('Begrenzte adaptive Bewertung',true),learningWeight:num('Maximales Gewicht gelernter Werte',0.15,0,0.5),cacheTtlMs:int('Planungswerte neu bewerten nach (ms)',60000,1000,3600000)
    }),
    rules:list('Wenn–dann-Regeln',obj('Verhaltensregel',{
      name:text('Name','Neue Verhaltensregel',{minLength:1}),enabled:flag('Aktiv',true),priority:int('Priorität',0,-10000,10000),role:choice('Rolle',roles),character:text('Nur Charakter','',{'x-catalog':'characters'}),everyMs:int('Prüfintervall (ms)',1000,100,3600000),cooldownMs:int('Ausführungssperre danach (ms)',5000,0,3600000),
      match:choice('Verknüpfung',{all:'Alle Bedingungen',any:'Mindestens eine Bedingung'}),conditions:list('Bedingungen',condition),
      action:choice('Aktion',{pause:'Bot pausieren',retreat:'Rückzug',farm:'Farmziel ändern',supply:'Versorgung anfordern',bank:'Bankauftrag',skill:'Skill anfordern',task:'Aktivität wechseln',notify:'Kurzer Hinweis'}),target:text('Ziel / Skill-ID / Aktivität / Hinweis'),amount:int('Menge (falls benötigt)',1,1)
    }),'Deklarative Regeln ohne frei ausgeführten JavaScript-Code. Regeln dürfen Schutz und Ergebnisabgleich nicht umgehen.')
  })
};
DESCRIPTOR.schema.properties.items.maxItems=2000;
DESCRIPTOR.schema.properties.farming.properties.targets.default=['goo'];
DESCRIPTOR.schema.properties.production.properties.acquireBy.default=['bank','npc','farm','craft','exchange'];
