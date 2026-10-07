// ALBot 0.2.2-live-b | Einstellungen + Runtime
globalThis.ALBotConfig=(function unpack(t,v){if(!t)return v;if(Object.prototype.hasOwnProperty.call(t,'item'))return v.map(x=>unpack(t.item,x));return Object.fromEntries(t.keys.flatMap((k,i)=>v[0].includes(i)?[]:[[k,unpack(t.children[i],v[1][i])]]));})({"keys":["general","farming","party","merchant","characters","skills","items","production"],"children":[{"keys":["name","autostart","environment","combatTickMs","economyTickMs","planningTickMs","transport","allowRemoteCM","maxPending","messageTtlMs","ui","pauseOnUnknown"],"children":[null,null,null,null,null,null,null,null,null,null,null,null]},{"keys":["enabled","targets","autoTravel","loot","lootEveryMs","freeSlots","hpBelow","mpBelow","restBelow","resumeAbove","potions","respawn","respawnDelayMs","maxDeaths","deathWindowMs","kiting","rangeBuffer","maxAggro","avoidOthers"],"children":[null,{"item":null},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},{"keys":["enabled","group","leader","merchant","maxFarmers","followDistance","focusFire","waitForTeam","healing","energize","buffs","revive","aoe","aoeMaxTargets"],"children":[null,null,null,null,null,null,null,null,null,null,null,null,null,null]},{"keys":["enabled","goldReserve","maxSpendPerHour","pickup","supply","maxDelivery","minFreeSlots","position","stand","mluck","mluckOthers","massBuffs","bank","consolidate","expandBank","bankBudget","bankGold","goldTarget","giveaways"],"children":[null,null,null,null,null,null,null,{"keys":["enabled","map","x","y"],"children":[null,null,null,null]},null,null,null,null,null,null,null,null,null,null,null]},{"item":{"keys":["name","enabled","class","role","group","region","server","farmTargets","goldReserve","gearRole"],"children":[null,null,null,null,null,null,null,{"item":null},null,null]}},{"item":{"keys":["name","enabled","skill","class","character","priority","target","minMp","maxTargets","everyMs","conditions"],"children":[null,null,null,null,null,null,null,null,null,null,{"item":{"keys":["field","operator","value","item"],"children":[null,null,null,null]}}]}},{"item":{"keys":["name","enabled","priority","item","role","character","minLevel","maxLevel","statType","property","title","map","server","task","action","keep","targetCount","requestBelow","maxCount","batch","recipient","teamReserve","maxActions","minPrice","maxPrice","priceSource","goldBudget","lossBudget","targetLevel","scroll","offering","minChance","pack","slot","ttlMs"],"children":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]}},{"keys":["enabled","upgrade","compound","exchange","craft","gear","offlineProfiles","minImprovement","lossBudget","minChance","maxChainDepth","maxFarmHours","acquireBy","goals"],"children":[null,null,null,null,null,null,null,null,null,null,null,null,{"item":null},{"item":{"keys":["name","enabled","item","level","quantity","recipient","budget","priority"],"children":[null,null,null,null,null,null,null,null]}}]}]},[[],[[[],["Live B · 02-bank",true,"auto",250,2000,10000,"auto",false,32,10000,true,true]],[[],[true,["goo"],true,true,1000,3,0.75,0.5,0.4,0.85,true,true,15000,3,600000,true,15,2,true]],[[],[true,"team1","My_Ranger1","My_Merchant",3,180,true,true,true,true,true,true,false,3]],[[],[true,100000,10000,false,true,3000,4,[[],[false,"main",0,0]],false,true,false,false,true,false,false,0,false,200000,false]],[[[],["My_Ranger1",true,"ranger","farmer","team1","EU","II",[],10000,"auto"]],[[],["My_Ranger2",true,"ranger","farmer","team1","EU","II",[],10000,"auto"]],[[],["My_Ranger3",true,"ranger","farmer","team1","EU","II",[],10000,"auto"]],[[],["My_Merchant",true,"merchant","merchant","team1","EU","II",[],10000,"auto"]]],[],[[[],["Merchant liefert HP-Tränke an My_Ranger1",true,0,"hpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger1",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Merchant liefert HP-Tränke an My_Ranger2",true,0,"hpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger2",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Merchant liefert HP-Tränke an My_Ranger3",true,0,"hpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger3",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Farmer fordert HP-Tränke nach",true,0,"hpot0","farmer","",0,99,"","","","","","","consume",0,3050,50,10000,3000,"",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Merchant liefert MP-Tränke an My_Ranger1",true,0,"mpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger1",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Merchant liefert MP-Tränke an My_Ranger2",true,0,"mpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger2",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Merchant liefert MP-Tränke an My_Ranger3",true,0,"mpot0","merchant","",0,99,"","","","","","","send",100,100,0,100000,3000,"My_Ranger3",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["Farmer fordert MP-Tränke nach",true,0,"mpot0","farmer","",0,99,"","","","","","","consume",0,3050,50,10000,3000,"",0,0,1,1000,"fixed",10000,0,1,"","",1,"","",120000]],[[],["bank gslime",true,0,"gslime","merchant","",0,99,"","","","","","","bank",0,0,0,2,2,"",0,1,1,1000,"fixed",10000,0,1,"","",1,"items0","",120000]]],[[],[false,false,false,false,false,false,true,0.05,5000,0.95,8,12,["bank","npc","farm","craft","exchange"],[]]]]]);
/* ALBot 0.2.2-live-b · Live B pending */
(function(root){"use strict";
// src/runtime/primitives.js
// Scoped to the bundle: jsdom CODE does not necessarily expose these browser
// helpers. Only JSON configuration/checkpoints are cloned here, never game data.
const structuredClone=value=>typeof root.structuredClone==='function'?root.structuredClone(value):value===undefined?undefined:JSON.parse(JSON.stringify(value));
const TextEncoder=root.TextEncoder??class {
  encode(value){const bytes=[];for(const ch of String(value)){let n=ch.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|(n>>6),128|(n&63));else if(n<65536)bytes.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else bytes.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return new Uint8Array(bytes);}
};

// src/version.mjs
const VERSION='0.2.2-live-b';

// editor/lib/schema.mjs
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
const ACTIONS = actions;
const ITEM_RULE = obj('Item-Regel',{
  name:text('Regelname','Neue Regel',{minLength:1}),enabled:flag('Aktiv',true),priority:int('Priorität (höher gewinnt)',0,-10000,10000),
  item:text('Item-ID','hpot1',{'x-catalog':'items',minLength:1}),role:choice('Rolle',roles),character:text('Nur Charakter (leer = alle)','',{'x-catalog':'characters'}),
  minLevel:int('Ab Item-Level',0,0,99),maxLevel:int('Bis Item-Level',99,0,99),statType:text('Stat-Typ (leer = alle)'),property:text('Eigenschaft p (leer = alle)'),title:text('Item-Titel (leer = alle)'),
  map:text('Nur Karte (leer = alle)'),server:text('Nur Realm, z. B. EUII (leer = alle)'),task:text('Nur Aktivität (leer = alle)'),
  action:choice('Aktion',actions),keep:int('Mindestbestand behalten',0),targetCount:int('Zielbestand',100),requestBelow:int('Nachschub anfordern bei Bestand ≤ (0 = unter Zielbestand)',0),maxCount:int('Maximalbestand',1000),batch:int('Maximale Menge je Aktion',100,1),
  recipient:text('Lieferempfänger','',{'x-catalog':'characters'}),teamReserve:int('Zusätzliche Teamreserve',0),
  maxActions:int('Maximale Economy-Aktionen pro Botstart (0 = unbegrenzt)',0,0,1000000),
  minPrice:int('Mindestverkaufspreis pro Stück',1,1),maxPrice:int('Maximaler Kaufpreis pro Stück',1000,1),priceSource:choice('Preisquelle',{fixed:'Fester Grenzpreis',market:'Aktuelle Marktbeobachtung',npc:'NPC-Preis'}),
  goldBudget:int('Goldbudget je Auftrag',10000),lossBudget:int('Maximaler möglicher Itemverlust in Gold',0),
  targetLevel:int('Ziellevel bei Verarbeitung',1,0,99),scroll:text('Scroll-ID (leer = nach Grade)','',{'x-catalog':'items'}),offering:text('Offering-ID (leer = keines)','',{'x-catalog':'items'}),minChance:num('Mindest-Erfolgschance (0–1)',1,0,1),
  recipe:text('Rezept / Exchange-Ziel'),pack:text('Bankfach (leer = automatisch)'),slot:text('Equipment-/Stand-Slot (falls erforderlich)'),
  fallback:choice('Wenn Aktion nicht möglich',{hold:'Behalten und warten',notify:'Behalten und Hinweis',bank:'Bankauftrag erstellen'}),ttlMs:int('Auftrag gültig (ms)',120000,1000,86400000)
});
ITEM_RULE.required=ITEM_RULE.required.filter(k=>k!=='requestBelow');
const condition=obj('Bedingung',{field:choice('Messwert',{hpRatio:'Eigener HP-Anteil',targetHpRatio:'Ziel-HP-Anteil',mpRatio:'MP-Anteil',freeSlots:'Freie Slots',gold:'Gold',enemyCount:'Gegner in Reichweite',itemCount:'Item-Menge',map:'Karte',rip:'Tot',task:'Aktivität'}),operator:choice('Vergleich',{lt:'Kleiner',lte:'Kleiner/gleich',eq:'Gleich',neq:'Ungleich',gte:'Größer/gleich',gt:'Größer'}),value:text('Vergleichswert','0.5',{minLength:1}),item:text('Item-ID für Item-Menge','',{'x-catalog':'items'})});
const skill=obj('Skill-Regel',{name:text('Name','Neue Skill-Regel',{minLength:1}),enabled:flag('Aktiv',true),skill:text('Skill-ID','',{minLength:1}),class:choice('Klasse',classes),character:text('Nur Charakter','',{'x-catalog':'characters'}),priority:int('Priorität',0,-10000,10000),target:choice('Ziel',{enemy:'Aktueller Gegner',self:'Eigener Charakter',lowestHp:'Gruppenmitglied mit wenig HP',lowestMp:'Gruppenmitglied mit wenig MP',leader:'Kampf-Leader'}),minMp:num('Manareserve nach Skill (Anteil)',0.2,0,1),maxTargets:int('Maximale Ziele',1,1,20),everyMs:int('Frühestens erneut nach (ms)',1000,100,3600000),conditions:list('Alle Bedingungen müssen gelten',condition)});
const DESCRIPTOR = {
  format:'albot-settings',formatVersion:1,schemaId:'albot.config/v1',
  schema:obj('ALBot-Konfiguration',{
    general:obj('Projekt & Betrieb',{
      name:text('Profilname','Mein Super-Bot',{minLength:1}),autostart:flag('Beim Laden starten',true),environment:choice('Ausführungsart',{auto:'Automatisch erkennen'},'auto'),
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
      bankGold:flag('Goldbestand über Bank ausgleichen'),goldTarget:int('Gold-Zielbestand im Inventar',200000),
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

// editor/lib/contract.mjs
const SLOT_LIMIT = 1048576;
const SOFT_LIMIT = 921600;
const badKeys = new Set(['__proto__','constructor','prototype']);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
function parseData(source) {
  if(new TextEncoder().encode(source).length>8*1024*1024) throw Error('Datei ist größer als 8 MiB.');
  const value=JSON.parse(source); let nodes=0;
  function walk(x,depth){if(++nodes>150000||depth>32)throw Error('Dateistruktur ist zu groß oder zu tief.');if(x&&typeof x==='object')for(const k of Object.keys(x)){if(badKeys.has(k))throw Error('Unzulässiger Datenschlüssel: '+k);walk(x[k],depth+1);}}
  walk(value,0);return value;
}
function checkDescriptor(d) {
  if(d?.format!=='albot-settings'||d.formatVersion!==1||typeof d.schemaId!=='string'||!d.schemaId.trim())throw Error('Unbekanntes Werkstatt-Schemaformat. Erwartet: albot-settings / 1.');
  let count=0;
  function visit(s,depth){
    if(++count>5000||depth>12||!s||typeof s!=='object'||Array.isArray(s))throw Error('Schema ist zu groß, zu tief oder ungültig.');
    const allowed=['type','title','description','properties','required','additionalProperties','items','default','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','uniqueItems','x-labels','x-catalog'];
    for(const k of Object.keys(s))if(!allowed.includes(k))throw Error('Nicht unterstütztes Schemafeld: '+k);
    if(!['object','array','string','number','integer','boolean'].includes(s.type))throw Error('Nicht unterstützter Feldtyp: '+s.type);
    for(const k of ['title','description','x-catalog'])if(s[k]!==undefined&&(typeof s[k]!=='string'||s[k].length>4000))throw Error('Ungültige Feldbeschreibung.');
    for(const k of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(s[k]!==undefined&&(!Number.isFinite(s[k])||(['minLength','maxLength','minItems','maxItems'].includes(k)&&(!Number.isInteger(s[k])||s[k]<0))))throw Error('Ungültige Grenze: '+k);
    for(const [a,b] of [['minimum','maximum'],['minLength','maxLength'],['minItems','maxItems']])if(s[a]!==undefined&&s[b]!==undefined&&s[a]>s[b])throw Error('Umgekehrte Schemagrenzen: '+a);
    if(s.enum&&(!Array.isArray(s.enum)||!s.enum.length||s.enum.length>500||s.enum.some(v=>typeof v!=='string')))throw Error('Ungültige Auswahlliste.');
    if(s['x-labels']&&(typeof s['x-labels']!=='object'||Array.isArray(s['x-labels'])||Object.values(s['x-labels']).some(v=>typeof v!=='string')))throw Error('Ungültige Auswahlnamen.');
    if(s.type==='object'){
      if(!s.properties||typeof s.properties!=='object'||Array.isArray(s.properties)||s.additionalProperties!==false)throw Error('Objekte benötigen properties und additionalProperties:false.');
      if(s.required&&(!Array.isArray(s.required)||s.required.some(k=>!own(s.properties,k))))throw Error('Ungültige Pflichtfelder.');
      for(const [k,v] of Object.entries(s.properties)){if(badKeys.has(k)||!k.length)throw Error('Ungültiger Feldname.');visit(v,depth+1);}
    }
    if(s.type==='array'){if(s.maxItems===undefined||s.maxItems>2000)throw Error('Listen brauchen maxItems ≤ 2000.');visit(s.items,depth+1);}
  }
  visit(d.schema,0);if(d.schema.type!=='object')throw Error('Wurzelschema muss ein Objekt sein.');
  const errors=validateSchema(d.schema,defaultsFor(d.schema));
  // Empty required user text may intentionally need completion, so validate
  // declared scalar defaults separately only when they contain a value.
  if(errors.some(e=>/Typ|unbekannt|Auswahl|endlich/.test(e)))throw Error('Ungültige Schema-Defaults: '+errors.join('; '));
  return d;
}
function defaultsFor(s){
  if(own(s,'default'))return structuredClone(s.default);
  if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,defaultsFor(v)]));
  if(s.type==='array')return [];
  if(s.type==='boolean')return false;
  if(s.type==='string')return s.enum?.[0]??'';
  return s.minimum??0;
}
function validateSchema(s,value,path='Profil',errors=[]){
  if(errors.length>=100)return errors;
  const error=m=>errors.push(path+': '+m);
  if(s.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value)){error('Objekt erwartet (Typ).');return errors;}
    for(const k of Object.keys(value))if(!own(s.properties,k))error('unbekanntes Feld '+k);
    for(const k of s.required??[])if(!own(value,k))error('Pflichtfeld fehlt: '+k);
    for(const [k,v] of Object.entries(s.properties))if(own(value,k))validateSchema(v,value[k],path+' / '+(v.title||k),errors);
  } else if(s.type==='array'){
    if(!Array.isArray(value)){error('Liste erwartet (Typ).');return errors;}
    if(value.length>(s.maxItems??2000)||value.length<(s.minItems??0))error('Ungültige Anzahl Einträge.');
    if(s.uniqueItems&&new Set(value.map(x=>JSON.stringify(x))).size!==value.length)error('Doppelte Einträge.');
    value.slice(0,2000).forEach((v,i)=>validateSchema(s.items,v,path+' #'+(i+1),errors));
  } else if(s.type==='string'){
    if(typeof value!=='string')error('Text erwartet (Typ).');
    else {if(value.length<(s.minLength??0)||value.length>(s.maxLength??Infinity))error('Textlänge außerhalb der Grenzen.');if(s.enum&&!s.enum.includes(value))error('Unbekannte Auswahl: '+value);}
  } else if(s.type==='boolean'){if(typeof value!=='boolean')error('Ja/Nein erwartet (Typ).');}
  else if(typeof value!=='number'||!Number.isFinite(value))error('Endliche Zahl erwartet (Typ).');
  else {if(s.type==='integer'&&!Number.isSafeInteger(value))error('Ganze sichere Zahl erwartet.');if(value<(s.minimum??-Infinity)||value>(s.maximum??Infinity))error('Zahl außerhalb der Grenzen.');}
  return errors;
}
function phaseOf(action){return ['buy','marketBuy','wishlist','retrieve','farm'].includes(action)?'acquisition':['upgrade','compound','exchange','craft'].includes(action)?'production':action==='keep'?'all':'inventory';}
function ruleRank(r){return (r.character?100:0)+(r.role!=='all'?10:0)+['statType','property','title','map','server','task'].filter(k=>r[k]).length+(r.minLevel!==0||r.maxLevel!==99?1:0);}
function overlap(a,b){if(a.action==='send'&&b.action==='send'&&a.recipient&&b.recipient&&a.recipient!==b.recipient)return false;return a.item===b.item&&a.minLevel<=b.maxLevel&&b.minLevel<=a.maxLevel&&(a.role==='all'||b.role==='all'||a.role===b.role)&&['character','statType','property','title','map','server','task'].every(k=>!a[k]||!b[k]||a[k]===b[k])&&(phaseOf(a.action)==='all'||phaseOf(b.action)==='all'||phaseOf(a.action)===phaseOf(b.action));}
function outcome(r){const x={...r};for(const k of ['name','enabled','priority','item','role','character','minLevel','maxLevel','statType','property','title','map','server','task'])delete x[k];return JSON.stringify(x);}
function validateProfile(descriptor,c){
  const errors=validateSchema(descriptor.schema,c);
  if(errors.length||descriptor.schemaId!=='albot.config/v1')return errors;
  // An imported descriptor can ADD v1 fields, but cannot redefine the existing
  // contract while retaining its identity. Project only known fields to check it.
  const known=(s,v)=>s.type==='object'&&v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(s.properties).filter(([k])=>own(v,k)).map(([k,x])=>[k,known(x,v[k])])):s.type==='array'&&Array.isArray(v)?v.map(x=>known(s.items,x)):v;
  const coreErrors=validateSchema(DESCRIPTOR.schema,known(DESCRIPTOR.schema,c));
  if(coreErrors.length)return coreErrors;
  const names=c.characters.map(x=>x.name);
  if(names.some(n=>!n.trim()||n!==n.trim()))errors.push('Charaktername darf nicht leer sein oder Rand-Leerzeichen enthalten.');
  if(new Set(names).size!==names.length)errors.push('Charakternamen müssen eindeutig sein.');
  const ref=(v,where)=>{if(v&&!names.includes(v))errors.push(where+': unbekannter Charakter '+v);};
  ref(c.party.leader,'Kampf-Leader');ref(c.party.merchant,'Merchant');
  if(c.party.merchant&&!c.characters.some(x=>x.name===c.party.merchant&&x.role==='merchant'&&x.enabled))errors.push('Zuständiger Merchant muss ein aktiver Merchant sein.');
  if(c.general.autostart&&!c.characters.some(x=>x.enabled))errors.push('Autostart benötigt mindestens einen aktiven Charakter.');
  if(c.farming.restBelow>=c.farming.resumeAbove)errors.push('Farmer: Weiter-Schwelle muss über Ruhe-Schwelle liegen.');
  if(c.merchant.expandBank&&c.merchant.bankBudget<=0)errors.push('Bankerweiterung benötigt ein positives Budget.');
  for(const [i,r] of c.items.entries()){
    const p='Item-Regel '+(i+1)+' ('+r.name+')';ref(r.character,p);ref(r.recipient,p);
    if(!/^[a-zA-Z0-9_]+$/.test(r.item))errors.push(p+': ungültige Item-ID.');
    if(r.minLevel>r.maxLevel)errors.push(p+': Levelbereich ist umgekehrt.');
    if(r.keep+r.teamReserve>r.maxCount||r.targetCount>r.maxCount||r.targetCount<r.keep+r.teamReserve)errors.push(p+': Reserve ≤ Zielbestand ≤ Maximalbestand erforderlich.');
    if((r.requestBelow??0)>0&&r.requestBelow>r.targetCount)errors.push(p+': Nachschubschwelle darf nicht über dem Zielbestand liegen.');
    if(r.enabled&&r.action==='send'&&!r.recipient)errors.push(p+': Lieferempfänger fehlt.');
    if(r.enabled&&r.action==='send'&&r.character&&r.recipient===r.character)errors.push(p+': Lieferung an sich selbst.');
    if(r.enabled&&['list','equip'].includes(r.action)&&!r.slot)errors.push(p+': Slot fehlt.');
    if(r.enabled&&r.action==='list'&&!/^trade([1-9]|1[0-6])$/.test(r.slot))errors.push(p+': Stand-Slot trade1 bis trade16 erforderlich.');
    if(r.enabled&&['upgrade','compound'].includes(r.action)&&r.targetLevel<=r.minLevel)errors.push(p+': Ziellevel muss größer als Startlevel sein.');
  }
  const active=c.items.filter(r=>r.enabled);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(ruleRank(active[i])===ruleRank(active[j])&&active[i].priority===active[j].priority&&overlap(active[i],active[j])&&outcome(active[i])!==outcome(active[j]))errors.push('Regelkonflikt: „'+active[i].name+'“ / „'+active[j].name+'“. Priorität oder Filter unterscheiden.');
  for(const r of [...c.skills,...c.rules]){
    ref(r.character,r.name);
    if(r.enabled&&own(r,'match')&&!r.conditions.length)errors.push(r.name+': mindestens eine Wenn-Bedingung erforderlich.');
    for(const x of r.conditions){if(!['map','task','rip'].includes(x.field)&&!Number.isFinite(Number(x.value)))errors.push(r.name+': Vergleichswert muss eine Zahl sein.');if(x.field==='rip'&&!['true','false'].includes(x.value))errors.push(r.name+': Tot-Wert muss true oder false sein.');if(['map','task','rip'].includes(x.field)&&!['eq','neq'].includes(x.operator))errors.push(r.name+': für Text/Ja-Nein nur Gleich/Ungleich verwenden.');if(x.field==='itemCount'&&!x.item)errors.push(r.name+': Item-ID in Bedingung fehlt.');}
  }
  for(const g of c.production.goals)ref(g.recipient,g.name);
  return [...new Set(errors)].slice(0,100);
}
function resolveItem(c,query){
  if(query.locked||query.equipped||query.reserved)return {rule:null,reason:'Itemschutz: gesperrt, ausgerüstet oder reserviert.',quantity:0,candidates:[]};
  const rows=c.items.map((r,index)=>({r,index})).filter(({r})=>r.enabled&&r.item===query.item&&query.level>=r.minLevel&&query.level<=r.maxLevel&&(r.role==='all'||r.role===query.role)&&['character','statType','property','title','map','server','task'].every(k=>!r[k]||r[k]===query[k])&&(phaseOf(r.action)==='all'||phaseOf(r.action)===query.phase));
  rows.sort((a,b)=>ruleRank(b.r)-ruleRank(a.r)||b.r.priority-a.r.priority||a.index-b.index);
  const r=rows[0]?.r;
  return {rule:r??null,candidates:rows.map(x=>({name:x.r.name,rank:ruleRank(x.r),priority:x.r.priority})),reason:r?'„'+r.name+'“ gewinnt: Spezifität '+ruleRank(r)+', Priorität '+r.priority+'.':'Keine passende Regel: behalten.',quantity:!r||r.action==='keep'?0:Math.max(0,Math.min(r.batch,(query.quantity??0)-r.keep-r.teamReserve))};
}
function envelope(descriptor,config){return {format:'albot-profile',formatVersion:1,schemaId:descriptor.schemaId,config};}
function addMissingDefaults(schema,value,path='',changes=[]){
  if(schema.type==='object'&&value&&typeof value==='object'&&!Array.isArray(value)){
    const next=structuredClone(value);
    for(const [key,s] of Object.entries(schema.properties)){
      if(!own(next,key)){next[key]=defaultsFor(s);changes.push((path?path+'.':'')+key);}
      else next[key]=addMissingDefaults(s,next[key],(path?path+'.':'')+key,changes);
    }
    return next;
  }
  if(schema.type==='array'&&Array.isArray(value))return value.map((x,i)=>addMissingDefaults(schema.items,x,path+'['+i+']',changes));
  return structuredClone(value);
}
function importProfile(descriptor,value){
  if(value?.format!=='albot-profile'||value.formatVersion!==1)throw Error('Kein Super-Bot-Profil. Alte Generatorprofile bleiben in der klassischen Werkstatt nutzbar.');
  if(value.schemaId!==descriptor.schemaId)throw Error('Profil benötigt das Schema '+value.schemaId+'. Zuerst passendes Bot-Paket / Schema laden.');
  const errors=validateProfile(descriptor,value.config);if(errors.length)throw Error(errors.join('\n'));return structuredClone(value.config);
}
function exportBundle(descriptor,config,runtime){
  const errors=validateProfile(descriptor,config);if(errors.length)throw Error(errors.join('\n'));
  if(!runtime||runtime.schemaId!==descriptor.schemaId||runtime.contractVersion!==1)throw Error('Passendes fertiges Bot-Paket fehlt. JSON-Profil kann bereits gespeichert werden.');
  // Store field names once, rather than repeating dozens of names for every
  // item. The tiny decoder reconstructs the EXACT ordinary config object.
  function shape(s){return s.type==='object'?{keys:Object.keys(s.properties),children:Object.values(s.properties).map(shape)}:s.type==='array'?{item:shape(s.items)}:null;}
  function encode(t,v){if(!t)return v;if(own(t,'item'))return v.map(x=>encode(t.item,x));const missing=t.keys.map((k,i)=>own(v,k)?-1:i).filter(i=>i>=0);return [missing,t.keys.map((k,i)=>own(v,k)?encode(t.children[i],v[k]):null)];}
  function unpack(t,v){if(!t)return v;if(Object.prototype.hasOwnProperty.call(t,'item'))return v.map(x=>unpack(t.item,x));return Object.fromEntries(t.keys.flatMap((k,i)=>v[0].includes(i)?[]:[[k,unpack(t.children[i],v[1][i])]]));}
  const template=shape(descriptor.schema),safe=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const code='// ALBot '+runtime.version+' | Einstellungen + Runtime\n'+'globalThis.ALBotConfig=('+unpack.toString()+')('+safe(template)+','+safe(encode(template,config))+');\n'+runtime.code+'\n';
  const bytes=new TextEncoder().encode(code).length;
  if(bytes>SLOT_LIMIT)throw Error('Bot inklusive Einstellungen zu groß: '+bytes+' / '+SLOT_LIMIT+' UTF-8-Bytes.');
  return {code,bytes};
}
async function checkPackage(data){
  if(data?.format!=='albot-package'||data.formatVersion!==1)throw Error('Bot-Paketformat unbekannt.');
  checkDescriptor(data.descriptor);const r=data.runtime;
  if(!r||r.contractVersion!==1||r.schemaId!==data.descriptor.schemaId||typeof r.code!=='string'||!r.code.trim()||typeof r.version!=='string'||!/^[a-zA-Z0-9.+_-]{1,80}$/.test(r.version)||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('Runtime-Vertrag oder Versions-/Hashangabe ungültig.');
  if(new TextEncoder().encode(r.code).length>SLOT_LIMIT)throw Error('Runtime überschreitet bereits das CODE-Limit.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.code));
  if(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')!==r.sha256)throw Error('Bot-Paket ist beschädigt: SHA-256 stimmt nicht.');
  return data;
}

// src/config/live-a.mjs

// A release advertises only implemented fields. Names/semantics are the v1 names,
// so future releases can migrate mechanically without changing the workshop.
const pick=(s,keys)=>({...structuredClone(s),properties:Object.fromEntries(keys.map(k=>[k,structuredClone(s.properties[k])])),required:keys});
const base=DESCRIPTOR.schema.properties;
const fields={
  general:['name','autostart','environment','combatTickMs','economyTickMs','planningTickMs','transport','allowRemoteCM','maxPending','messageTtlMs','ui','pauseOnUnknown'],
  farming:['enabled','targets','autoTravel','loot','lootEveryMs','freeSlots','hpBelow','mpBelow','restBelow','resumeAbove','potions','respawn','respawnDelayMs','maxDeaths','deathWindowMs','kiting','rangeBuffer','maxAggro','avoidOthers'],
  party:['enabled','group','leader','merchant','maxFarmers','followDistance','focusFire','waitForTeam','healing','energize','buffs','revive','aoe','aoeMaxTargets'],
  merchant:['enabled','pickup','supply','maxDelivery','minFreeSlots']
};
const LIVE_DESCRIPTOR={format:'albot-settings',formatVersion:1,schemaId:'albot.live-a/v1',schema:{type:'object',title:'ALBot · Live A',properties:{},required:[],additionalProperties:false}};
for(const [key,keys] of Object.entries(fields))LIVE_DESCRIPTOR.schema.properties[key]=pick(base[key],keys);
LIVE_DESCRIPTOR.schema.properties.general.properties.messageTtlMs.minimum=6000;
LIVE_DESCRIPTOR.schema.properties.characters={...structuredClone(base.characters),items:pick(base.characters.items,['name','enabled','class','role','group','region','server','farmTargets'])};
LIVE_DESCRIPTOR.schema.properties.skills=structuredClone(base.skills);
const SUPPORTED_SKILLS=['hardshell','charge','taunt','warcry','huntersmark','poisonarrow','piercingshot','supershot','entangle','arcane_needle','curse','darkblessing','phaseout','invis','pcoat','mentalburst','quickstab','quickpunch','selfheal','shield_slam','purify','smash','heal','partyheal','energize','reflection','rspeed','revive','3shot','5shot','cleave','stomp','fanofknives'];
const liveSkill=LIVE_DESCRIPTOR.schema.properties.skills.items.properties.skill;
liveSkill.enum=SUPPORTED_SKILLS;liveSkill.default='supershot';
const items=structuredClone(base.items);
items.items=pick(base.items.items,['name','enabled','priority','item','role','character','minLevel','maxLevel','statType','property','title','map','server','task','action','keep','targetCount','requestBelow','maxCount','batch','recipient','teamReserve','ttlMs']);
items.items.required=items.items.required.filter(k=>k!=='requestBelow');
items.items.properties.action.enum=['keep','consume','send'];
items.items.properties.action['x-labels']={keep:'Behalten / reservieren',consume:'Verbrauch erlauben',send:'Überschuss liefern'};
items.description='Live A: Schutz, Trank-/Skillverbrauch und bestätigte Lieferung aus vorhandenen Beständen. Kein Kauf, Verkauf oder Bankzugriff.';
LIVE_DESCRIPTOR.schema.properties.items=items;
LIVE_DESCRIPTOR.schema.required=Object.keys(LIVE_DESCRIPTOR.schema.properties);

// src/config/live-b.mjs
const ECONOMY_DESCRIPTOR=structuredClone(LIVE_DESCRIPTOR);
ECONOMY_DESCRIPTOR.schemaId='albot.live-b/v1';
ECONOMY_DESCRIPTOR.schema.title='ALBot · Live B';
for(const k of ['merchant','items','production'])ECONOMY_DESCRIPTOR.schema.properties[k]=structuredClone(DESCRIPTOR.schema.properties[k]);
// Candidate B exposes only completed paths. The full workshop contract retains
// later capabilities; importing this package does not advertise them as ready.
function omitFields(schema,keys){for(const key of keys)delete schema.properties[key];schema.required=schema.required.filter(k=>!keys.includes(k));}
omitFields(ECONOMY_DESCRIPTOR.schema.properties.merchant,['taskHoldMs','starvationMs','merrit','fishing','mining','toolBudget','ponty','pontyMaxSpend','bargainRatio']);
omitFields(ECONOMY_DESCRIPTOR.schema.properties.items.items,['recipe','fallback']);
ECONOMY_DESCRIPTOR.schema.properties.merchant.properties.bankGold.title='Goldbestand bei Bankbesuchen ausgleichen';
for(const k of ['goldReserve','gearRole']){
 ECONOMY_DESCRIPTOR.schema.properties.characters.items.properties[k]=structuredClone(DESCRIPTOR.schema.properties.characters.items.properties[k]);
 ECONOMY_DESCRIPTOR.schema.properties.characters.items.required.push(k);
}
ECONOMY_DESCRIPTOR.schema.required=Object.keys(ECONOMY_DESCRIPTOR.schema.properties);

// src/core/policy.mjs
const xy=e=>({x:e?.real_x??e?.x,y:e?.real_y??e?.y});
const distance=(a,b)=>Math.hypot(xy(a).x-xy(b).x,xy(a).y-xy(b).y);
const samePlace=(a,b)=>!!a&&!!b&&a.map===b.map&&String(a.in??a.map)===String(b.in??b.map);
const protectedItem=i=>!i||!!(i.l||i.b||i.bound||i.locked||i.equipped||i.reserved||i.giveaway);
const identity=i=>i?JSON.stringify([i.name,i.level??0,i.stat_type??'',i.p??'',i.title??'',i.acc??'',i.rid??'',i.l??'',i.b??'']):'';
const fingerprint=i=>identity(i)+':'+(i?.q??1);
function chooseRule(rules,item,context){
  return rules.filter(r=>r.enabled&&r.item===item.name&&(item.level??0)>=r.minLevel&&(item.level??0)<=r.maxLevel&&(r.role==='all'||r.role===context.role)&&['character','map','server','task'].every(k=>!r[k]||r[k]===context[k])&&(!r.statType||r.statType===(item.stat_type??''))&&(!r.property||r.property===(item.p??''))&&(!r.title||r.title===(item.title??''))).sort((a,b)=>ruleRank(b)-ruleRank(a)||b.priority-a.priority)[0]??null;
}
function variantCount(items,item){return items.reduce((n,i)=>n+(i&&identity(i)===identity(item)?(i.q??1):0),0);}
function transferable(items,slot,rule){const i=items[slot];if(protectedItem(i)||!rule||rule.action!=='send')return 0;return Math.max(0,Math.min(i.q??1,rule.batch,variantCount(items,i)-rule.keep-rule.teamReserve));}
function arrived(c,d){return samePlace(c,d)&&distance(c,d)<=d.radius&&!c.moving;}
function matches(conditions,s){return conditions.every(c=>{const actual=c.field==='itemCount'?s.count(c.item):s[c.field];if(actual===undefined||actual===null||(typeof actual==='number'&&!Number.isFinite(actual)))return false;const wanted=typeof actual==='boolean'?c.value==='true':typeof actual==='number'?Number(c.value):c.value;return {lt:()=>actual<wanted,lte:()=>actual<=wanted,eq:()=>actual===wanted,neq:()=>actual!==wanted,gte:()=>actual>=wanted,gt:()=>actual>wanted}[c.operator]?.()===true;});}
function validMessage(m,from,self,roster,now){
  return !!m&&m.protocol==='albot/1'&&m.from===from&&roster.includes(from)&&m.to===self&&typeof m.session==='string'&&m.session.length<100&&Number.isSafeInteger(m.seq)&&m.seq>0&&Number.isFinite(m.time)&&Number.isFinite(m.ttl)&&m.ttl>0&&m.ttl<=120000&&m.time<=now+2000&&now-m.time<m.ttl&&['status','offer','accept','sent','receipt','done'].includes(m.type)&&typeof m.id==='string'&&m.id.length<150&&JSON.stringify(m).length<5000;
}

// src/core/executor.mjs
// Bounded resource owners, no queued closures carrying obsolete inventory slots.
class Executor {
  constructor({now,active,limit,onError,onEvent=()=>{}}){Object.assign(this,{now,active,limit,onError,onEvent});this.pending=new Map();this.generation=0;this.cooldowns=new Map();}
  busy(resource){return [...this.pending.values()].some(p=>p.resources.includes(resource));}
  run(key,resources,guard,invoke,{timeout=8000,delay=250,observe=null,value=false,onSettle=()=>{}}={}){
    if(!this.active()||this.pending.size>=this.limit||this.pending.has(key)||(this.cooldowns.get(key)||0)>this.now()||resources.some(r=>this.busy(r))||!guard())return false;
    const p={key,resources,generation:this.generation,deadline:this.now()+timeout,settled:false,observe,value,onSettle,delay};this.pending.set(key,p);
    this.onEvent('action.start',{key,resources:resources.join(','),value});
    try {Promise.resolve(invoke()).then(v=>{if(p.generation===this.generation){p.settled=true;p.result=v;p.error=v?.failed||v?.success===false?v:null;}},e=>{if(p.generation===this.generation){p.settled=true;p.error=e;}});}catch(e){p.settled=true;p.error=e;}
    return true;
  }
  poll(){
    const now=this.now();for(const [k,t] of this.cooldowns)if(t<=now)this.cooldowns.delete(k);
    for(const [key,p] of this.pending){
      let observed=false;try{observed=p.observe?.()===true;}catch{}
      if(observed||(!p.value&&p.settled)||now>=p.deadline){
        this.pending.delete(key);this.cooldowns.set(key,now+(p.error?3000:p.delay));
        const result=observed?'confirmed':p.value?'unknown':p.error?'rejected':p.settled?'returned':'timeout';
        this.onEvent('action.end',{key,result,error:p.error?.message??p.error?.reason??''});
        if(p.error||result==='timeout')this.onError(key,p.error??result);p.onSettle(result,p.error??p.result);
      }
    }
  }
  cancelResource(resource){for(const [key,p] of this.pending)if(!p.value&&p.resources.includes(resource))this.pending.delete(key);}
  invalidate(){this.generation++;for(const p of this.pending.values())if(p.value)p.onSettle('unknown');this.pending.clear();}
}

// src/core/test-report.mjs
function createTestReport(p,version){
  const events=[],incidents=[],counts={},actionStats={};let dropped=0,lastSample=0,lastSave=0,automaticDownload=false,provider=()=>({}),lastWriteError='';
  const clean=value=>String(value??'').replace(/\b(?:US|CH)_[A-Za-z0-9]+\b/g,'[redacted]').replace(/((?:token|password|authorization|user_auth)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]').slice(0,1800);
  const started=new Date().toISOString();
  function event(type,data={}){
    counts[type]=(counts[type]??0)+1;
    if(type==='action.start'||type==='action.end'||type==='action.transient'){const key=clean(data.key||'unknown').slice(0,120),a=actionStats[key]??(actionStats[key]={started:0,ended:0,results:{},transient:0,transientReasons:{}});if(type==='action.start')a.started++;else if(type==='action.end'){a.ended++;const result=clean(data.result||'unknown').slice(0,80);a.results[result]=(a.results[result]??0)+1;}else{a.transient++;const reason=clean(data.reason||'unknown').slice(0,120);a.transientReasons[reason]=(a.transientReasons[reason]??0)+1;}}
    const safe={};for(const [k,v] of Object.entries(data)){if(/password|token|auth|cookie/i.test(k))continue;safe[k]=typeof v==='number'||typeof v==='boolean'||v===null?v:clean(v);}
    const entry={time:new Date().toISOString(),type,...safe};events.push(entry);if(type==='error'){incidents.push(entry);if(incidents.length>24)incidents.shift();}if(events.length>256){events.shift();dropped++;}
  }
  function document(){const c=p.c;return {format:'albot-test-report',formatVersion:1,test:'Live A',version,started,exported:new Date().toISOString(),environment:p.headless?'headless':'browser',character:c?.name??null,gameVersion:p.G?.version??null,realm:p.realm(),storageError:clean(p.storageError),lastWriteError,counts:{...counts},actionStats:JSON.parse(JSON.stringify(actionStats)),dropped,...provider(),incidents:[...incidents],events:[...events]};}
  function text(){const data=document();let result=JSON.stringify(data,null,2);while(new TextEncoder().encode(result).length>900*1024&&data.events.length){data.events.splice(0,Math.min(32,data.events.length));data.exportTrimmed=true;result=JSON.stringify(data,null,2);}return result;}
  function save(){
    const content=text();
    try{
      if(p.headless){if(typeof p.h?.writeTestReport!=='function')throw Error('Client benötigt writeTestReport; alternativ ALBot.testReport() kopieren');const path=p.h.writeTestReport(content);lastWriteError='';return path;}
      const win=p.parent,doc=win.document;if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)throw Error('Browser-Download nicht verfügbar; ALBot.testReport() kopieren');
      const url=win.URL.createObjectURL(new win.Blob([content],{type:'application/json;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='test-ausgeführtertest.json';doc.body.append(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);lastWriteError='';return a.download;
    }catch(e){lastWriteError=clean(e.message);p.log('Testdatei: '+lastWriteError);return null;}
  }
  return {event,text,document,setProvider:f=>provider=f,
    error(where,e){event('error',{where,name:e?.name,message:e?.message??e?.reason??e,stack:e?.stack});},
    sample(state={}){const now=Date.now();if(now-lastSample>=5000){lastSample=now;const c=p.c;event('sample',{reason:state.reason,running:state.running,map:c?.map,x:c?.real_x??c?.x,y:c?.real_y??c?.y,hp:c?.hp,mp:c?.mp,target:c?.target,rip:!!c?.rip});}if(p.headless&&now-lastSave>=10000){lastSave=now;save();}},
    flush(automatic=false){if(p.headless)return save();if(automatic){if(automaticDownload)return;automaticDownload=true;}return save();}
  };
}

// src/core/checkpoint.mjs
// Reserve a small fixed-size record, rather than rewriting the whole profile.
// Only our obsolete optional configuration cache may be removed, never other bots.
function createCheckpoint(p,key,report){
  try{p.root.localStorage?.removeItem('cstore_'+key+':config');}catch{}
  const stored=p.read(key);let durable=true;
  function write(journal){const payload={journal,padding:''};const size=JSON.stringify(payload).length;payload.padding=' '.repeat(Math.max(0,4096-size));const ok=p.write(key,payload);durable=ok;if(!ok)report.error('checkpoint.write',p.storageError||'Speicher voll oder nicht verfügbar');return ok;}
  if(!stored?.journal)write(null);
  return {journal:stored?.journal??null,get durable(){return durable;},write,
    begin(j){if(durable&&write(j))return true;if(j.kind==='consume'){report.event('checkpoint.memory',{kind:j.kind,item:j.item});return true;}return false;},
    clear(j){return j?.kind==='consume'&&!durable?true:write(null);}
  };
}

// src/runtime/ports.mjs
function createPorts(root){
  let parent;try{parent=root.parent??root;}catch{parent=root;}
  const h=parent.headless,headless=!!(h||parent.caracAL);
  const ipc=!!(h?.apiVersion===1&&h.capabilities?.localMessages&&typeof h.send==='function'&&typeof h.onMessage==='function');
  const find=name=>typeof root[name]==='function'?[root,root[name]]:typeof parent[name]==='function'?[parent,parent[name]]:null;
  return {root,parent,headless,ipc,h,
    has:name=>!!find(name),
    call(name,...args){const f=find(name);if(!f)throw Error('Spiel-API fehlt: '+name);return f[1].apply(f[0],args);},
    get c(){return root.character;},get G(){return root.G??parent.G;},get entities(){return parent.entities??{};},
    realm(){return String(parent.server_region??root.server_region??'')+String(parent.server_identifier??root.server_identifier??'');},
    log(message){try{this.call('game_log','ALBot: '+String(message).slice(0,220));}catch{root.console?.warn(message);}},
    read(key){try{return this.call('get',key);}catch{return null;}},
    storageError:'',
    write(key,value){try{if(root.localStorage){root.localStorage.setItem('cstore_'+key,JSON.stringify(value));this.storageError='';return true;}const ok=this.call('set',key,value)===true;if(!ok)this.storageError='set() meldet Schreibfehler';return ok;}catch(e){this.storageError=String(e?.name)+': '+String(e?.message??e);return false;}},
    hook(name,handler){const old=root[name];const fn=function(...args){if(handler(...args)===true)return;if(typeof old==='function')return old.apply(this,args);};root[name]=fn;return ()=>{if(root[name]===fn)root[name]=old;};}
  };
}

// src/party/transport.mjs
function createTransport(bot){
  const {p,cfg,me}=bot,peers=new Map(),seen=new Map(),retired=new Map();let seq=0;const offs=[];
  const roster=cfg.characters.filter(x=>x.enabled&&x.group===me.group).map(x=>x.name);
  function receive(from,m){
    try{
      if(!validMessage(m,from,me.name,roster,Date.now())||m.group!==me.group)return;
      const old=seen.get(from);if(old&&old.session===m.session&&m.seq<=old.seq)return;
      if(old&&old.session!==m.session){const past=retired.get(from)??[];if(past.includes(m.session)||m.time<old.time)return;past.push(old.session);retired.set(from,past.slice(-8));}
      seen.set(from,{session:m.session,seq:m.seq,time:m.time});
      if(m.type==='status'){
        const d=m.data;if(!d||typeof d.map!=='string'||!Number.isFinite(d.x)||!Number.isFinite(d.y)||typeof d.realm!=='string'||!Array.isArray(d.items)||d.items.length>25)return;
        peers.set(from,{...d,received:Date.now(),session:m.session});
      }else if(bot.running)bot.logistics?.receive(from,m);
    }catch(e){bot.report('Nachricht verworfen: '+e.message);}
  }
  if(p.ipc)offs.push(p.h.onMessage(e=>{if(e.topic==='albot/1')receive(e.from,e.data);}));
  offs.push(p.hook('on_cm',(from,data)=>{if(data?.protocol!=='albot/1')return;if(cfg.general.transport!=='ipc'&&(!p.headless||cfg.general.allowRemoteCM||cfg.general.transport==='cm'))receive(from,data);return true;}));
  function send(to,type,data,id=''){
    if(!roster.includes(to)||to===me.name)return Promise.resolve(false);
    const m={protocol:'albot/1',from:me.name,to,group:me.group,session:bot.session,seq:++seq,time:Date.now(),ttl:cfg.general.messageTtlMs,type,id,data};
    if(JSON.stringify(m).length>=5000)return Promise.resolve(false);
    const mode=cfg.general.transport;
    let result;
    try{
      if(mode!=='cm'&&p.ipc&&(parentSiblings().includes(to)||mode==='ipc'))result=p.h.send(to,'albot/1',m);
      else if(mode==='ipc'||(p.headless&&!cfg.general.allowRemoteCM&&mode!=='cm'))return Promise.resolve(false);
      else result=p.call('send_cm',to,m);
    }catch(e){bot.report('Teamtransport: '+(e.message??e));return Promise.resolve(false);}
    return Promise.resolve(result).then(()=>true,e=>{bot.report('Teamtransport: '+(e.message??e));return false;});
  }
  function parentSiblings(){try{return p.parent.caracAL?.siblings??[];}catch{return [];}}
  return {peers,send,roster,fresh(name){const d=peers.get(name);return d&&Date.now()-d.received<cfg.general.messageTtlMs?d:null;},
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,target:bot.target?.id??null,free:bot.free(),running:bot.running,items,materials:bot.production?.materials()??[],gear:bot.gear?.snapshot()};for(const n of roster)send(n,'status',d);},
    close(){offs.splice(0).forEach(f=>f());peers.clear();seen.clear();retired.clear();}
  };
}

// src/core/movement.mjs
function createMovement(bot){
  const {p,exec}=bot;let order=null,blockedUntil=0;
  const stop=()=>{if(order||p.root.smart?.moving||p.c?.moving){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}order=null;exec.cancelResource('movement');};
  function go(d,owner){
    if(!bot.running||Date.now()<blockedUntil||!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
    if(arrived(p.c,{...d,radius:d.radius??20}))return true;
    if(order)return false;
    if(p.c.stand){exec.run('stand.close',['stand'],()=>bot.running&&!!p.c.stand,()=>p.call('close_stand'),{delay:1000});return false;}
    const dest={...d,radius:d.radius??20};
    // Smart movement can enter public maps; never attempt somebody else's instance.
    if(!samePlace(p.c,d)&&p.G.maps[d.map]?.instance){bot.reason='Zielinstanz nicht erreichbar';return false;}
    const started=Date.now();order={dest,owner,started,progress:started,last:xy(p.c),map:p.c.map};
    const local=samePlace(p.c,d)&&p.has('can_move_to')&&p.call('can_move_to',d.x,d.y);
    const accepted=exec.run('move',['movement'],()=>bot.running&&!p.c.rip,()=>p.call(local?'move':'smart_move',...(local?[d.x,d.y]:[{map:d.map,x:d.x,y:d.y}])),{timeout:120000,delay:500});
    if(!accepted)order=null;return false;
  }
  function poll(){if(!order)return;const now=Date.now();if(arrived(p.c,order.dest)){order=null;return;}if(p.c.map!==order.map||distance(p.c,order.last)>3){order.progress=now;order.last=xy(p.c);order.map=p.c.map;}
    if(now-order.progress>12000||now-order.started>120000){stop();blockedUntil=now+10000;bot.reason='Weg ohne Fortschritt; neuer Versuch in 10 Sekunden';}
  }
  return {go,poll,stop,get order(){return order;},
    local(x,y,owner){if(order&&order.owner!==owner)return false;if(!p.call('can_move_to',x,y))return false;return go({map:p.c.map,in:p.c.in??p.c.map,x,y,radius:8},owner);},
    farmLocation(type){const candidates=[];for(const [map,data] of Object.entries(p.G.maps)){if(data.ignore||data.instance||data.pvp)continue;for(const pack of data.monsters??[]){if(pack.type!==type)continue;const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[]);for(const [m,x1,y1,x2,y2] of ranges)candidates.push({map:m,in:m,x:(x1+x2)/2,y:(y1+y2)/2,radius:45});}}return candidates.sort((a,b)=>(a.map===p.c.map?-100000:0)+distance(p.c,a)-((b.map===p.c.map?-100000:0)+distance(p.c,b)))[0];}
  };
}

// src/combat/skills.mjs
function createSkills(bot){
  const {p,cfg,exec}=bot,last=new Map();
  const asArray=v=>Array.isArray(v)?v:v?[v]:[];
  function ready(id,target,reserve=.2){
    const c=p.c,s=p.G.skills[id];if(!s||c.rip||c.s?.stunned||c.s?.silenced)return false;
    if(s.hostile&&(p.parent.is_pvp||p.G.maps[c.map]?.pvp))return false;
    if(asArray(s.class).length&&!asArray(s.class).includes(c.ctype)||c.level<(s.level??0))return false;
    if(p.call('is_on_cooldown',id))return false;
    const cost=s.mp??(['attack','heal'].includes(id)?c.mp_cost??0:0);
    if(c.mp-cost<c.max_mp*reserve)return false;
    if(Object.entries(s.requirements??{}).some(([k,v])=>!Number.isFinite(c[k])||c[k]<v))return false;
    const weapons=['mainhand','offhand'].flatMap(k=>asArray(p.G.items[c.slots?.[k]?.name]?.wtype));
    if(s.wtype&&!asArray(s.wtype).some(w=>weapons.includes(w)))return false;
    const off=p.G.items[c.slots?.offhand?.name];if(s.offhand_type&&off?.type!==s.offhand_type&&off?.wtype!==s.offhand_type)return false;
    if(asArray(s.slot).some(v=>!Array.isArray(v)||c.slots?.[v[0]]?.name!==v[1]))return false;
    if(s.consume&&!bot.canConsumeImplicit(s.consume))return false;
    if(s.condition&&(target??c).s?.[s.condition])return false;
    if(target){if(!samePlace(c,target)||(!target.rip&&target.hp<=0))return false;const range=s.range??((c.range??0)*(s.range_multiplier??1)+(s.range_bonus??0));if(distance(c,target)>range)return false;if(s.no_self&&target.name===c.name)return false;}
    return true;
  }
  function use(id,target,reserve=.2,every=800,maxTargets=cfg.party.aoeMaxTargets,explicit=false){
    if(['heal','partyheal'].includes(id)&&!cfg.party.healing)return false;
    if(id==='energize'&&!cfg.party.energize||id==='revive'&&!cfg.party.revive)return false;
    if(['warcry','darkblessing','reflection','rspeed'].includes(id)&&!cfg.party.buffs)return false;
    if(!explicit&&cfg.skills.some(r=>r.skill===id&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype)))return false;
    if((last.get(id)??0)+every>Date.now()||!SUPPORTED_SKILLS.includes(id))return false;
    const s=p.G.skills[id];if(!s)return false;
    let extra,argsTarget=target;
    const multi=['3shot','5shot','fanofknives','cleave','stomp'].includes(id);
    const candidates=multi?bot.monsters().filter(e=>distance(p.c,e)<(s.range??p.c.range)-5):[];
    if(multi){if(!cfg.party.aoe||candidates.length<2||candidates.length>Math.min(maxTargets,cfg.party.aoeMaxTargets)||candidates.some(e=>!bot.allowed(e)||!e.target||!bot.teamNames.includes(e.target)))return false;argsTarget=['cleave','stomp'].includes(id)?null:candidates.slice(0,id==='3shot'?3:5);target=candidates[0];}
    if(id==='energize'){extra=Math.floor(Math.min(target.max_mp-target.mp,p.c.mp-p.c.max_mp*reserve,200));if(extra<=0)return false;}
    const consume=s.consume,prior=consume?bot.count(consume):0;
    if(s.hostile&&target&&target.type!=='monster')return false;
    if(s.target&&!target)return false;
    if(s.target==='player'&&target?.type==='monster')return false;
    const guard=()=>ready(id,target,reserve)&&(!s.hostile||!target||bot.allowed(bot.entity(target.id)))&&(!multi||candidates.every(e=>bot.allowed(bot.entity(e.id))));
    if(!guard())return false;
    if(consume&&(bot.inventoryBlocked||bot.logistics.reserved))return false;
    const accepted=exec.run('skill:'+id,['mana',s.share==='attack'||id==='heal'?'attack':'skill',...(consume?['inventory']:[])],guard,()=>{
      if(consume)bot.beginValue({kind:'consume',item:consume,before:prior});
      return id==='heal'?p.call('heal',target):p.call('use_skill',id,argsTarget,extra);
    },{delay:every,value:!!consume,observe:consume?()=>bot.count(consume)<prior:null,onSettle:state=>{if(consume)bot.endValue(state);}});
    if(accepted)last.set(id,Date.now());return accepted;
  }
  function support(){
    if(!cfg.party.enabled)return false;
    const allies=bot.allies(),alive=allies.filter(e=>!e.rip),hurt=alive.slice().sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp);
    if(p.c.ctype==='priest'){
      if(cfg.party.revive){const dead=allies.find(e=>e.rip);if(dead){if(dead.hp>=dead.max_hp&&use('revive',dead,.25))return true;if(dead.hp<dead.max_hp&&use('heal',dead,.1,300))return true;}}
      if(cfg.party.healing){if(hurt.filter(e=>e.hp/e.max_hp<.65).length>=2&&use('partyheal',null,.2,1000))return true;if(hurt[0]?.hp/hurt[0]?.max_hp<.85&&use('heal',hurt[0],.05,250))return true;}
    }
    if(p.c.ctype==='mage'){
      if(cfg.party.energize){const low=alive.filter(e=>e.name!==p.c.name&&e.mp/e.max_mp<.5).sort((a,b)=>a.mp/a.max_mp-b.mp/b.max_mp)[0];if(low&&use('energize',low,.4,1500))return true;}
      if(cfg.party.buffs){const tank=alive.find(e=>e.ctype==='warrior');if(tank&&use('reflection',tank,.5,5000))return true;}
    }
    if(cfg.party.buffs&&p.c.ctype==='rogue')for(const a of alive)if(use('rspeed',a,.4,1500))return true;
    return false;
  }
  function custom(target){for(const r of cfg.skills.filter(r=>r.enabled&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype)).sort((a,b)=>b.priority-a.priority)){
    const s=bot.measure(target);if(!matches(r.conditions,s))continue;
    const allies=bot.allies().filter(e=>!e.rip);const t=r.target==='enemy'?target:r.target==='self'?p.c:r.target==='leader'?bot.entity(bot.leader):allies.sort((a,b)=>r.target==='lowestHp'?a.hp/a.max_hp-b.hp/b.max_hp:a.mp/a.max_mp-b.mp/b.max_mp)[0];
    if(!t&&p.G.skills[r.skill]?.target)continue;if(use(r.skill,t,r.minMp,r.everyMs,r.maxTargets,true))return true;
  }return false;}
  function rotation(t){
    if(custom(t)||support())return;
    const c=p.c,hp=c.hp/c.max_hp,long=t&&t.hp>c.attack*4;
    if(c.ctype==='paladin'&&hp<.7&&use('selfheal',null,.1,1200))return;
    if(c.ctype==='warrior'&&hp<.5&&use('hardshell',null,.1,10000))return;
    if(!t)return;
    if(cfg.party.aoe)for(const id of ({ranger:['5shot','3shot'],warrior:['stomp','cleave'],rogue:['fanofknives']}[c.ctype]??[]))if(use(id,t,.35,600))return;
    const choices={
      warrior:[[long&&cfg.party.buffs,'warcry',null,5000],[t.target&&t.target!==c.name&&bot.teamNames.includes(t.target),'taunt',t,1500],[distance(c,t)>c.range*1.4,'charge',null,10000]],
      ranger:[[long,'huntersmark',t,5000],[long,'poisonarrow',t,1500],[(t.armor??p.G.monsters[t.mtype]?.armor??0)>200,'piercingshot',t,700],[t.hp>c.attack*1.5,'supershot',t,1500]],
      mage:[[long&&t.attack>c.max_hp*.04,'entangle',t,5000],[long,'arcane_needle',t,700]],
      priest:[[long&&cfg.party.buffs,'darkblessing',null,5000],[long,'curse',t,3000],[hp<.3,'phaseout',null,5000]],
      rogue:[[long,'pcoat',null,5000],[long,'mentalburst',t,1500],[true,'quickstab',t,500],[true,'quickpunch',t,500]],
      paladin:[[long,'shield_slam',t,1000],[long,'purify',t,1200],[true,'smash',t,1000]]
    };
    for(const [ok,id,target,delay] of choices[c.ctype]??[])if(ok&&use(id,target,.3,delay))return;
  }
  return {ready,use,rotation};
}

// src/items/logistics.mjs
function createLogistics(bot){
  const {p,cfg,me,exec,transport}=bot;let job=null,incoming=null,serial=0,summaryOffset=0;const completed=new Map(),nextOffer=new Map(),clock=()=>exec.now();
  const counters={offersSent:0,offersReceived:0,acceptsSent:0,acceptsReceived:0,sendsStarted:0,receiptsSent:0,receiptsReceived:0,doneSent:0,doneReceived:0,timeouts:0};
  const offerKey=(to,item)=>to+'\u0000'+item;
  const ruleFor=(item)=>bot.rule(item);
  const context=()=>({role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});
  const sendRecipients=item=>[...new Set(cfg.items.filter(r=>r.enabled&&r.action==='send'&&r.item===item.name&&r.recipient&&r.recipient!==me.name).map(r=>r.recipient))];
  const sendRule=(item,to)=>{const r=chooseRule(cfg.items.filter(r=>r.enabled&&(r.action==='keep'||r.action==='send'&&r.recipient===to)),item,context());return r?.action==='send'&&!bot.production?.reserved(item)?r:null;};
  const demandFor=(rule,n)=>{if(!rule)return 0;const threshold=(rule.requestBelow??0)>0?rule.requestBelow:rule.targetCount;return n<=threshold?Math.max(0,Math.min(rule.targetCount,rule.maxCount)-n):0;};
  const signature=i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''});
  const matchingDemand=(d,i)=>d.item===i.name&&(!d.variant||JSON.stringify(d.variant)===JSON.stringify(signature(i)));
  const count=i=>(p.c.items??[]).reduce((n,x)=>n+(x&&x.name===i.name&&(x.level??0)===i.level&&(x.stat_type??'')===i.stat_type&&(x.p??'')===i.p&&(x.title??'')===i.title?(x.q??1):0),0);
  const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<300&&distance(p.c,h)<300?e:null;};
  const safeItem=i=>i&&typeof i.name==='string'&&/^[a-zA-Z0-9_]+$/.test(i.name)&&Number.isInteger(i.level)&&i.level>=0&&i.level<100&&['stat_type','p','title'].every(k=>typeof i[k]==='string'&&i[k].length<161);
  function capacity(i){const rule=ruleFor(i);if(!rule||protectedItem(i))return 0;const min=me.role==='merchant'?cfg.merchant.minFreeSlots:cfg.farming.freeSlots;if(bot.free()<=min)return 0;return demandFor(rule,count(i));}
  function receive(from,m){
    const d=m.data;if(!d||typeof d!=='object')return;
    if(m.type==='offer'){
      counters.offersReceived++;
      if(bot.checkpoint?.durable===false||job||incoming||bot.journal||exec.busy('inventory')||bot.inventoryBlocked||completed.has(m.id)||!near(from)||!safeItem(d.item)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>1000000)return;
      if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.pickup))return;
      const quantity=Math.min(d.quantity,capacity(d.item),cfg.merchant.maxDelivery);if(quantity<1)return;
      incoming={id:m.id,from,session:m.session,item:d.item,quantity,before:count(d.item),until:clock()+cfg.general.messageTtlMs};
      // Persist BEFORE acknowledgement; a restart cannot safely infer a retry.
      try{bot.beginValue({kind:'receive',...incoming});}catch(e){incoming=null;throw e;}counters.acceptsSent++;transport.send(from,'accept',{quantity},m.id);
    }else if(m.type==='accept'&&job&&job.state==='offered'&&m.id===job.id&&from===job.to&&m.session===job.session){
      if(!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>job.quantity)return;
      job.quantity=d.quantity;job.state='accepted';counters.acceptsReceived++;
    }else if(m.type==='sent'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session){incoming.sent=true;}
    else if(m.type==='receipt'&&job&&m.id===job.id&&from===job.to&&m.session===job.session&&d.quantity===job.quantity){job.receipt=true;counters.receiptsReceived++;}
    else if(m.type==='done'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session&&incoming.observed){counters.doneReceived++;completed.set(m.id,Date.now());incoming=null;bot.endValue('confirmed');}
  }
  function poll(allowOffer=true){
    const now=clock();for(const [id,t] of completed)if(now-t>120000)completed.delete(id);
    for(const [id,t] of nextOffer)if(t<now)nextOffer.delete(id);
    if(incoming){
      if(count(incoming.item)>=incoming.before+incoming.quantity){incoming.observed=true;if(now-(incoming.lastReceipt??0)>1500){incoming.lastReceipt=now;counters.receiptsSent++;transport.send(incoming.from,'receipt',{quantity:incoming.quantity},incoming.id);}}
      if(now>incoming.until){counters.timeouts++;bot.endValue('unknown');incoming=null;}
    }
    if(job){
      if(job.state==='sent'&&count(job.item)<=job.before-job.quantity&&job.receipt){counters.doneSent++;transport.send(job.to,'done',{},job.id);completed.set(job.id,now);job=null;bot.endValue('confirmed');return;}
      if(job.state==='offered'){
        const current=p.c.items[job.slot],rule=current&&sendRule(current,job.to);
        if(fingerprint(current)!==job.fingerprint||transferable(p.c.items,job.slot,rule)<job.quantity){nextOffer.set(job.offerKey??offerKey(job.to,job.item.name),now+5000);job=null;return;}
        const retryMs=Math.max(500,Math.min(2000,Math.floor(cfg.general.messageTtlMs/3)));
        if(now-(job.lastOffer??0)>=retryMs){
          const peer=transport.fresh(job.to);
          if(peer?.session===job.session){job.lastOffer=now;transport.send(job.to,'offer',{item:job.item,quantity:job.quantity},job.id);}
        }
      }
      if(now>job.until){counters.timeouts++;if(job.state==='sent'||job.state==='accepted')bot.endValue('unknown');nextOffer.set(job.offerKey??offerKey(job.to,job.item.name),now+10000);job=null;return;}
      if(job.state==='accepted'&&!bot.inventoryBlocked){
        const j=job;
        const guard=()=>{const current=p.c.items[j.slot],rule=current&&sendRule(current,j.to);return bot.running&&near(j.to)&&!incoming&&fingerprint(current)===j.fingerprint&&transferable(p.c.items,j.slot,rule)>=j.quantity;};
        if(!guard()){bot.reason='Lieferung verändert; keine Übergabe';return;}
        exec.run('send',['inventory'],guard,()=>{
          bot.beginValue({kind:'send',...j});j.state='sent';counters.sendsStarted++;
          // Message never claims the transfer succeeded. Receipt checks inventory.
          transport.send(j.to,'sent',{},j.id);
          return p.call('send_item',j.to,j.slot,j.quantity);
        },{value:true,observe:()=>job!==j&&completed.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:state=>{if(state==='unknown'&&job===j){bot.endValue('unknown');job=null;}}});
      }
      return;
    }
    if(bot.checkpoint?.durable===false||!allowOffer||incoming||bot.inventoryBlocked||!bot.running)return;
    if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.supply))return;
    outer:for(let slot=0;slot<p.c.items.length;slot++){
      const item=p.c.items[slot];if(!item||protectedItem(item))continue;
      for(const to of sendRecipients(item)){
        const r=sendRule(item,to);if(!r)continue;
        const key=offerKey(to,item.name);if(nextOffer.has(key))continue;
        const peer=transport.fresh(to);if(!near(to)||!peer)continue;
        const demand=(peer.items??[]).find(x=>matchingDemand(x,item)&&Number.isFinite(x.need)&&x.need>0);if(!demand)continue;
        const quantity=Math.min(transferable(p.c.items,slot,r),cfg.merchant.maxDelivery,Math.floor(demand.need));if(quantity<1)continue;
        job={id:bot.session+':'+(++serial),state:'offered',to,session:peer.session,slot,item:signature(item),fingerprint:fingerprint(item),quantity,before:count(signature(item)),offerKey:key,lastOffer:now,until:now+Math.min(r.ttlMs,cfg.general.messageTtlMs)};
        nextOffer.set(key,now+5000);counters.offersSent++;transport.send(job.to,'offer',{item:job.item,quantity},job.id);break outer;
      }
    }
  }
  function travel(){
    if(me.role!=='merchant'||!cfg.merchant.enabled||job||incoming||bot.inventoryBlocked)return;
    for(const [name] of transport.peers){const h=transport.fresh(name);if(!h?.running||h.rip||h.realm!==p.realm())continue;
      const demand=(h.items??[]).some(x=>cfg.merchant.supply&&x.need>0&&p.c.items.some(i=>{const r=i&&matchingDemand(x,i)&&sendRule(i,name);return r&&variantCount(p.c.items,i)>r.keep+r.teamReserve;}));
      const pickup=cfg.merchant.pickup&&(h.items??[]).some(x=>x.to===me.name&&x.surplus>0);
      if((demand||pickup)&&(!samePlace(p.c,h)||distance(p.c,h)>200)){bot.reason='Lieferweg zu '+name;bot.movement.go({...h,radius:120},'logistics');return;}
    }
  }
  return {receive,poll,travel,get reserved(){return !!(job||incoming);},stats(){return {...counters};},
    summary(){
      const rules=cfg.items.filter(r=>r.enabled&&(r.role==='all'||r.role===me.role)&&(!r.character||r.character===me.name));
      const variants=new Map();for(const r of rules){const candidates=p.c.items.filter(i=>i?.name===r.item&&(i.level??0)>=r.minLevel&&(i.level??0)<=r.maxLevel);if(!candidates.length)candidates.push({name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title});for(const i of candidates){const sig=signature(i);variants.set(JSON.stringify(sig),sig);}}
      const all=[...variants.values()],page=all.slice(summaryOffset,summaryOffset+12);summaryOffset=(summaryOffset+12)%Math.max(1,all.length);
      return page.map(item=>{const r=ruleFor(item),n=count(item);return {item:item.name,variant:item,need:demandFor(r,n),surplus:r?.action==='send'?Math.max(0,n-r.keep-r.teamReserve):0,to:r?.action==='send'?r.recipient:''};});
    },
    close(){if(incoming||job?.state==='sent'||job?.state==='accepted')bot.endValue('unknown');job=null;incoming=null;}
  };
}

// src/combat/farmer.mjs
function createFarmer(bot){
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastLoot=0,lastTravel=0;
  const actionReason=x=>String(x?.reason??x?.message??x?.error??'');
  async function tolerate(key,expected,invoke,onTransient=()=>{}){try{const value=await invoke();if(actionReason(value)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}return value;}catch(e){if(actionReason(e)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}throw e;}}
  function recover(){
    const c=p.c,now=Date.now();
    if(c.rip){
      bot.target=null;bot.movement.stop();if(!deadSince){deadSince=now;deaths=deaths.filter(t=>now-t<cfg.farming.deathWindowMs);deaths.push(now);}
      bot.reason='Tot';if(deaths.length>=cfg.farming.maxDeaths){bot.pause('Todesgrenze erreicht');return true;}
      if(cfg.farming.respawn&&now-deadSince>=cfg.farming.respawnDelayMs)exec.run('respawn',['lifecycle'],()=>p.c.rip,()=>p.call('respawn'),{delay:15000});return true;
    }
    deadSince=0;
    const resource=c.hp/c.max_hp<cfg.farming.hpBelow?'hp':c.mp/c.max_mp<cfg.farming.mpBelow?'mp':null;
    if(resource&&!p.call('is_on_cooldown','use_hp')){
      let slot=-1;
      if(cfg.farming.potions&&!bot.inventoryBlocked&&!bot.logistics.reserved)slot=c.items.findIndex(i=>i&&!protectedItem(i)&&p.G.items[i.name]?.type==='pot'&&(p.G.items[i.name]?.gives??[]).some(g=>g[0]===resource)&&bot.consumable(i));
      if(slot>=0){
        const item=c.items[slot],fp=fingerprint(item),before=bot.count(item.name);
        exec.run('potion',['potion','inventory'],()=>!bot.inventoryBlocked&&!bot.logistics.reserved&&fingerprint(c.items[slot])===fp&&bot.consumable(c.items[slot])&&!p.call('is_on_cooldown','use_hp'),()=>{bot.beginValue({kind:'consume',item:item.name,before});return p.call('equip',slot);},{delay:2000,value:true,observe:()=>bot.count(item.name)<before,onSettle:s=>bot.endValue(s)});
      }else exec.run('regen',['potion'],()=>!p.call('is_on_cooldown','use_hp'),()=>p.call('use_skill','regen_'+resource),{delay:4000});
    }
    if(c.hp/c.max_hp<cfg.farming.restBelow)rest=true;
    if(rest&&c.hp/c.max_hp>=cfg.farming.resumeAbove)rest=false;
    if(rest){bot.reason='Erholung';bot.target=null;const threats=bot.monsters().filter(e=>e.target===c.name).sort((a,b)=>distance(c,a)-distance(c,b));if(threats[0])retreat(threats[0]);else bot.movement.stop();bot.skills.rotation(null);return true;}
    return false;
  }
  function retreat(t){const c=p.c,d=distance(c,t)||1,from=xy(c),toward=xy(t),dx=(from.x-toward.x)/d,dy=(from.y-toward.y)/d;for(const [x,y] of [[dx,dy],[-dy,dx],[dy,-dx]]){const nx=from.x+x*45,ny=from.y+y*45;if(p.call('can_move_to',nx,ny)){if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(nx,ny,'kite');return;}}bot.reason='Kein freier Rückzugsweg';}
  function tick(){
    if(recover())return;
    const c=p.c,now=Date.now();
    if(me.role==='merchant'){bot.reason=bot.inventoryBlocked?'Inventar ungeklärt':'Merchant bereit';return;}
    if(cfg.farming.loot&&!bot.inventoryBlocked&&!bot.logistics.reserved&&bot.free()>cfg.farming.freeSlots&&now-lastLoot>=cfg.farming.lootEveryMs){lastLoot=now;exec.run('loot',['inventory'],()=>bot.free()>cfg.farming.freeSlots,()=>tolerate('loot','openning',()=>p.call('loot')),{delay:cfg.farming.lootEveryMs});}
    if(!cfg.farming.enabled){bot.reason='Farmen ausgeschaltet';bot.skills.rotation(null);return;}
    if(p.parent.is_pvp||p.G.maps[c.map]?.pvp){bot.pause('Live A farmt nicht auf PvP-Karten');return;}
    if(bot.free()<cfg.farming.freeSlots){bot.reason='Inventarreserve erreicht';bot.target=null;bot.skills.rotation(null);return;}
    const leader=bot.transport.fresh(bot.leader);
    if(cfg.party.enabled&&bot.leader!==me.name){
      if(!leader?.running||leader.realm!==p.realm()||leader.rip){bot.reason='Warte auf Kampf-Leader';bot.target=null;bot.skills.rotation(null);return;}
      if(!samePlace(c,leader)||distance(c,leader)>cfg.party.followDistance){bot.target=null;bot.reason='Folge '+bot.leader;bot.movement.go({...leader,radius:cfg.party.followDistance/2},'follow');bot.skills.rotation(null);return;}
    }
    if(cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||!samePlace(c,bot.transport.fresh(n))||bot.transport.fresh(n)?.realm!==p.realm()||distance(c,bot.transport.fresh(n))>cfg.party.followDistance*2))){bot.reason='Warte auf Gruppe';bot.target=null;bot.skills.rotation(null);return;}
    const mobs=bot.monsters().filter(bot.allowed);
    const focus=cfg.party.enabled&&cfg.party.focusFire&&leader?.target?mobs.find(e=>e.id===leader.target):null;
    const previous=bot.target&&mobs.find(e=>e.id===bot.target.id);
    bot.target=focus??previous??mobs.sort((a,b)=>(a.target===c.name?-10000:0)+distance(c,a)-((b.target===c.name?-10000:0)+distance(c,b)))[0]??null;
    const target=bot.target;
    bot.skills.rotation(target);
    if(!target){bot.reason='Suche Farmziel';if(cfg.farming.autoTravel&&now-lastTravel>=10000&&!bot.movement.order){lastTravel=now;const d=bot.movement.farmLocation(bot.targets()[0]);if(d)bot.movement.go(d,'farm');else bot.reason='Kein öffentlicher Spawn für Farmziel';}return;}
    bot.reason='Kampf: '+target.mtype;
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    const range=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer,c.range*.25)),d=distance(c,target);
    if(cfg.farming.kiting&&target.target===c.name&&c.range>(target.range??20)+25&&d<Math.min(range,(target.range??20)+35))retreat(target);
    else if(d>range&&!bot.movement.order){const a=xy(c),b=xy(target),step=Math.min(60,d-range+3);bot.movement.go({map:c.map,in:c.in??c.map,x:a.x+(b.x-a.x)*step/d,y:a.y+(b.y-a.y)*step/d,radius:6},'combat');}
    if(c.target!==target.id)exec.run('target',['target'],()=>bot.allowed(target),()=>p.call('change_target',target),{delay:500});
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},()=>tolerate('attack','not_there',()=>p.call('attack',bot.entity(target.id)),()=>{bot.target=null;}),{delay:100});
  }
  return {tick};
}

// src/ui/panel.mjs
function createPanel(bot,api){
  if(bot.p.headless||!bot.cfg.general.ui)return {render(){},remove(){}};
  const doc=bot.p.parent.document;if(!doc?.body)return {render(){},remove(){}};
  const node=doc.createElement('section');node.id='albot-panel-'+bot.me.name;
  node.style.cssText='position:fixed;right:8px;top:45px;z-index:9999;background:#10211e;color:#eef8f4;border:1px solid #69ae90;padding:10px;font:13px sans-serif;max-width:300px';
  const title=doc.createElement('strong');title.textContent='ALBot '+VERSION+' · '+bot.me.name;const status=doc.createElement('p');node.append(title,status);
  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()],['Testlog speichern',()=>api.exportTestReport()]]){const b=doc.createElement('button');b.textContent=label;b.onclick=action;node.append(b);}
  doc.body.append(node);return {render(){status.textContent=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;},remove(){node.remove();}};
}

// src/merchant/economy.mjs
function createEconomy(bot){
 const {p,cfg,me,exec}=bot;let closed=false,lastMessage='',lastMessageAt=0;const ruleActions=new Map();
 const actionKey=r=>JSON.stringify([r.name,r.item,r.action,r.character,r.recipient,r.minLevel,r.maxLevel]);
 const remaining=r=>!r?.maxActions||(ruleActions.get(actionKey(r))??0)<r.maxActions;
 const ledgerKey='albot:economy:'+me.name+':budget';
 let ledger=p.read(ledgerKey)??{hour:Date.now(),spent:0,loss:0,goals:{}};
 if(!Number.isFinite(ledger.hour)||!Number.isFinite(ledger.spent)||!Number.isFinite(ledger.loss)||!ledger.goals||typeof ledger.goals!=='object')ledger={hour:Date.now(),spent:cfg.merchant.maxSpendPerHour,loss:cfg.production.lossBudget,goals:{}};
 const rules=(item,phase='inventory')=>chooseRule(cfg.items.filter(r=>phaseOf(r.action)==='all'||phaseOf(r.action)===phase),item,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});
 const count=item=>variantCount(p.c.items,item);
 const downstreamSatisfied=(item,r)=>{
  if(!r||!['buy','retrieve','marketBuy','wishlist'].includes(r.action))return false;
  const production=rules(item,'production');if(!production||!['upgrade','compound'].includes(production.action)||production.targetLevel<=(item.level??0))return false;
  return count({...item,level:production.targetLevel})>=Math.min(production.targetCount,production.maxCount);
 };
 const safe=i=>!protectedItem(i)&&typeof i.name==='string'&&i.name!=='placeholder';
 const spare=(slot,r)=>{const i=p.c.items[slot];return safe(i)&&r&&(!['sell','bank','list','send'].includes(r.action)||!bot.production?.reserved(i))?Math.max(0,Math.min(i.q??1,r.batch,count(i)-r.keep-r.teamReserve)):0;};
 const value=i=>{try{const v=p.call('item_value',i);return Number.isFinite(v)&&v>=0?v:Infinity;}catch{return Infinity;}};
 function note(s){bot.reason=s;if(lastMessage!==s||Date.now()-lastMessageAt>30000){lastMessage=s;lastMessageAt=Date.now();bot.report(s);}}
 function budget(cost,loss=0,r=null){
  if(Date.now()-ledger.hour>=3600000)ledger={...ledger,hour:Date.now(),spent:0,loss:0};
  const reserve=Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  return Number.isFinite(cost)&&cost>=0&&Number.isFinite(loss)&&loss>=0&&(cost===0||p.c.gold-cost-commitments>=reserve)&&ledger.spent+cost<=cfg.merchant.maxSpendPerHour&&ledger.loss+loss<=cfg.production.lossBudget&&(!r||(cost<=r.goldBudget&&loss<=r.lossBudget));
 }
 // Charge the maximum exposure BEFORE dispatch. A reload or ambiguous result cannot reset a budget.
 function charge(cost,loss,r,kind){
  if(!budget(cost,loss,r))return false;const next={...ledger,goals:{...ledger.goals},spent:ledger.spent+cost,loss:ledger.loss+loss};
  const goal=bot.production?.activeGoal;if(goal){const key=String(cfg.production.goals.indexOf(goal));const spent=(next.goals[key]??0)+cost+loss;if(spent>goal.budget)return false;next.goals[key]=spent;}
  if(kind==='bank.expand'){next.bankSpent=(ledger.bankSpent??0)+cost;if(next.bankSpent>cfg.merchant.bankBudget)return false;}
  if(!p.write(ledgerKey,next))return false;ledger=next;return true;
 }
 function perform(kind,{slots=[],cost=0,loss=0,rule=null,guard=()=>true,call,observe,details={},timeout=20000}){
  if(closed||!bot.running||bot.inventoryBlocked||bot.journal||bot.logistics.reserved||!bot.checkpoint.durable||p.c.rip||exec.busy('inventory')||!budget(cost,loss,rule)||!remaining(rule))return false;
  const prints=slots.map(s=>[s,fingerprint(p.c.items[s])]);
  const valid=()=>bot.running&&!closed&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&prints.every(([s,f])=>fingerprint(p.c.items[s])===f&&safe(p.c.items[s]))&&budget(cost,loss,rule)&&guard();
  return exec.run(kind,['inventory','gold','economy'],valid,()=>{
   if(!valid())throw Error('Economy-Zustand verändert');
   if(!charge(cost,loss,rule,kind))throw Error('Budget konnte nicht reserviert werden');
   bot.beginValue({kind,...details,cost,loss,slots:prints});
   if(rule&&kind!=='bank.split')ruleActions.set(actionKey(rule),(ruleActions.get(actionKey(rule))??0)+1);
   return call();
  },{value:true,timeout,delay:cfg.general.economyTickMs,observe,onSettle:state=>bot.endValue(state)});
 }
 function destination(id){try{return p.call('find_npc',id);}catch{return null;}}
 function at(d,radius=110){return !!d&&samePlace(p.c,d)&&distance(p.c,d)<=radius&&!p.c.moving;}
 function travel(d,label,radius=90){if(!d){note('Kein Arbeitsplatz: '+label);return false;}if(at(d,radius))return true;if(!bot.logistics.reserved){bot.reason='Unterwegs: '+label;bot.movement.go({...d,radius},'economy');}return false;}
 function npcFor(item){for(const [id,n] of Object.entries(p.G.npcs??{}))if(n.items?.includes(item))return destination(id);return null;}
 function npcBuy(item,r,quantity){
  const meta=p.G.items[item.name];if(!meta||item.level||item.p||item.stat_type||item.title)return false;
  const price=meta.g;if(!Number.isFinite(price)||price<=0||price>r.maxPrice)return false;
  const before=count(item),q=Math.floor(Math.min(quantity,r.batch,r.maxCount-before,Math.floor(r.goldBudget/price)));
  if(q<1||bot.free()<=cfg.merchant.minFreeSlots||!budget(q*price,0,r)||!travel(npcFor(item.name),'NPC '+item.name))return false;
  return perform('buy',{cost:q*price,rule:r,guard:()=>at(npcFor(item.name))&&count(item)===before&&p.G.items[item.name]?.g===price,call:()=>p.call('buy_with_gold',item.name,q),observe:()=>count(item)>=before+q,details:{item:item.name,quantity:q,before}});
 }
 function npcSell(slot,r){const i=p.c.items[slot],q=spare(slot,r),price=value(i);if(!q||!Number.isFinite(price)||price<r.minPrice)return false;const before=count(i),gold=p.c.gold;const d=destination('fancypots')??destination('potions')??npcFor('hpot0');if(!travel(d,'NPC-Verkauf'))return false;
  return perform('sell',{slots:[slot],rule:r,guard:()=>spare(slot,r)>=q&&at(d)&&value(p.c.items[slot])>=r.minPrice,call:()=>p.call('sell',slot,q),observe:()=>count(i)<=before-q&&p.c.gold>=gold+q*r.minPrice,details:{item:i.name,quantity:q,before}});
 }
 return {rules,count,downstreamSatisfied,safe,spare,value,note,budget,remaining,perform,destination,at,travel,npcFor,npcBuy,npcSell,get ledger(){return ledger;},close(){closed=true;},resume(){closed=false;}};
}

// src/merchant/bank.mjs
function createBank(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const packs=()=>Object.entries(p.c.bank??{}).filter(([name,items])=>/^items\d+$/.test(name)&&Array.isArray(items));
 const definitions=()=>p.G.bank_packs??p.root?.bank_packs??p.parent?.bank_packs??{};
 const packMap=pack=>definitions()[pack]?.[0]??(/^items[0-7]$/.test(pack)?'bank':null);
 const location=map=>({map,in:map,x:0,y:-100,radius:80});
 function ready(pack='items0'){const map=packMap(pack);return !!map&&cfg.merchant.bank&&me.name===cfg.party.merchant&&e.travel(location(map),'Bank')&&!!p.c.bank;}
 function store(slot,r){
  const item=p.c.items[slot];if(!e.safe(item)||e.spare(slot,r)<1)return false;
  const allowed=e.spare(slot,r);if(allowed<(item.q??1)){
   if(bot.free()<=cfg.merchant.minFreeSlots)return false;const before=item.q,dest=p.c.items.findIndex(x=>!x);
   return e.perform('bank.split',{slots:[slot],rule:r,guard:()=>!p.c.items[dest]&&e.spare(slot,r)>=allowed,call:()=>p.call('split',slot,allowed),observe:()=>p.c.items[slot]?.q===before-allowed&&p.c.items.some((x,n)=>n!==slot&&identity(x)===identity(item)&&x.q===allowed),details:{item:item.name,quantity:allowed,before}});
  }
  if(!ready(r.pack||'items0'))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const dest=items.findIndex(i=>!i);if(dest<0)continue;
   const before=e.count(item),bankBefore=variantCount(items,item),q=item.q??1;
   return e.perform('bank.store',{slots:[slot],rule:r,guard:()=>!!p.c.bank&&!p.c.bank[pack][dest]&&e.spare(slot,r)>=q,
    call:()=>p.call('bank_store',slot,pack,dest),observe:()=>e.count(item)===before-q&&variantCount(p.c.bank?.[pack]??[],item)===bankBefore+q,details:{item:item.name,quantity:q,pack,before}});
  }if(expand())return true;e.note('Bank voll: kein freier erlaubter Platz');return false;
 }
 function retrieve(item,r,wanted){
  if(!ready(r.pack||'items0')||bot.free()<=cfg.merchant.minFreeSlots)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const slot=items.findIndex(i=>i&&identity(i)===identity(item)&&e.safe(i)&&(i.q??1)<=Math.min(wanted,r.batch,r.maxCount-e.count(item)));
   if(slot<0)continue;const actual=items[slot],q=actual.q??1,fp=fingerprint(actual),dest=p.c.items.findIndex(i=>!i),before=e.count(actual),bankBefore=variantCount(items,actual);
   return e.perform('bank.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest],call:()=>p.call('bank_retrieve',pack,slot,dest),observe:()=>e.count(actual)===before+q&&variantCount(p.c.bank?.[pack]??[],actual)===bankBefore-q,details:{item:actual.name,quantity:q,pack,before}});
  }return false;
 }
 function consolidate(){
  if(!cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  for(const [pack,items] of packs())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const x=items[a],y=items[b];if(packMap(pack)!==p.c.map||!e.safe(x)||!e.safe(y)||!x.q||!y.q||identity(x)!==identity(y)||x.q+y.q>(p.G.items[x.name]?.s??0))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=x.q+y.q;
   return e.perform('bank.consolidate',{guard:()=>fingerprint(p.c.bank?.[pack]?.[a])===fa&&fingerprint(p.c.bank?.[pack]?.[b])===fb,call:()=>p.call('bank_swap',pack,a,b),observe:()=>{const row=p.c.bank?.[pack];return !!row&&((!row[a]&&row[b]?.q===total)||(!row[b]&&row[a]?.q===total));},details:{item:x.name,quantity:total,pack}});
  }return false;
 }
 function expand(){
  if(!cfg.merchant.bank||!cfg.merchant.expandBank||!p.c.bank)return false;
  for(const [pack,def] of Object.entries(definitions())){const cost=def[1];if(def[0]!==p.c.map||p.c.bank[pack]||!Number.isFinite(cost)||cost<=0||cost>cfg.merchant.bankBudget)continue;
   return e.perform('bank.expand',{cost,guard:()=>!!p.c.bank&&!p.c.bank[pack],call:()=>p.call('open_bank_pack',pack,'gold'),observe:()=>Array.isArray(p.c.bank?.[pack]),details:{pack}});
  }return false;
 }
 function gold(){
  if(!cfg.merchant.bank||!cfg.merchant.bankGold||!p.c.bank||me.name!==cfg.party.merchant)return false;
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  const target=Math.max(cfg.merchant.goldTarget,cfg.merchant.goldReserve,me.goldReserve??0)+commitments,before=p.c.gold,stored=p.c.bank.gold;
  if(!Number.isFinite(stored)||before===target)return false;
  const depositing=before>target,q=depositing?before-target:Math.min(target-before,stored);if(q<=0)return false;
  return e.perform('bank.gold',{guard:()=>p.c.gold===before&&p.c.bank?.gold===stored,call:()=>p.call(depositing?'bank_deposit':'bank_withdraw',q),observe:()=>p.c.gold===before+(depositing?-q:q)&&p.c.bank?.gold===stored+(depositing?q:-q),details:{quantity:q,before}});
 }
 return {store,retrieve,consolidate,gold,expand,packs,ready};
}

// src/merchant/market.mjs
function createMarket(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let secondhand=[],lastScan=0;
 const variant=(a,b)=>a&&b&&a.name===b.name&&(a.level??0)===(b.level??0)&&['stat_type','p','title'].every(k=>(a[k]??'')===(b[k]??''));
 function price(item,r,sell=false){
  let result=sell?r.minPrice:r.maxPrice;
  if(r.priceSource==='npc')result=e.value(item);
  if(r.priceSource==='market'){const values=[];for(const player of Object.values(p.entities))for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)values.push(i.price);if(!values.length)return null;values.sort((a,b)=>a-b);result=values[Math.floor(values.length/2)];}
  return Number.isFinite(result)&&result>0?Math.floor(sell?Math.max(r.minPrice,result):Math.min(r.maxPrice,result)):null;
 }
 function listing(slot,r){
  const item=p.c.items[slot],q=e.spare(slot,r),before=e.count(item),unitPrice=price(item,r,true);if(!q||!unitPrice||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  return e.perform('market.list',{slots:[slot],rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot]&&e.spare(slot,r)>=q,call:()=>p.call('trade',slot,r.slot,unitPrice,q),observe:()=>{const x=p.c.slots[r.slot];return x&&variant(x,item)&&x.price===unitPrice&&e.count(item)<=before-q;},details:{item:item.name,quantity:q,before}});
 }
 function buy(item,r){
  for(const player of Object.values(p.entities)){
   if(player.type!=='character'||!player.stand||distance(p.c,player)>300)continue;
   for(const [slot,offer] of Object.entries(player.slots??{})){
    const ceiling=price(item,r);if(!slot.startsWith('trade')||!offer||offer.b||offer.giveaway||offer.buy||!offer.rid||!variant(offer,item)||!Number.isFinite(offer.price)||offer.price<=0||!ceiling||offer.price>ceiling)continue;
    const before=e.count(item),q=Math.floor(Math.min(offer.q??1,r.batch,r.targetCount-before,r.maxCount-before)),unitPrice=offer.price,cost=q*unitPrice,rid=offer.rid;
    if(q<=0||bot.free()<=cfg.merchant.minFreeSlots)continue;
    return e.perform('market.buy',{cost,rule:r,guard:()=>{const live=bot.entity(player.id??player.name),current=live?.slots?.[slot];return live&&distance(p.c,live)<=300&&current?.rid===rid&&current.price===unitPrice&&variant(current,item)&&(current.q??1)>=q&&!current.b&&!current.giveaway;},call:()=>p.call('trade_buy',bot.entity(player.id??player.name),slot,q),observe:()=>e.count(item)>=before+q,details:{item:item.name,quantity:q,before}});
   }
  }return false;
 }
 function wishlist(item,r){
  const unitPrice=price(item,r),q=Math.floor(Math.min(r.batch,r.targetCount-e.count(item),r.maxCount-e.count(item))),cost=q*unitPrice;if(!unitPrice||q<=0||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  // Reserve full maximum exposure when publishing a passive purchase order.
  return e.perform('market.wishlist',{cost,rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot],call:()=>p.call('wishlist',r.slot,item.name,unitPrice,item.level??0,q),observe:()=>{const x=p.c.slots[r.slot];return x?.name===item.name&&x.b&&x.price===unitPrice;},details:{item:item.name,quantity:q}});
 }
 function background(){
  if(cfg.merchant.giveaways)for(const player of Object.values(p.entities))for(const [slot,offer] of Object.entries(player.slots??{})){
   if(!offer?.giveaway||!offer.rid||distance(p.c,player)>300||offer.list?.includes(p.c.name))continue;
   if(exec.run('giveaway',['social'],()=>bot.running,()=>p.call('join_giveaway',player.name,slot,offer.rid),{delay:60000}))return true;
  }
  if(!cfg.merchant.ponty)return false;
  const d=e.destination('secondhands');if(!e.at(d))return false;
  if(Date.now()-lastScan>60000){lastScan=Date.now();return exec.run('ponty.scan',['economy'],()=>bot.running,()=>Promise.resolve(p.call('get_secondhands',10000)).then(x=>{secondhand=Array.isArray(x?.items)?x.items.slice(0,100):[];}),{delay:60000});}
  for(const i of secondhand){const r=e.rules(i,'acquisition');if(r?.action!=='marketBuy'||!i.rid||!e.safe(i))continue;
   const price=i.price,q=i.q??1,before=e.count(i);if(!Number.isFinite(price)||price<=0||price>Math.min(r.maxPrice*q,cfg.merchant.pontyMaxSpend)||price>e.value(i)*q*cfg.merchant.bargainRatio||before+q>r.targetCount)continue;
   return e.perform('ponty.buy',{cost:price,rule:r,guard:()=>e.at(d)&&e.count(i)===before,call:()=>p.call('buy_secondhand',i.rid,10000),observe:()=>e.count(i)>=before+q,details:{item:i.name,quantity:q,before}});
  }return false;
 }
 return {listing,buy,wishlist,background};
}

// src/production/materials.mjs
// Adapted from v3 elixir-policy: weighted nested drop tables, bounded recursion.
function materialDrops(G,table,multiplier=1,seen=new Set()){
 const rows=[];if(seen.size>8)return rows;
 for(const row of Array.isArray(table)?table:[]){if(!Array.isArray(row)||!(row[0]>0)||typeof row[1]!=='string')continue;
  if(row[1]==='open'&&Array.isArray(G.drops?.[row[2]])&&!seen.has(row[2])){const children=G.drops[row[2]],total=children.reduce((n,r)=>n+(Number(r[0])||0),0);if(total>0)rows.push(...materialDrops(G,children,multiplier*row[0]/total,new Set([...seen,row[2]])));}
  else if(row[1]!=='open')rows.push({item:row[1],chance:row[0]*multiplier,quantity:Math.max(1,Number(row[2])||1)});
 }return rows;
}
function materialSources(G,item,quantity,allowedMonsters,maxHours){
 const result=[];for(const monster of allowedMonsters){const yieldPerKill=materialDrops(G,G.drops?.monsters?.[monster]).filter(x=>x.item===item).reduce((n,x)=>n+x.chance*x.quantity,0);
  if(!(yieldPerKill>0))continue;const hours=quantity/(20*yieldPerKill); // conservative estimate, not a measured rate
  if(hours<=maxHours)result.push({monster,item,quantity,estimatedHours:hours});
 }return result.sort((a,b)=>a.estimatedHours-b.estimatedHours).slice(0,10);
}

// src/production/planner.mjs
// Bounded dependency planning: stock -> bank/NPC -> recipe/mutation -> farm.
// Plans never dispatch actions and never override an explicit keep rule.
function planProduction({G,item,level=0,quantity=1,stock,bank,canBuy,allowed,maxDepth=8}){
 const steps=[],visiting=new Set(),allocated=new Map(),bankAllocated=new Map(),surplus=new Map();let nodes=0;
 function need(name,l,q,depth){
  const key=name+':'+l;if(++nodes>256)throw Error('Produktionsplan überschreitet 256 Abhängigkeiten');if(!Number.isSafeInteger(q)||q<1)throw Error('Ungültige Produktionsmenge');if(depth>maxDepth)throw Error('Produktionstiefe überschritten: '+key);
  if(visiting.has(key))throw Error('Rezeptzyklus: '+key);
  const extra=surplus.get(key)??0,used=Math.min(q,extra);surplus.set(key,extra-used);q-=used;if(!q)return;
  const available=Math.max(0,stock(name,l)-(allocated.get(key)??0)),take=Math.min(q,available);allocated.set(key,(allocated.get(key)??0)+take);q-=take;if(q<=0)return;
  visiting.add(key);
  try{
   const stored=allowed.includes('bank')?Math.min(q,Math.max(0,bank(name,l)-(bankAllocated.get(key)??0))):0;
   if(stored){bankAllocated.set(key,(bankAllocated.get(key)??0)+stored);steps.push({kind:'retrieve',item:name,level:l,quantity:stored});q-=stored;}if(!q)return;
   if(l===0&&allowed.includes('npc')&&canBuy(name)){steps.push({kind:'buy',item:name,level:0,quantity:q});return;}
   const recipe=G.craft?.[name];
   if(l===0&&recipe&&allowed.includes('craft')){
    const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1)throw Error('Unbekannte Rezeptmenge: '+name);
    const batches=Math.ceil(q/yieldCount);for(const row of recipe.items??[]){if(!Array.isArray(row)||!Number.isFinite(row[0])||row[0]<=0||!row[1])throw Error('Unbekanntes Rezept: '+name);need(row[1],row[2]??0,row[0]*batches,depth+1);}
    surplus.set(key,(surplus.get(key)??0)+batches*yieldCount-q);
    steps.push({kind:'craft',item:name,level:0,quantity:batches});return;
   }
   const meta=G.items?.[name];if(l>0&&(meta?.upgrade||meta?.compound)){
    const kind=meta.compound?'compound':'upgrade';need(name,l-1,q*(kind==='compound'?3:1),depth+1);steps.push({kind,item:name,level:l-1,targetLevel:l,quantity:q});return;
   }
   if(l===0&&allowed.includes('exchange')){
    for(const [source,meta] of Object.entries(G.items??{})){if(!Number.isSafeInteger(meta.e)||meta.e<1||visiting.has(source+':0'))continue;
     const yieldPerExchange=materialDrops(G,G.drops?.[source]).filter(x=>x.item===name).reduce((n,x)=>n+x.chance*x.quantity,0);if(!(yieldPerExchange>0))continue;
     const attempts=Math.ceil(q/yieldPerExchange);need(source,0,attempts*meta.e,depth+1);steps.push({kind:'exchange',item:source,level:0,quantity:attempts,output:name,probabilistic:true});return;
    }
   }
   if(allowed.includes('market')){steps.push({kind:'marketBuy',item:name,level:l,quantity:q});return;}
   if(allowed.includes('farm')){steps.push({kind:'farm',item:name,level:l,quantity:q});return;}
   throw Error('Kein freigegebener Beschaffungsweg: '+key);
  }finally{visiting.delete(key);}
 }
 need(item,level,quantity,0);return steps;
}

// src/production/production.mjs
function createProduction(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let preview=null,plan=[],goal=null,materials=[];
 const qty=(name,level)=>p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===level&&(e.rules(i)?.action!=='keep')&&!i.l&&!i.b?(i.q??1):0),0);
 function mutate(slot,r){
  const i={...p.c.items[slot]},kind=r.action;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production[kind]||!e.safe(i)||!p.G.items[i.name]?.[kind]||(i.level??0)>=r.targetLevel)return false;
  const inputs=[slot];if(kind==='compound')for(let n=0;n<p.c.items.length&&inputs.length<3;n++)if(n!==slot&&e.safe(p.c.items[n])&&identity(i)===identity(p.c.items[n]))inputs.push(n);
  if(kind==='compound'&&inputs.length!==3)return false;
  if(e.count(i)-inputs.length<r.keep+r.teamReserve)return false;
  const scrollName=r.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',i));
  const usable=x=>{const rule=x&&e.rules(x);return e.safe(x)&&rule?.action!=='keep'&&(!rule||e.count(x)>rule.keep+rule.teamReserve);};
  const scroll=p.c.items.findIndex(x=>x?.name===scrollName&&usable(x));const offering=r.offering?p.c.items.findIndex(x=>x?.name===r.offering&&usable(x)):null;
  if(scroll<0||(r.offering&&offering<0)){e.note('Produktion benötigt '+scrollName+(r.offering?' / '+r.offering:''));return false;}
  const slots=[...inputs,scroll,...(offering===null?[]:[offering])];if(new Set(slots).size!==slots.length)return false;
  const d=e.destination('newupgrade')??e.destination('upgrade');if(!e.travel(d,kind))return false;
  const key=kind+':'+slots.map(n=>fingerprint(p.c.items[n])).join('|');
  const args=kind==='compound'?[...inputs,scroll,offering]:[slot,scroll,offering];
  if(preview?.key!==key||Date.now()-preview.time>5000){
   if(exec.busy('economy'))return false;preview={key,time:Date.now(),chance:null,cost:null};const token=preview;
   const accepted=exec.run('production.preview',['economy'],()=>bot.running,()=>Promise.resolve(p.call(kind,...args,true)).then(result=>{if(preview!==token||!bot.running)return;const raw=typeof result==='number'?result:result?.chance??result?.success_chance;token.chance=Number(raw);token.cost=0;}),{delay:1000});if(!accepted)preview=null;return accepted;
  }
  const chance=preview.chance,cost=preview.cost;
  if(!Number.isFinite(chance)||chance>1||chance<Math.max(r.minChance,cfg.production.minChance)||!Number.isFinite(cost)||cost<0){e.note('Upgrade/Compound: Chance oder Kosten nicht freigegeben');return false;}
  const loss=slots.reduce((sum,n)=>sum+e.value(p.c.items[n]),0),before=e.count(i),next={...i,level:(i.level??0)+1},after=e.count(next),scrollBefore=p.c.items[scroll].q??1;
  return e.perform(kind,{slots,cost,loss,rule:r,guard:()=>e.at(d)&&preview?.key===key&&Date.now()-preview.time<5000,
   call:()=>p.call(kind,...args),observe:()=>{
    const consumed=p.c.items[scroll]?.name!==scrollName||(p.c.items[scroll]?.q??1)<scrollBefore;
    return consumed&&!p.c.q?.[kind]&&(e.count(next)>after||e.count(i)<=before-inputs.length);
   },details:{item:i.name,before,quantity:inputs.length,targetLevel:next.level},timeout:45000});
 }
 function craft(name,r){
  const recipe=p.G.craft?.[name];if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.craft||!recipe||recipe.quest)return false;
  const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1||e.count({name,level:0})+yieldCount>Math.min(r.targetCount,r.maxCount))return false;
  const slots=[],requirements=[];
  for(const [q,id,level=0] of recipe.items??[]){const slot=p.c.items.findIndex((i,n)=>{const keep=i&&e.rules(i);return i?.name===id&&(i.level??0)===level&&e.safe(i)&&!slots.includes(n)&&(i.q??1)>=q&&keep?.action!=='keep'&&e.count(i)-q>=(keep?keep.keep+keep.teamReserve:0);});if(slot<0)return false;slots.push(slot);requirements.push({item:{...p.c.items[slot]},before:e.count(p.c.items[slot]),q});}
  if(!slots.length||slots.length>9||!Number.isFinite(recipe.cost))return false;
  const d=e.destination('craftsman');if(!e.travel(d,'Craft '+name))return false;const item={name,level:0},before=e.count(item);
  return e.perform('craft',{slots,cost:recipe.cost,rule:r,guard:()=>e.at(d),call:()=>p.call('craft',...slots),observe:()=>e.count(item)>before&&requirements.every(x=>e.count(x.item)<=x.before-x.q),details:{item:name,before},timeout:45000});
 }
 function exchange(slot,r){
  const i={...p.c.items[slot]},q=p.G.items[i.name]?.e;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.exchange||!Number.isSafeInteger(q)||q<1||e.spare(slot,r)<q)return false;
  const quest=p.G.items[i.name]?.quest,npc=quest&&Object.entries(p.G.npcs??{}).find(([,n])=>n.quest===quest)?.[0];
  const d=e.destination(npc||'exchange');if(!e.travel(d,'Exchange'))return false;const before=e.count(i);
  return e.perform('exchange',{slots:[slot],rule:r,guard:()=>e.at(d)&&e.spare(slot,r)>=q,call:()=>p.call('exchange',slot),observe:()=>!p.c.q?.exchange&&!p.c.items.some(x=>x?.name==='placeholder')&&e.count(i)<=before-q,details:{item:i.name,quantity:q,before},timeout:45000});
 }
 function planGoals(){
  plan=[];goal=null;materials=[];if(!cfg.production.enabled)return;
  for(const g of cfg.production.goals.filter(g=>g.enabled).sort((a,b)=>b.priority-a.priority)){
   if(qty(g.item,g.level)>=g.quantity)continue;
   try{plan=planProduction({G:p.G,item:g.item,level:g.level,quantity:g.quantity,stock:qty,bank:(name,level)=>bot.bank.packs().reduce((n,[,items])=>n+items.reduce((s,i)=>s+(i?.name===name&&(i.level??0)===level&&!i.l&&!i.b?(i.q??1):0),0),0),canBuy:name=>!!e.npcFor(name),allowed:cfg.production.acquireBy,maxDepth:cfg.production.maxChainDepth});goal=g;}catch(err){e.note(err.message);}break;
  }
 }
 function tick(){
  if(!goal||!plan.length)return false;const step=plan[0],item={name:step.item,level:step.level};
  const r=e.rules(item,['buy','retrieve','farm','marketBuy'].includes(step.kind)?'acquisition':'production');
  if(!r||r.action!==step.kind){e.note('Produktionskette benötigt explizite '+step.kind+'-Regel für '+step.item);return false;}
  if(!e.remaining(r))return false;
  if(step.kind==='buy')return e.npcBuy(item,{...r,goldBudget:Math.min(r.goldBudget,goal.budget)},step.quantity);
  if(step.kind==='retrieve')return bot.bank.retrieve(item,r,step.quantity);
  if(step.kind==='craft')return craft(step.item,r);if(step.kind==='marketBuy')return bot.market.buy(item,r);if(step.kind==='exchange'){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return slot>=0&&exchange(slot,r);}
  if(['upgrade','compound'].includes(step.kind)){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return slot>=0&&mutate(slot,r);}
  if(step.kind==='farm'){
   const allowed=[...new Set(cfg.characters.filter(c=>c.enabled&&c.role==='farmer').flatMap(c=>c.farmTargets.length?c.farmTargets:cfg.farming.targets))];
   materials=materialSources(p.G,step.item,step.quantity,allowed,cfg.production.maxFarmHours).slice(0,5);
   e.note(materials.length?'Materialauftrag: '+step.item+' bei '+materials[0].monster:'Kein erlaubter Farmweg im Zeitbudget: '+step.item);
  }return false;
 }
 return {mutate,craft,exchange,planGoals,tick,get activeGoal(){return goal;},materials:()=>materials,
 reserved:i=>!!goal&&((i.name===goal.item&&(i.level??0)===goal.level&&!goal.recipient)||plan.some(s=>s.item===i.name&&(i.level??0)===s.level&&s.kind!=='farm')),
 farmTargets(){const merchant=bot.transport.fresh(cfg.party.merchant);if(!merchant?.running||!Array.isArray(merchant.materials))return null;const allowed=bot.me.farmTargets.length?bot.me.farmTargets:cfg.farming.targets;for(const request of merchant.materials){if(!allowed.includes(request.monster)||!Number.isFinite(request.quantity)||request.quantity<=0)continue;const r=e.rules({name:request.item,level:0},'acquisition');if(r?.action==='farm'&&qty(request.item,0)<Math.min(r.targetCount,request.quantity))return [request.monster];}return null;},
 status:()=>({goal:goal?.name??null,steps:plan.slice(0,20)}),close(){preview=null;plan=[];goal=null;materials=[];}};
}

// src/production/gear.mjs
function gearScore(stats,role){
 const weights=role==='tank'?{hp:.01,armor:1,resistance:1,vitality:2}:role==='healer'?{attack:2,int:3,mp:.02,frequency:100}:role==='economy'?{gold:10,luck:10,speed:2,mp:.01}:{attack:2,apiercing:.3,rpiercing:.3,str:1,dex:1,int:1,frequency:100,crit:2};
 return Object.entries(weights).reduce((n,[key,w])=>n+(Number(stats?.[key])||0)*w,0);
}
function createGear(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const key='albot:gear:'+me.name+':profiles';let profiles=cfg.production.offlineProfiles?(p.read(key)??{}):{},lastSave=0;
 if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
 profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&x&&typeof x==='object'&&x.slots&&typeof x.slots==='object'&&Number.isFinite(x.at)).slice(0,20));
 function snapshot(){const slots={};for(const [slot,i] of Object.entries(p.c.slots??{}))if(i&&!slot.startsWith('trade'))slots[slot]={name:i.name,level:i.level??0};return {class:p.c.ctype,level:p.c.level,slots};}
 function refresh(){
  if(!cfg.production.gear)return;for(const name of bot.teamNames){const peer=name===me.name?{gear:snapshot(),received:Date.now()}:bot.transport.fresh(name);const data=peer?.gear;
   if(!data||typeof data.class!=='string'||!Number.isFinite(data.level)||!data.slots||typeof data.slots!=='object')continue;
   const slots={};for(const [slot,i] of Object.entries(data.slots).slice(0,16))if(i&&typeof i.name==='string'&&p.G.items[i.name]&&Number.isInteger(i.level)&&i.level>=0&&i.level<=99)slots[slot]={name:i.name,level:i.level};
   profiles[name]={class:data.class,level:data.level,slots,at:Date.now()};
  }
  profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&Date.now()-x.at<7*86400000).slice(0,20));
  if(cfg.production.offlineProfiles&&Date.now()-lastSave>60000){lastSave=Date.now();p.write(key,profiles);}
 }
 function equip(slot,r){
  const item=p.c.items[slot],target=r.slot;if(!cfg.production.gear||!e.safe(item)||!target||target.startsWith('trade')||!Object.hasOwn(p.c.slots??{},target))return false;
  const meta=p.G.items[item.name];if(!meta||(meta.level??0)>p.c.level||meta.class&&!meta.class.includes(p.c.ctype))return false;
  const cls=p.G.classes?.[p.c.ctype]??{},type=meta.type,w=meta.wtype??type;
  if(type==='ring'&&!['ring1','ring2'].includes(target)||type==='earring'&&!['earring1','earring2'].includes(target))return false;
  if(['weapon','tool'].includes(type)){if(target==='mainhand'){if(!Object.hasOwn(cls.mainhand??{},w)&&!Object.hasOwn(cls.doublehand??{},w))return false;if(Object.hasOwn(cls.doublehand??{},w)&&p.c.slots.offhand)return false;}else if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},w)||Object.hasOwn(cls.doublehand??{},p.G.items[p.c.slots.mainhand?.name]?.wtype??''))return false;}
  else if(['shield','source','quiver','misc_offhand'].includes(type)){if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},type))return false;}
  else if(!['ring','earring'].includes(type)&&target!==type)return false;
  const current=p.c.slots[target];if(current?.l||current?.b)return false;
  const role=me.gearRole==='auto'?(p.c.ctype==='priest'?'healer':p.c.ctype==='merchant'?'economy':'dps'):me.gearRole;
  let nextScore,oldScore;try{nextScore=gearScore(p.call('item_properties',item),role);oldScore=current?gearScore(p.call('item_properties',current),role):0;}catch{return false;}
  if(current&&nextScore<oldScore*(1+cfg.production.minImprovement))return false;
  const oldId=identity(current);
  return e.perform('gear.equip',{slots:[slot],rule:r,guard:()=>identity(p.c.slots[target])===oldId,call:()=>p.call('equip',slot,target),observe:()=>identity(p.c.slots[target])===identity(item),details:{item:item.name,slot:target}});
 }
 function suggestions(){const result=[];if(!cfg.production.gear)return result;for(const [name,profile] of Object.entries(profiles)){
  const member=cfg.characters.find(c=>c.name===name);if(!member)continue;
  for(const rule of cfg.items.filter(r=>r.enabled&&r.action==='equip'&&(!r.character||r.character===name))){const item=p.c.items.find(i=>i?.name===rule.item&&e.safe(i)&&(i.level??0)>=rule.minLevel&&(i.level??0)<=rule.maxLevel);if(!item)continue;const meta=p.G.items[item.name];if((meta?.level??0)>profile.level||meta?.class&&!meta.class.includes(profile.class))continue;
   try{const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':'dps'):member.gearRole,old=profile.slots[rule.slot];const score=gearScore(p.call('item_properties',item),role),previous=old?gearScore(p.call('item_properties',old),role):0;if(score>previous*(1+cfg.production.minImprovement))result.push({character:name,item:item.name,level:item.level??0,slot:rule.slot,score,previous,offline:!bot.transport.fresh(name)&&name!==me.name});}catch{}
  }
 }return result.slice(0,20);}
 return {equip,snapshot,refresh,suggestions};
}

// src/merchant/controller.mjs
function createMerchant(bot){
 const {p,cfg,me,exec}=bot,e=bot.economy;let cursor=0;
 function buff(){
  if(me.role!=='merchant'||!cfg.merchant.mluck||!p.G.skills?.mluck)return;
  const skill=p.G.skills.mluck;if(p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||p.call('is_on_cooldown','mluck'))return;
  const candidates=cfg.merchant.mluckOthers?Object.values(p.entities).filter(x=>x.type==='character'):bot.allies();
  for(const c of candidates){if(c.rip||distance(p.c,c)>(skill.range??320)||c.s?.mluck?.strong&&c.s.mluck.f!==me.name||c.s?.mluck?.ms>60000)continue;
   exec.run('mluck',['skill','mana'],()=>bot.running&&p.c.mp>=(skill.mp??0),()=>p.call('use_skill','mluck',c.id??c.name),{delay:2000});break;
  }
 }
 function tick(){
  if(!bot.running||p.c.rip||bot.inventoryBlocked||bot.journal||bot.logistics.reserved||exec.busy('inventory'))return;
  if(me.role==='merchant'&&!cfg.merchant.enabled)return;if(me.role==='merchant')bot.production.planGoals();
  buff();if(bot.movement.order?.owner==='logistics'){bot.services?.restore();return;}
  if(me.role==='merchant'&&cfg.merchant.stand&&!p.c.stand&&!p.c.moving&&!bot.movement.order&&p.c.items.some(i=>i&&p.G.items[i.name]?.stand)){
   if(exec.run('stand',['stand'],()=>bot.running&&!p.c.moving,()=>p.call('open_stand'),{delay:5000}))return;
  }
  const items=p.c.items;
  for(let n=0;n<items.length;n++){
   const slot=(cursor+n)%items.length,i=items[slot];if(!e.safe(i))continue;
   const inventoryRule=e.rules(i),productionRule=e.rules(i,'production');
   const r=e.remaining(inventoryRule)?inventoryRule:null,production=e.remaining(productionRule)?productionRule:null;let done=false;
   if(r?.action==='sell')done=e.npcSell(slot,r);
   else if(r?.action==='bank'&&me.role==='merchant')done=bot.bank.store(slot,r);
   else if(r?.action==='list'&&me.role==='merchant')done=bot.market.listing(slot,r);
   else if(r?.action==='equip')done=bot.gear.equip(slot,r);
   if(!done&&me.role==='merchant'&&production?.action==='exchange')done=bot.production.exchange(slot,production);
   if(!done&&me.role==='merchant'&&['upgrade','compound'].includes(production?.action))done=bot.production.mutate(slot,production);
   if(done){cursor=(slot+1)%items.length;return;}if(bot.movement.order?.owner==='economy'){cursor=slot;return;}
  }
  if(me.role!=='merchant')return;
  for(const r of cfg.items.filter(r=>r.enabled&&e.remaining(r))){
   const item={name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title};
   if(e.rules(item,'acquisition')!==r||e.downstreamSatisfied(item,r))continue;const n=e.count(item),need=Math.min(r.targetCount,r.maxCount)-n;
   if(need<=0||(r.requestBelow>0&&n>r.requestBelow))continue;
   let done=false;
   if(r.action==='buy')done=e.npcBuy(item,r,need);
   if(r.action==='retrieve')done=bot.bank.retrieve(item,r,need);
   if(r.action==='marketBuy')done=bot.market.buy(item,r);
   if(r.action==='wishlist')done=bot.market.wishlist(item,r);
   if(done||bot.movement.order?.owner==='economy')return;
  }
  for(const r of cfg.items.filter(r=>r.enabled&&r.action==='craft'&&e.remaining(r))){const item={name:r.item,level:0};if(e.rules(item,'production')===r&&e.count(item)<r.targetCount&&bot.production.craft(r.item,r))return;}
  if(bot.production.tick()||bot.bank.gold()||bot.bank.consolidate()||bot.market.background()||bot.services?.tick())return;
  const pos=cfg.merchant.position;if(pos.enabled&&!e.travel({...pos,in:pos.map},'Standplatz',20))return;
  if(cfg.merchant.stand&&!p.c.stand&&p.c.items.some(i=>i?.name==='stand0'||i?.name==='stand1'))exec.run('stand',['stand'],()=>bot.running&&!p.c.moving,()=>p.call('open_stand'),{delay:5000});
 }
 return {tick};
}

// src/merchant/services.mjs
function insidePolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>point.y)!==(by>point.y)&&point.x<(bx-ax)*(point.y-ay)/(by-ay)+ax)inside=!inside;}return inside;}
function createServices(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let previousHand=null,gathering=null,merritAt=0,merritBaseline=0;
 function cast(skill,target){const s=p.G.skills?.[skill];if(!s||p.c.level<(s.level??0)||p.c.mp<(s.mp??0)||p.call('is_on_cooldown',skill))return false;return exec.run('service:'+skill,['skill','mana'],()=>bot.running&&!p.c.rip,()=>p.call('use_skill',skill,...(target?[target]:[])),{delay:10000});}
 function restore(){
  if(!previousHand)return false;if(identity(p.c.slots.mainhand)===previousHand){previousHand=null;gathering=null;return false;}
  const slot=p.c.items.findIndex(i=>identity(i)===previousHand);if(slot<0){e.note('Vorherige Waffe für Werkzeugwechsel fehlt');return true;}
  const expected=previousHand;return e.perform('gather.restore',{slots:[slot],call:()=>p.call('equip',slot,'mainhand'),observe:()=>identity(p.c.slots.mainhand)===expected,details:{item:p.c.items[slot].name}});
 }
 function gather(kind){
  const tool=kind==='fishing'?'rod':'pickaxe';if(p.c.q?.[kind])return true;
  if(bot.monsters().some(m=>m.target===p.c.name))return restore();
  const regions=[];for(const [map,data] of Object.entries(p.G.maps??{}))if(data.safe&&!data.pvp&&!data.instance)for(const z of data.zones??[]){if(z.type!==kind||!Array.isArray(z.polygon)||z.polygon.length<3)continue;const polygon=z.polygon;const xs=polygon.map(x=>x[0]),ys=polygon.map(x=>x[1]);let point=null;
   for(let x=1;x<6&&!point;x++)for(let y=1;y<6&&!point;y++){const test={x:Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*x/6,y:Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*y/6};if(insidePolygon(test,polygon))point=test;}
   if(point)regions.push({map,in:map,...point,polygon});
  }
  const zone=regions.find(z=>z.map===p.c.map&&insidePolygon(xy(p.c),z.polygon))??regions[0];if(!zone){e.note('Keine sichere '+kind+'-Zone bekannt');return false;}
  if(!e.travel(zone,kind,5))return true;
  if(p.c.slots.mainhand?.name!==tool){const slot=p.c.items.findIndex(i=>i?.name===tool&&e.safe(i));if(slot<0){const r=e.rules({name:tool,level:0},'acquisition');if(r?.action==='buy')return e.npcBuy({name:tool,level:0},{...r,goldBudget:Math.min(r.goldBudget,cfg.merchant.toolBudget)},1);e.note('Werkzeug fehlt: '+tool);return false;}
   if(p.c.slots.mainhand?.l||p.c.slots.mainhand?.b)return false;previousHand=identity(p.c.slots.mainhand)||null;gathering=kind;
   return e.perform('gather.equip',{slots:[slot],guard:()=>bot.free()>cfg.merchant.minFreeSlots,call:()=>p.call('equip',slot,'mainhand'),observe:()=>p.c.slots.mainhand?.name===tool,details:{item:tool}});
  }
  return cast(kind);
 }
 function tick(){
  if(cfg.merchant.massBuffs&&cfg.production.enabled){const key=cfg.production.exchange?'massproduction':'massproductionpp';if(!p.c.s?.[key]&&cast(key))return true;}
  if(cfg.merchant.merrit){
   const d=e.destination('merrit');if(d&&Date.now()-merritAt>3600000){
    if(!cfg.merchant.stand){e.note('Merrit benötigt aktivierten Stand');return false;}
    const point={...d,x:d.x+60,y:d.y+40};if(!e.travel(point,'Merrit',5))return true;
    if(!p.c.stand)return false;
    if(!Object.entries(p.c.slots??{}).some(([k,v])=>k.startsWith('trade')&&v)){e.note('Merrit wartet auf ein freigegebenes Angebot/Kaufgesuch');return false;}
    if(!merritBaseline)merritBaseline=bot.count('marketparcel')+1;
    if(bot.count('marketparcel')>=merritBaseline){merritAt=Date.now();merritBaseline=0;bot.event('merchant.merrit',{received:true});return false;}
    e.note('Merrit: Stand geöffnet, warte auf Belohnung');return true;
   }
  }
  if(cfg.merchant.fishing||cfg.merchant.mining)return gather(cfg.merchant.fishing?'fishing':'mining');
  return restore();
 }
 return {tick,restore,get active(){return !!gathering;}};
}

// src/main.mjs
function install(root){
  root.ALBot?.dispose?.();
  const p=createPorts(root),now=()=>Date.now();
  const report=createTestReport(p,VERSION);report.event('boot');
  const performanceTrick={state:p.headless?'headless-skipped':'pending'};
  if(!p.headless){
    try{
      if(!p.has('performance_trick'))throw Error('Spiel-API performance_trick fehlt');
      if(p.parent.sounds?.empty?.playing?.())performanceTrick.state='already-playing';
      else{p.call('performance_trick');performanceTrick.state='requested';}
      report.event('browser.performance',performanceTrick);
    }catch(e){performanceTrick.state='failed';report.error('performance_trick',e);p.log('performance_trick: '+e.message);}
  }
  const failed=(state,reason)=>{report.error(state,reason);root.ALBot={version:VERSION,status:()=>({state,reason}),testReport:()=>report.text(),exportTestReport:()=>report.flush()};report.flush(true);};
  function validate(value){
    const errors=validateSchema(value.production?ECONOMY_DESCRIPTOR.schema:LIVE_DESCRIPTOR.schema,value);if(errors.length)return errors;
    const full=addMissingDefaults(DESCRIPTOR.schema,value);
    errors.push(...validateProfile(DESCRIPTOR,full));
    if(value.characters.filter(c=>c.enabled&&c.role==='farmer'&&c.group===value.party.group).length>value.party.maxFarmers)errors.push('Mehr aktive Farmer als maxFarmers.');
    if(value.characters.some(c=>c.enabled&&c.group!==value.party.group))errors.push('Live A benötigt eine gemeinsame Gruppenkennung.');
    if(value.characters.filter(c=>c.enabled&&c.role==='merchant').length>1)errors.push('Live A verwendet genau einen zuständigen Merchant.');
    const merchant=value.characters.find(c=>c.enabled&&c.role==='merchant');if(merchant&&value.merchant.enabled&&value.party.merchant!==merchant.name)errors.push('Zuständigen Merchant unter Gruppe & Skills auswählen.');
    if(value.party.leader&&!value.characters.some(c=>c.enabled&&c.name===value.party.leader&&c.role==='farmer'))errors.push('Leader muss aktiver Farmer sein.');
    if(value.items.some(r=>r.enabled&&r.action==='send'&&(!r.recipient||!value.characters.some(c=>c.enabled&&c.name===r.recipient))))errors.push('Lieferempfänger muss aktiv konfiguriert sein.');
    return errors;
  }
  let cfg;try{cfg=parseData(JSON.stringify(root.ALBotConfig));const errors=validate(cfg);if(errors.length)throw Error(errors.join('; '));}catch(e){p.log('Konfiguration ungültig: '+e.message);failed('invalid',e.message);return;}
  const me=cfg.characters.find(c=>c.name===p.c?.name&&c.enabled);
  if(!me){p.log('Eigenen Namen zuerst in der Werkstatt aktivieren.');failed('unconfigured','Eigenen Namen zuerst aktivieren');return;}
  const team=cfg.characters.filter(c=>c.enabled&&c.group===me.group),farmers=team.filter(c=>c.role==='farmer').map(c=>c.name).sort();
  const key='albot:live-a:'+me.name+':checkpoint';let timer=null,generation=0,disposed=false,lastEconomy=0,lastPlanning=0,lastHeartbeat=0,reportText='',reportTime=0,panel;
  const checkpoint=createCheckpoint(p,key,report),journal=checkpoint.journal;
  const bot={p,cfg,me,session:me.name+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8),running:false,reason:'Bereit für Live A',target:null,teamNames:team.map(c=>c.name),farmers,leader:cfg.party.leader||farmers[0]||me.name,journal,inventoryBlocked:!!journal,
    checkpoint,
    event(type,data){report.event(type,data);},
    report(message){if(message!==reportText||now()-reportTime>10000){reportText=message;reportTime=now();p.log(message);report.event('message',{message});}},
    free(){return p.c.items?.filter(i=>!i).length??0;},count(name){return (p.c.items??[]).reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);},
    entity(id){if(id===me.name)return p.c;const e=p.entities[id]??Object.values(p.entities).find(e=>e.name===id);return e?{...e,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}:null;},
    monsters(){return Object.entries(p.entities).filter(([,e])=>e.type==='monster'&&!e.dead&&!e.rip&&e.hp>0).map(([id,e])=>({...e,id:e.id??id,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}));},
    allies(){return bot.teamNames.map(n=>bot.entity(n)).filter(e=>e&&samePlace(p.c,e));},
    targets(){const requested=bot.production?.farmTargets();if(requested)return requested;return me.farmTargets.length?me.farmTargets:cfg.farming.targets;},
    allowed(e){if(!e||e.type!=='monster'||e.dead||e.rip||e.hp<=0||e.invincible||!samePlace(p.c,e)||!bot.targets().includes(e.mtype))return false;if(cfg.farming.avoidOthers&&e.target&&!bot.teamNames.includes(e.target))return false;const threats=Object.values(p.entities).filter(x=>x.type==='monster'&&x.hp>0&&bot.teamNames.includes(x.target)).length;return !!e.target||threats<cfg.farming.maxAggro;},
    rule(i){if(bot.economy)return bot.economy.rules(i);return chooseRule(cfg.items,i,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});},
    consumable(i){if(protectedItem(i))return false;const r=bot.rule(i);return !r||(r.action==='consume'&&variantCount(p.c.items,i)>r.keep+r.teamReserve);},
    canConsumeImplicit(name){if(bot.inventoryBlocked||bot.logistics?.reserved)return false;const first=p.c.items.find(i=>i?.name===name);return !!first&&bot.consumable(first);},
    beginValue(j){if(bot.journal)throw Error('Andere Inventaraktion offen');const next={...j,at:now()};if(!checkpoint.begin(next)){const e=new Error('Lieferung vor Versand blockiert: Checkpoint-Speicher fehlt');e.code='NOT_DISPATCHED';throw e;}bot.journal=next;report.event('inventory.intent',{kind:j.kind,item:typeof j.item==='string'?j.item:JSON.stringify(j.item),before:j.before,quantity:j.quantity,to:j.to});},
    endValue(result){if(!bot.journal)return;report.event('inventory.result',{result,kind:bot.journal.kind});if(result==='confirmed'&&checkpoint.clear(bot.journal)){bot.journal=null;}else {bot.inventoryBlocked=true;bot.reason='Inventaraktion ungeklärt: Bestand prüfen';if(cfg.general.pauseOnUnknown&&bot.running)bot.pause(bot.reason);}},
    measure(target=null){const targetHpRatio=target&&Number.isFinite(target.hp)&&Number.isFinite(target.max_hp)&&target.max_hp>0?target.hp/target.max_hp:undefined;return {hpRatio:p.c.hp/p.c.max_hp,targetHpRatio,mpRatio:p.c.mp/p.c.max_mp,freeSlots:bot.free(),gold:p.c.gold,enemyCount:bot.monsters().filter(e=>distance(p.c,e)<p.c.range).length,map:p.c.map,rip:!!p.c.rip,task:me.role==='merchant'?'supply':'farm',count:bot.count};}
  };
  const exec=new Executor({now,active:()=>bot.running,limit:cfg.general.maxPending,onEvent:report.event,onError:(key,e)=>{report.error(key,e);bot.report(key+': '+(e?.reason??e?.message??e));}});bot.exec=exec;
  bot.movement=createMovement(bot);bot.transport=createTransport(bot);bot.logistics=createLogistics(bot);bot.skills=createSkills(bot);bot.farmer=createFarmer(bot);
  if(cfg.production){bot.economy=createEconomy(bot);bot.bank=createBank(bot);bot.market=createMarket(bot);bot.production=createProduction(bot);bot.gear=createGear(bot);bot.merchant=createMerchant(bot);bot.services=createServices(bot);}
  const cleanup=[];
  if(typeof root.addEventListener==='function')for(const type of ['error','unhandledrejection']){const handler=e=>{report.error(type,e.error??e.reason??e.message);report.flush(true);};root.addEventListener(type,handler);cleanup.push(()=>root.removeEventListener(type,handler));}
  const inviteAllowed=name=>bot.running&&cfg.party.enabled&&name===bot.leader&&bot.teamNames.includes(name)&&!p.c.party;
  cleanup.push(p.hook('on_party_invite',name=>{if(inviteAllowed(name))exec.run('party',['party'],()=>inviteAllowed(name),()=>p.call('accept_party_invite',name),{delay:3000});}));
  cleanup.push(p.hook('on_party_request',name=>{if(bot.running&&cfg.party.enabled&&me.name===bot.leader&&farmers.includes(name))exec.run('party',['party'],()=>bot.running,()=>p.call('accept_party_request',name),{delay:3000});}));
  function publish(){try{p.call('set_message',(bot.running?'ALBot ':'PAUSE ')+bot.reason.slice(0,50));}catch{}panel?.render();}
  function halt(reason){bot.running=false;generation++;clearTimeout(timer);timer=null;bot.movement.stop();exec.invalidate();bot.logistics.close();bot.economy?.close();bot.production?.close();bot.target=null;bot.reason=reason;publish();bot.report(reason);report.event('stop',{reason});report.flush(true);}
  bot.pause=(reason='Pause')=>halt(reason);
  function tick(gen){if(disposed||!bot.running||gen!==generation)return;try{
    if(!p.c||!p.G){bot.reason='Spielzustand fehlt';return;}
    exec.poll();bot.movement.poll();
    if(!bot.running)return;
    if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.transport.heartbeat();}
    const economyDue=now()-lastEconomy>=cfg.general.economyTickMs;if(economyDue)lastEconomy=now();bot.logistics.poll(economyDue);
    if(!bot.running)return;
    bot.farmer.tick();if(economyDue&&bot.running)bot.merchant?.tick();
    if(now()-lastPlanning>=cfg.general.planningTickMs){lastPlanning=now();bot.gear?.refresh();bot.production?.planGoals();bot.logistics.travel();if(cfg.party.enabled&&me.name===bot.leader)for(const name of farmers){const e=bot.entity(name);if(name!==me.name&&(!e||e.party!==p.c.party||!p.c.party))exec.run('invite:'+name,['party'],()=>bot.running,()=>p.call('send_party_invite',name),{delay:10000});}}
    publish();
    report.sample({reason:bot.reason,running:bot.running});
  }catch(e){report.error('tick',e);bot.pause('Fehler: '+(e.message??e));bot.report(bot.reason);}finally{if(bot.running&&gen===generation)timer=root.setTimeout(()=>tick(gen),cfg.general.combatTickMs);}}
  const api={version:VERSION,schemaId:cfg.production?ECONOMY_DESCRIPTOR.schemaId:LIVE_DESCRIPTOR.schemaId,
    start(){
      if(disposed)return false;if(bot.running)return true;
      const deny=reason=>{bot.reason=reason;publish();bot.report(reason);return false;};
      if(me.class!=='auto'&&me.class!==p.c.ctype)return deny('Konfigurierte Klasse stimmt nicht');
      if(me.region+me.server!==p.realm())return deny('Falscher Realm: erwartet '+me.region+me.server);
      if(cfg.general.transport==='ipc'&&!p.ipc)return deny('Lokale IPC nicht verfügbar');
      if(bot.inventoryBlocked&&cfg.general.pauseOnUnknown)return deny('Offene Inventaraktion zuerst abgleichen');
      bot.economy?.resume();report.event('start');bot.running=true;bot.reason='Start';generation++;tick(generation);return bot.running;
    },
    pause:()=>halt('Pause'),stop:()=>halt('STOP'),
    status:()=>({version:VERSION,profile:cfg.general.name,running:bot.running,environment:p.headless?'headless':'browser',ipc:p.ipc,name:me.name,role:me.role,reason:bot.reason,target:bot.target?.id??null,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,journal:bot.journal?structuredClone(bot.journal):null}),
    testReport:()=>report.text(),exportTestReport:()=>report.flush(),
    acknowledgeInventory(){if(bot.running)throw Error('Zuerst pausieren und tatsächlichen Bestand prüfen');if(!checkpoint.write(null))throw Error('Speichern fehlgeschlagen');bot.journal=null;bot.inventoryBlocked=false;bot.reason='Inventar manuell abgeglichen';publish();},
    dispose(){if(disposed)return;halt('Entladen');disposed=true;bot.transport.close();cleanup.splice(0).forEach(f=>f());panel?.remove();}
  };
  root.ALBot=api;panel=createPanel(bot,api);cleanup.push(p.hook('on_destroy',()=>api.dispose()));
  report.setProvider(()=>({test:cfg.production?'Live B':'Live A',status:api.status(),performanceTrick:{...performanceTrick},checkpointMode:checkpoint.durable?'persistent':'memory-consumption-only',logistics:bot.logistics.stats(),production:bot.production?.status(),gear:bot.gear?.suggestions(),economy:bot.economy?.ledger,settings:{general:cfg.general,farming:cfg.farming,party:cfg.party,merchant:cfg.merchant,production:cfg.production,characters:cfg.characters,skills:cfg.skills.slice(0,30),items:cfg.items.slice(0,80),omittedItemRules:Math.max(0,cfg.items.length-80)},inventory:(p.c.items??[]).map((i,slot)=>i?{slot,name:i.name,level:i.level??0,quantity:i.q??1,locked:!!i.l}:null).filter(Boolean)}));
  if(!checkpoint.durable)bot.report('Speicher voll: Verbrauch wird im RAM abgeglichen; Lieferungen bleiben gesperrt. Testlog ohne localStorage.');
  p.log(VERSION+' · '+(p.headless?'Headless':'Browser')+' · '+me.role+' · Live B Testkandidat');publish();if(cfg.general.autostart)api.start();return api;
}

install(root);
})(globalThis);
