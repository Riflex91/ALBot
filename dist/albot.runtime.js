/* ALBot 0.1.0-live-a · first live test pending */
(function(root){"use strict";
// src/runtime/primitives.js
// Scoped to the bundle: jsdom CODE does not necessarily expose these browser
// helpers. Only JSON configuration/checkpoints are cloned here, never game data.
const structuredClone=value=>typeof root.structuredClone==='function'?root.structuredClone(value):value===undefined?undefined:JSON.parse(JSON.stringify(value));
const TextEncoder=root.TextEncoder??class {
  encode(value){const bytes=[];for(const ch of String(value)){let n=ch.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|(n>>6),128|(n&63));else if(n<65536)bytes.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else bytes.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return new Uint8Array(bytes);}
};

// src/version.mjs
const VERSION='0.1.0-live-a';

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
  action:choice('Aktion',actions),keep:int('Mindestbestand behalten',0),targetCount:int('Zielbestand',100),maxCount:int('Maximalbestand',1000),batch:int('Maximale Menge je Aktion',100,1),
  recipient:text('Lieferempfänger','',{'x-catalog':'characters'}),teamReserve:int('Zusätzliche Teamreserve',0),
  minPrice:int('Mindestverkaufspreis pro Stück',1,1),maxPrice:int('Maximaler Kaufpreis pro Stück',1000,1),priceSource:choice('Preisquelle',{fixed:'Fester Grenzpreis',market:'Aktuelle Marktbeobachtung',npc:'NPC-Preis'}),
  goldBudget:int('Goldbudget je Auftrag',10000),lossBudget:int('Maximaler möglicher Itemverlust in Gold',0),
  targetLevel:int('Ziellevel bei Verarbeitung',1,0,99),scroll:text('Scroll-ID (leer = nach Grade)','',{'x-catalog':'items'}),offering:text('Offering-ID (leer = keines)','',{'x-catalog':'items'}),minChance:num('Mindest-Erfolgschance (0–1)',1,0,1),
  recipe:text('Rezept / Exchange-Ziel'),pack:text('Bankfach (leer = automatisch)'),slot:text('Equipment-/Stand-Slot (falls erforderlich)'),
  fallback:choice('Wenn Aktion nicht möglich',{hold:'Behalten und warten',notify:'Behalten und Hinweis',bank:'Bankauftrag erstellen'}),ttlMs:int('Auftrag gültig (ms)',120000,1000,86400000)
});
const condition=obj('Bedingung',{field:choice('Messwert',{hpRatio:'HP-Anteil',mpRatio:'MP-Anteil',freeSlots:'Freie Slots',gold:'Gold',enemyCount:'Gegner in Reichweite',itemCount:'Item-Menge',map:'Karte',rip:'Tot',task:'Aktivität'}),operator:choice('Vergleich',{lt:'Kleiner',lte:'Kleiner/gleich',eq:'Gleich',neq:'Ungleich',gte:'Größer/gleich',gt:'Größer'}),value:text('Vergleichswert','0.5',{minLength:1}),item:text('Item-ID für Item-Menge','',{'x-catalog':'items'})});
const skill=obj('Skill-Regel',{name:text('Name','Neue Skill-Regel',{minLength:1}),enabled:flag('Aktiv',true),skill:text('Skill-ID','',{minLength:1}),class:choice('Klasse',classes),character:text('Nur Charakter','',{'x-catalog':'characters'}),priority:int('Priorität',0,-10000,10000),target:choice('Ziel',{enemy:'Aktueller Gegner',self:'Eigener Charakter',lowestHp:'Gruppenmitglied mit wenig HP',lowestMp:'Gruppenmitglied mit wenig MP',leader:'Kampf-Leader'}),minMp:num('Manareserve nach Skill (Anteil)',0.2,0,1),maxTargets:int('Maximale Ziele',1,1,20),everyMs:int('Frühestens erneut nach (ms)',1000,100,3600000),conditions:list('Alle Bedingungen müssen gelten',condition)});
const DESCRIPTOR = {
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
function overlap(a,b){return a.item===b.item&&a.minLevel<=b.maxLevel&&b.minLevel<=a.maxLevel&&(a.role==='all'||b.role==='all'||a.role===b.role)&&['character','statType','property','title','map','server','task'].every(k=>!a[k]||!b[k]||a[k]===b[k])&&(phaseOf(a.action)==='all'||phaseOf(b.action)==='all'||phaseOf(a.action)===phaseOf(b.action));}
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
items.items=pick(base.items.items,['name','enabled','priority','item','role','character','minLevel','maxLevel','statType','property','title','map','server','task','action','keep','targetCount','maxCount','batch','recipient','teamReserve','ttlMs']);
items.items.properties.action.enum=['keep','consume','send'];
items.items.properties.action['x-labels']={keep:'Behalten / reservieren',consume:'Verbrauch erlauben',send:'Überschuss liefern'};
items.description='Live A: Schutz, Trank-/Skillverbrauch und bestätigte Lieferung aus vorhandenen Beständen. Kein Kauf, Verkauf oder Bankzugriff.';
LIVE_DESCRIPTOR.schema.properties.items=items;
LIVE_DESCRIPTOR.schema.required=Object.keys(LIVE_DESCRIPTOR.schema.properties);

// src/core/policy.mjs
const xy=e=>({x:e?.real_x??e?.x,y:e?.real_y??e?.y});
const distance=(a,b)=>Math.hypot(xy(a).x-xy(b).x,xy(a).y-xy(b).y);
const samePlace=(a,b)=>!!a&&!!b&&a.map===b.map&&String(a.in??a.map)===String(b.in??b.map);
const protectedItem=i=>!i||!!(i.l||i.b||i.bound||i.locked||i.equipped||i.reserved);
const identity=i=>i?JSON.stringify([i.name,i.level??0,i.stat_type??'',i.p??'',i.title??'',i.acc??'',i.rid??'',i.l??'',i.b??'']):'';
const fingerprint=i=>identity(i)+':'+(i?.q??1);
function chooseRule(rules,item,context){
  return rules.filter(r=>r.enabled&&r.item===item.name&&(item.level??0)>=r.minLevel&&(item.level??0)<=r.maxLevel&&(r.role==='all'||r.role===context.role)&&['character','map','server','task'].every(k=>!r[k]||r[k]===context[k])&&(!r.statType||r.statType===(item.stat_type??''))&&(!r.property||r.property===(item.p??''))&&(!r.title||r.title===(item.title??''))).sort((a,b)=>ruleRank(b)-ruleRank(a)||b.priority-a.priority)[0]??null;
}
function variantCount(items,item){return items.reduce((n,i)=>n+(i&&identity(i)===identity(item)?(i.q??1):0),0);}
function transferable(items,slot,rule){const i=items[slot];if(protectedItem(i)||!rule||rule.action!=='send')return 0;return Math.max(0,Math.min(i.q??1,rule.batch,variantCount(items,i)-rule.keep-rule.teamReserve));}
function arrived(c,d){return samePlace(c,d)&&distance(c,d)<=d.radius&&!c.moving;}
function matches(conditions,s){return conditions.every(c=>{const actual=c.field==='itemCount'?s.count(c.item):s[c.field];const wanted=typeof actual==='boolean'?c.value==='true':typeof actual==='number'?Number(c.value):c.value;return {lt:()=>actual<wanted,lte:()=>actual<=wanted,eq:()=>actual===wanted,neq:()=>actual!==wanted,gte:()=>actual>=wanted,gt:()=>actual>wanted}[c.operator]?.()===true;});}
function validMessage(m,from,self,roster,now){
  return !!m&&m.protocol==='albot/1'&&m.from===from&&roster.includes(from)&&m.to===self&&typeof m.session==='string'&&m.session.length<100&&Number.isSafeInteger(m.seq)&&m.seq>0&&Number.isFinite(m.time)&&Number.isFinite(m.ttl)&&m.ttl>0&&m.ttl<=120000&&m.time<=now+2000&&now-m.time<m.ttl&&['status','offer','accept','sent','receipt','done'].includes(m.type)&&typeof m.id==='string'&&m.id.length<150&&JSON.stringify(m).length<5000;
}

// src/core/executor.mjs
// Bounded resource owners, no queued closures carrying obsolete inventory slots.
class Executor {
  constructor({now,active,limit,onError}){Object.assign(this,{now,active,limit,onError});this.pending=new Map();this.generation=0;this.cooldowns=new Map();}
  busy(resource){return [...this.pending.values()].some(p=>p.resources.includes(resource));}
  run(key,resources,guard,invoke,{timeout=8000,delay=250,observe=null,value=false,onSettle=()=>{}}={}){
    if(!this.active()||this.pending.size>=this.limit||this.pending.has(key)||(this.cooldowns.get(key)||0)>this.now()||resources.some(r=>this.busy(r))||!guard())return false;
    const p={key,resources,generation:this.generation,deadline:this.now()+timeout,settled:false,observe,value,onSettle,delay};this.pending.set(key,p);
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
        p.onSettle(result,p.error??p.result);if(p.error||result==='timeout')this.onError(key,p.error??result);
      }
    }
  }
  cancelResource(resource){for(const [key,p] of this.pending)if(!p.value&&p.resources.includes(resource))this.pending.delete(key);}
  invalidate(){this.generation++;for(const p of this.pending.values())if(p.value)p.onSettle('unknown');this.pending.clear();}
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
    write(key,value){try{return this.call('set',key,value)!==false;}catch{return false;}},
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
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,target:bot.target?.id??null,free:bot.free(),running:bot.running,items};for(const n of roster)send(n,'status',d);},
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
    const s=bot.measure();if(!matches(r.conditions,s))continue;
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
  const {p,cfg,me,exec,transport}=bot;let job=null,incoming=null,serial=0,summaryOffset=0;const completed=new Map(),nextOffer=new Map();
  const ruleFor=(item)=>bot.rule(item);
  const signature=i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''});
  const count=i=>(p.c.items??[]).reduce((n,x)=>n+(x&&x.name===i.name&&(x.level??0)===i.level&&(x.stat_type??'')===i.stat_type&&(x.p??'')===i.p&&(x.title??'')===i.title?(x.q??1):0),0);
  const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<300&&distance(p.c,h)<300?e:null;};
  const safeItem=i=>i&&typeof i.name==='string'&&/^[a-zA-Z0-9_]+$/.test(i.name)&&Number.isInteger(i.level)&&i.level>=0&&i.level<100&&['stat_type','p','title'].every(k=>typeof i[k]==='string'&&i[k].length<161);
  function capacity(i){const rule=ruleFor(i);if(!rule||protectedItem(i))return 0;const min=me.role==='merchant'?cfg.merchant.minFreeSlots:cfg.farming.freeSlots;if(bot.free()<=min)return 0;return Math.max(0,Math.min(rule.targetCount,rule.maxCount)-count(i));}
  function receive(from,m){
    const d=m.data;if(!d||typeof d!=='object')return;
    if(m.type==='offer'){
      if(job||incoming||bot.journal||exec.busy('inventory')||bot.inventoryBlocked||completed.has(m.id)||!near(from)||!safeItem(d.item)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>1000000)return;
      if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.pickup))return;
      const quantity=Math.min(d.quantity,capacity(d.item),cfg.merchant.maxDelivery);if(quantity<1)return;
      incoming={id:m.id,from,session:m.session,item:d.item,quantity,before:count(d.item),until:Date.now()+cfg.general.messageTtlMs};
      // Persist BEFORE acknowledgement; a restart cannot safely infer a retry.
      bot.beginValue({kind:'receive',...incoming});transport.send(from,'accept',{quantity},m.id);
    }else if(m.type==='accept'&&job&&job.state==='offered'&&m.id===job.id&&from===job.to&&m.session===job.session){
      if(!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>job.quantity)return;
      job.quantity=d.quantity;job.state='accepted';
    }else if(m.type==='sent'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session){incoming.sent=true;}
    else if(m.type==='receipt'&&job&&m.id===job.id&&from===job.to&&m.session===job.session&&d.quantity===job.quantity){job.receipt=true;}
    else if(m.type==='done'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session&&incoming.observed){completed.set(m.id,Date.now());incoming=null;bot.endValue('confirmed');}
  }
  function poll(allowOffer=true){
    const now=Date.now();for(const [id,t] of completed)if(now-t>120000)completed.delete(id);
    for(const [id,t] of nextOffer)if(t<now)nextOffer.delete(id);
    if(incoming){
      if(count(incoming.item)>=incoming.before+incoming.quantity){incoming.observed=true;if(now-(incoming.lastReceipt??0)>1500){incoming.lastReceipt=now;transport.send(incoming.from,'receipt',{quantity:incoming.quantity},incoming.id);}}
      if(now>incoming.until){bot.endValue('unknown');incoming=null;}
    }
    if(job){
      if(job.state==='sent'&&count(job.item)<=job.before-job.quantity&&job.receipt){transport.send(job.to,'done',{},job.id);completed.set(job.id,now);job=null;bot.endValue('confirmed');return;}
      if(now>job.until){if(job.state==='sent'||job.state==='accepted')bot.endValue('unknown');nextOffer.set(job.to,now+10000);job=null;return;}
      if(job.state==='accepted'&&!bot.inventoryBlocked){
        const j=job;
        const guard=()=>bot.running&&near(j.to)&&!incoming&&fingerprint(p.c.items[j.slot])===j.fingerprint&&transferable(p.c.items,j.slot,ruleFor(p.c.items[j.slot]))>=j.quantity;
        if(!guard()){bot.reason='Lieferung verändert; keine Übergabe';return;}
        exec.run('send',['inventory'],guard,()=>{
          bot.beginValue({kind:'send',...j});j.state='sent';
          // Message never claims the transfer succeeded. Receipt checks inventory.
          transport.send(j.to,'sent',{},j.id);
          return p.call('send_item',j.to,j.slot,j.quantity);
        },{value:true,observe:()=>job!==j&&completed.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:state=>{if(state==='unknown'&&job===j){bot.endValue('unknown');job=null;}}});
      }
      return;
    }
    if(!allowOffer||incoming||bot.inventoryBlocked||!bot.running)return;
    if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.supply))return;
    for(let slot=0;slot<p.c.items.length;slot++){
      const item=p.c.items[slot];if(!item||protectedItem(item))continue;
      const r=ruleFor(item);if(r?.action!=='send'||!r.recipient||r.recipient===me.name||nextOffer.has(r.recipient))continue;
      const quantity=Math.min(transferable(p.c.items,slot,r),cfg.merchant.maxDelivery);if(quantity<1)continue;
      const peer=transport.fresh(r.recipient);if(!near(r.recipient)||!peer)continue;
      job={id:bot.session+':'+(++serial),state:'offered',to:r.recipient,session:peer.session,slot,item:signature(item),fingerprint:fingerprint(item),quantity,before:count(signature(item)),until:now+Math.min(r.ttlMs,cfg.general.messageTtlMs)};
      nextOffer.set(r.recipient,now+5000);transport.send(job.to,'offer',{item:job.item,quantity},job.id);break;
    }
  }
  function travel(){
    if(me.role!=='merchant'||!cfg.merchant.enabled||job||incoming||bot.inventoryBlocked)return;
    for(const [name] of transport.peers){const h=transport.fresh(name);if(!h?.running||h.rip||h.realm!==p.realm())continue;
      const demand=(h.items??[]).some(x=>cfg.merchant.supply&&x.need>0&&p.c.items.some(i=>i?.name===x.item&&ruleFor(i)?.action==='send'&&ruleFor(i).recipient===name&&variantCount(p.c.items,i)>ruleFor(i).keep+ruleFor(i).teamReserve));
      const pickup=cfg.merchant.pickup&&(h.items??[]).some(x=>x.to===me.name&&x.surplus>0);
      if((demand||pickup)&&(!samePlace(p.c,h)||distance(p.c,h)>200)){bot.reason='Lieferweg zu '+name;bot.movement.go({...h,radius:120},'logistics');return;}
    }
  }
  return {receive,poll,travel,get reserved(){return !!(job||incoming);},
    summary(){const rules=cfg.items.filter(r=>r.enabled&&(r.role==='all'||r.role===me.role)&&(!r.character||r.character===me.name));const unique=[...new Set(rules.map(r=>r.item))];const names=unique.slice(summaryOffset,summaryOffset+25);summaryOffset=(summaryOffset+25)%Math.max(1,unique.length);return names.map(name=>{const item=p.c.items.find(i=>i?.name===name)??{name,level:0};const r=ruleFor(item);const n=count(signature(item));return {item:name,need:r?Math.max(0,r.targetCount-n):0,surplus:r?.action==='send'?Math.max(0,n-r.keep-r.teamReserve):0,to:r?.action==='send'?r.recipient:''};});},
    close(){if(incoming||job?.state==='sent'||job?.state==='accepted')bot.endValue('unknown');job=null;incoming=null;}
  };
}

// src/combat/farmer.mjs
function createFarmer(bot){
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastLoot=0,lastTravel=0;
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
    if(cfg.farming.loot&&!bot.inventoryBlocked&&!bot.logistics.reserved&&bot.free()>cfg.farming.freeSlots&&now-lastLoot>=cfg.farming.lootEveryMs){lastLoot=now;exec.run('loot',['inventory'],()=>bot.free()>cfg.farming.freeSlots,()=>p.call('loot'),{delay:cfg.farming.lootEveryMs});}
    if(me.role==='merchant'){bot.reason=bot.inventoryBlocked?'Inventar ungeklärt':'Merchant bereit';return;}
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
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},()=>p.call('attack',bot.entity(target.id)),{delay:100});
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
  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()]]){const b=doc.createElement('button');b.textContent=label;b.onclick=action;node.append(b);}
  doc.body.append(node);return {render(){status.textContent=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;},remove(){node.remove();}};
}

// src/main.mjs
function install(root){
  root.ALBot?.dispose?.();
  const p=createPorts(root),now=()=>Date.now();
  function validate(value){
    const errors=validateSchema(LIVE_DESCRIPTOR.schema,value);if(errors.length)return errors;
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
  let cfg;try{cfg=parseData(JSON.stringify(root.ALBotConfig));const errors=validate(cfg);if(errors.length)throw Error(errors.join('; '));}catch(e){p.log('Konfiguration ungültig: '+e.message);root.ALBot={version:VERSION,status:()=>({state:'invalid',reason:e.message})};return;}
  const me=cfg.characters.find(c=>c.name===p.c?.name&&c.enabled);
  if(!me){p.log('Eigenen Namen zuerst in der Werkstatt aktivieren.');root.ALBot={version:VERSION,status:()=>({state:'unconfigured'})};return;}
  const team=cfg.characters.filter(c=>c.enabled&&c.group===me.group),farmers=team.filter(c=>c.role==='farmer').map(c=>c.name).sort();
  const key='albot:live-a:'+me.name+':checkpoint';let timer=null,generation=0,disposed=false,lastEconomy=0,lastPlanning=0,lastHeartbeat=0,reportText='',reportTime=0,panel;
  const stored=p.read(key),journal=stored?.journal??null;
  const bot={p,cfg,me,session:me.name+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8),running:false,reason:'Bereit für Live A',target:null,teamNames:team.map(c=>c.name),farmers,leader:cfg.party.leader||farmers[0]||me.name,journal,inventoryBlocked:!!journal,
    report(message){if(message!==reportText||now()-reportTime>10000){reportText=message;reportTime=now();p.log(message);}},
    free(){return p.c.items?.filter(i=>!i).length??0;},count(name){return (p.c.items??[]).reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);},
    entity(id){if(id===me.name)return p.c;const e=p.entities[id]??Object.values(p.entities).find(e=>e.name===id);return e?{...e,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}:null;},
    monsters(){return Object.entries(p.entities).filter(([,e])=>e.type==='monster'&&!e.dead&&!e.rip&&e.hp>0).map(([id,e])=>({...e,id:e.id??id,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}));},
    allies(){return bot.teamNames.map(n=>bot.entity(n)).filter(e=>e&&samePlace(p.c,e));},
    targets(){return me.farmTargets.length?me.farmTargets:cfg.farming.targets;},
    allowed(e){if(!e||e.type!=='monster'||e.dead||e.rip||e.hp<=0||e.invincible||!samePlace(p.c,e)||!bot.targets().includes(e.mtype))return false;if(cfg.farming.avoidOthers&&e.target&&!bot.teamNames.includes(e.target))return false;const threats=Object.values(p.entities).filter(x=>x.type==='monster'&&x.hp>0&&bot.teamNames.includes(x.target)).length;return !!e.target||threats<cfg.farming.maxAggro;},
    rule(i){return chooseRule(cfg.items,i,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});},
    consumable(i){if(protectedItem(i))return false;const r=bot.rule(i);return !r||(r.action==='consume'&&variantCount(p.c.items,i)>r.keep+r.teamReserve);},
    canConsumeImplicit(name){if(bot.inventoryBlocked||bot.logistics?.reserved)return false;const first=p.c.items.find(i=>i?.name===name);return !!first&&bot.consumable(first);},
    beginValue(j){if(bot.journal)throw Error('Andere Inventaraktion offen');bot.journal={...j,at:now()};if(!p.write(key,{journal:bot.journal})){bot.inventoryBlocked=true;throw Error('Checkpoint konnte nicht gespeichert werden');}},
    endValue(result){if(result==='confirmed'){bot.journal=null;p.write(key,{journal:null});}else {bot.inventoryBlocked=true;bot.reason='Inventaraktion ungeklärt: Bestand prüfen';if(cfg.general.pauseOnUnknown&&bot.running)bot.pause(bot.reason);}},
    measure(){return {hpRatio:p.c.hp/p.c.max_hp,mpRatio:p.c.mp/p.c.max_mp,freeSlots:bot.free(),gold:p.c.gold,enemyCount:bot.monsters().filter(e=>distance(p.c,e)<p.c.range).length,map:p.c.map,rip:!!p.c.rip,task:me.role==='merchant'?'supply':'farm',count:bot.count};}
  };
  const exec=new Executor({now,active:()=>bot.running,limit:cfg.general.maxPending,onError:(key,e)=>bot.report(key+': '+(e?.reason??e?.message??e))});bot.exec=exec;
  bot.movement=createMovement(bot);bot.transport=createTransport(bot);bot.logistics=createLogistics(bot);bot.skills=createSkills(bot);bot.farmer=createFarmer(bot);
  const cleanup=[];
  const inviteAllowed=name=>bot.running&&cfg.party.enabled&&name===bot.leader&&bot.teamNames.includes(name)&&!p.c.party;
  cleanup.push(p.hook('on_party_invite',name=>{if(inviteAllowed(name))exec.run('party',['party'],()=>inviteAllowed(name),()=>p.call('accept_party_invite',name),{delay:3000});}));
  cleanup.push(p.hook('on_party_request',name=>{if(bot.running&&cfg.party.enabled&&me.name===bot.leader&&farmers.includes(name))exec.run('party',['party'],()=>bot.running,()=>p.call('accept_party_request',name),{delay:3000});}));
  function publish(){try{p.call('set_message',(bot.running?'ALBot ':'PAUSE ')+bot.reason.slice(0,50));}catch{}panel?.render();}
  function halt(reason){bot.running=false;generation++;clearTimeout(timer);timer=null;bot.movement.stop();exec.invalidate();bot.logistics.close();bot.target=null;bot.reason=reason;publish();bot.report(reason);}
  bot.pause=(reason='Pause')=>halt(reason);
  function tick(gen){if(disposed||!bot.running||gen!==generation)return;try{
    if(!p.c||!p.G){bot.reason='Spielzustand fehlt';return;}
    exec.poll();bot.movement.poll();
    if(!bot.running)return;
    if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.transport.heartbeat();}
    const economyDue=now()-lastEconomy>=cfg.general.economyTickMs;if(economyDue)lastEconomy=now();bot.logistics.poll(economyDue);
    if(!bot.running)return;
    bot.farmer.tick();
    if(now()-lastPlanning>=cfg.general.planningTickMs){lastPlanning=now();bot.logistics.travel();if(cfg.party.enabled&&me.name===bot.leader)for(const name of farmers){const e=bot.entity(name);if(name!==me.name&&(!e||e.party!==p.c.party||!p.c.party))exec.run('invite:'+name,['party'],()=>bot.running,()=>p.call('send_party_invite',name),{delay:10000});}}
    publish();
  }catch(e){bot.pause('Fehler: '+(e.message??e));bot.report(bot.reason);}finally{if(bot.running&&gen===generation)timer=root.setTimeout(()=>tick(gen),cfg.general.combatTickMs);}}
  const api={version:VERSION,schemaId:LIVE_DESCRIPTOR.schemaId,
    start(){
      if(disposed)return false;if(bot.running)return true;
      const deny=reason=>{bot.reason=reason;publish();bot.report(reason);return false;};
      if(me.class!=='auto'&&me.class!==p.c.ctype)return deny('Konfigurierte Klasse stimmt nicht');
      if(me.region+me.server!==p.realm())return deny('Falscher Realm: erwartet '+me.region+me.server);
      if(cfg.general.transport==='ipc'&&!p.ipc)return deny('Lokale IPC nicht verfügbar');
      if(bot.inventoryBlocked&&cfg.general.pauseOnUnknown)return deny('Offene Inventaraktion zuerst abgleichen');
      bot.running=true;bot.reason='Start';generation++;tick(generation);return bot.running;
    },
    pause:()=>halt('Pause'),stop:()=>halt('STOP'),
    status:()=>({version:VERSION,profile:cfg.general.name,running:bot.running,environment:p.headless?'headless':'browser',ipc:p.ipc,name:me.name,role:me.role,reason:bot.reason,target:bot.target?.id??null,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,journal:bot.journal?structuredClone(bot.journal):null}),
    acknowledgeInventory(){if(bot.running)throw Error('Zuerst pausieren und tatsächlichen Bestand prüfen');if(!p.write(key,{journal:null}))throw Error('Speichern fehlgeschlagen');bot.journal=null;bot.inventoryBlocked=false;bot.reason='Inventar manuell abgeglichen';publish();},
    dispose(){if(disposed)return;halt('Entladen');disposed=true;bot.transport.close();cleanup.splice(0).forEach(f=>f());panel?.remove();}
  };
  root.ALBot=api;panel=createPanel(bot,api);cleanup.push(p.hook('on_destroy',()=>api.dispose()));
  if(JSON.stringify(cfg).length<16000)p.write(key+':config',cfg);
  p.log(VERSION+' · '+(p.headless?'Headless':'Browser')+' · '+me.role+' · Live A noch ausstehend');publish();if(cfg.general.autostart)api.start();return api;
}

install(root);
})(globalThis);