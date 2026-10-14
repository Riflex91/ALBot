import {P3P4_DESCRIPTOR} from './p3p4.mjs';

import {SUPPORTED_SKILLS} from './live-a.mjs';

export const FULL_SKILLS=[...SUPPORTED_SKILLS,'burst','cburst','mshield','aether_shield','cleansing_light','guardians_oath','beacon_of_resolve','mluck','mcourage','mfrenzy','massproduction','massproductionpp','massexchange','massexchangepp','agitate'];

export const FULL_DESCRIPTOR=structuredClone(P3P4_DESCRIPTOR);

FULL_DESCRIPTOR.schemaId='albot.full/v1';FULL_DESCRIPTOR.schema.title='ALBot · Vollbetrieb';

const bool=(title,value=false)=>({type:'boolean',title,default:value});

const number=(title,value,minimum=0,maximum=1000000000)=>({type:'integer',title,default:value,minimum,maximum});

FULL_DESCRIPTOR.schema.properties.general.properties.pauseOnUnknown={type:'boolean',title:'Legacy-Pausenoption (Fehler werden protokolliert; Wertaktionen bleiben gesperrt)',default:false};

Object.assign(FULL_DESCRIPTOR.schema.properties.general.properties,{testLogging:bool('Fortlaufendes Testlog schreiben',true),transferIntervalMs:number('Neue Übergabe frühestens nach (ms)',250,250,10000)});

Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{
 budgetMode:{type:'string',title:'Budgetmodus',enum:['bounded','account-loss'],default:'bounded'},
 accountLossWindowMs:number('Zeitfenster für rapiden Accountgoldverlust (ms)',900000,60000,3600000),
 offlineGoldBalances:{type:'array',title:'Bekannte Goldstände aktuell offline befindlicher eigener Charaktere',default:[],maxItems:128,items:{type:'object',additionalProperties:false,properties:{name:{type:'string',title:'Charakter',default:'',maxLength:80},gold:number('Gold',0,0,Number.MAX_SAFE_INTEGER)}}},

 collectGold:bool('Gesamten Farmer-Goldüberschuss oberhalb der Reserve abholen'),goldTransferMax:number('Legacy-Goldlimit (ignoriert: gesamter Überschuss je Übergabe)',100000,1),goldCollectBelow:number('Goldabholung erst ab Überschuss',10000,1),

 bankWorkspace:number('Freie Bankplätze je Pack anstreben',2,0,42),bankReclaim:bool('Bei Bankdruck explizit verkäuflichen Bestand zum NPC freigeben')

});

Object.assign(FULL_DESCRIPTOR.schema.properties.party.properties,{gearSynergy:bool('Ausrüstung und Klassenkombination bei Teamwahl berücksichtigen',true),advancedSkills:bool('Situationsabhängige Paladin-/Mage-Fähigkeiten',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{



 progressionAdvice:bool('Offiziellen Progression Guide als unverbindliche Planungsquelle nutzen',true),autoGear:bool('Bekannte Ausrüstung bis zum konfigurierten Level verbessern'),autoGearMaxLevel:number('Automatische Gear-Zielgrenze',8,0,99),autoGearBudget:number('Budget je automatischem Gearziel',100000),

 autoGearItems:{type:'array',title:'Erlaubte Items für automatische Gearziele',items:{type:'string',minLength:1,maxLength:160},maxItems:2000,uniqueItems:true,default:['helmet','coat','pants','shoes','gloves','bow','staff','sword','blade','shield']}

});

// Opt-in exception for a deliberately stationary trading merchant.

// Mobile is the protective default; existing character settings retain their values.

Object.assign(FULL_DESCRIPTOR.schema.properties.characters.items.properties,{

 merchantMobility:{type:'string',title:'Merchant-Bewegungsprofil',enum:['mobile','stationary'],default:'mobile','x-labels':{mobile:'Mobiler Versorger: Geschwindigkeitsverlust sperren',stationary:'Stationärer Händler: Speed gegen Luck abwägen'}}

});

FULL_DESCRIPTOR.schema.properties.characters.items.required=Object.keys(FULL_DESCRIPTOR.schema.properties.characters.items.properties);

Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{questTargets:bool('Sichere Monsterhunt-Ziele vorübergehend als Teamziel zulassen',true)});

for(const section of ['general','merchant','party','production','world'])FULL_DESCRIPTOR.schema.properties[section].required=Object.keys(FULL_DESCRIPTOR.schema.properties[section].properties);

FULL_DESCRIPTOR.schema.properties.skills.items.properties.skill.enum=FULL_SKILLS;



// Full-mode defaults for new profiles; explicit imported values stay unchanged.

FULL_DESCRIPTOR.schema.properties.merchant.properties.maxSpendPerHour.default=5000000;

FULL_DESCRIPTOR.schema.properties.merchant.properties.expandBank.default=true;

FULL_DESCRIPTOR.schema.properties.merchant.properties.bankBudget.default=1000000000;

FULL_DESCRIPTOR.schema.properties.production.properties.lossBudget.default=1000000;

// Optional additions preserve full/v1 profiles; defaults are applied on import.

Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{autoTargets:bool('Farmmonster automatisch aus öffentlichen Spawns auswählen',true),elixirs:bool('Klassen-Elixiere beschaffen und erneuern',true),switchImprovement:{type:'number',title:'Mindestverbesserung für Standortwechsel',default:.2,minimum:0,maximum:2},planHoldMs:number('Farmplan mindestens halten (ms)',60000,1000,3600000),maxCombatSeconds:number('Maximale erwartete Kampfdauer je normalem Farmgegner in Sekunden (0 = Risikoprofil)',0,0,300)});

Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{autoProfitMaxLevel:number('Maximales Level für die autonome Gewinnrechnung',5,0,12),optimizeGear:bool('Gearalternativen und Ziellevel wirtschaftlich auswählen',true),autoDisposition:bool('Ungeregelte ungeschützte Items wirtschaftlich einordnen',true),autoSellMaxValue:number('Legacy-Grenze für automatischen Verkauf normaler Items',100,0,1000000),autoGearSellMaxValue:number('Automatischer Ausrüstungsverkauf: maximaler NPC-Stückwert nach Team-/Gewinnprüfung',1000000,0,1000000),farmConfidence:{type:'string',title:'Farmzeitbudget',enum:['mean','p90'],default:'p90'}});

Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{pickupThreshold:number('Abholung starten ab teamweit übergabefähigen Inventarplätzen',30,1,126),bankExpandGoldFraction:{type:'number',title:'Bankerweiterung maximal als Anteil des aktuellen Merchant-Golds',default:.75,minimum:0,maximum:1},marketMinSamples:number('Unabhängige Marktanbieter für Preisreferenz',3,1,20),mluckTravel:bool('Für benötigte Mluck-Erneuerung sicher anreisen',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{autoHop:bool('Serverwechsel nach geprüftem Standortdruck',true)});



Object.assign(FULL_DESCRIPTOR.schema.properties.skills.items.properties,{minTargets:number('Mindestzahl Ziele',2,1,20),minInjured:number('Mindestzahl verletzte Mitglieder',2,1,20),hpThreshold:{type:'number',title:'HP-Schwelle für Heilung/Schutz',default:.7,minimum:0,maximum:1},manaBudget:{type:'number',title:'Maximaler MP-Anteil für Burst',default:.2,minimum:.01,maximum:1}});



Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{adaptivePull:bool('Pullgröße aus tatsächlichen Kämpfen lernen',true),pullHp:{type:'number',title:'HP-Bereitschaft vor neuem Pull',default:.8,minimum:.1,maximum:1},pullMp:{type:'number',title:'MP-Bereitschaft vor neuem Pull',default:.5,minimum:0,maximum:1},potionUtilization:{type:'number',title:'Mindestnutzung eines Tranks außerhalb Notfall',default:.65,minimum:0,maximum:1},orbit:bool('Kampfbewegung am Farmanker halten',true)});



Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{townTravel:bool('Town und Laufen nach Reisezeit vergleichen',true),townMinSavingsMs:number('Mindestzeitgewinn durch Town (ms)',3000,1000,300000),servicePositionError:number('Maximale Unsicherheit eines Serviceziels (Pixel)',70,10,300)});

Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{orbitRadius:number('Maximaler Orbitabstand vom Farmanker',220,50,1000),knowledgeFreshMs:number('Lernwissen vollständig frisch (ms)',21600000,1000,604800000)});



Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{materialPreference:{type:'number',title:'Materialnutzen relativ zu normalem Farmen',default:1.25,minimum:0,maximum:100},materialXpPerGold:{type:'number',title:'EXP-Nutzen je Goldwert des Materialziels',default:10,minimum:0,maximum:100000}});

Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{questPreference:{type:'number',title:'Nutzengewicht für Monsterhunt',default:1.1,minimum:0,maximum:100}});



FULL_DESCRIPTOR.schema.properties.skills.items.properties.maxTargets.default=5;

Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{potionCarryMax:number('Trank-Obergrenze je Sorte und Farmer',10000,1,1000000)});

Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{potionTeamRefill:bool('Bei 50 Tränken Teamversorgung für aktive Farmer auslösen',false),potionAlertBelow:number('Alarm bei verbleibenden Tränken je Sorte',50,0,1000),discoverOwnFarmers:bool('Eigene Online-Farmer automatisch erkennen (ALBot-Bestandsmeldung erforderlich)',true),hpPotionTarget:number('HP-Tränke je Online-Farmer (Zielbestand)',3000,0,100000),mpPotionTarget:number('MP-Tränke je Online-Farmer (Zielbestand)',300,0,100000)});



Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{skillSupplies:bool('Skill-Verbrauchsmaterial automatisch nachliefern',true),skillSupplyCount:number('Zielvorrat je Skill-Verbrauchsmaterial',20,1,100)});

Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{tokenBuy:bool('Explizite Inventarziele aus vorhandenen Token kaufen',false),tokenMaxPerPurchase:number('Token je Kauf maximal',1,1,10000),dismantle:bool('Verifizierten Verkaufsüberschuss wirtschaftlich zerlegen',false)});

Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{autoHelpers:bool('Vorhandene Scrolls/Offerings per Servervorschau wirtschaftlich vergleichen',false)});



Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{purposeAllocation:bool('Gemeinsame Zweckallokation für alle Produktionsziele',true),finiteHelpers:bool('Endliche Mehrschrittplanung mit vorhandenen Helfern',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{bossTactics:bool('Bossprofile und Gruppenbereitschaft prüfen',true),bossMaxSeconds:number('Maximale Bosskampfzeit (s)',300,10,1800),adaptiveLearning:bool('Begrenzte Strategieanpassungen aus bestätigten Ergebnissen',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{autoMarket:bool('Überschuss anhand bestätigter Marktumsätze anbieten',true),listingTtlMs:number('Automatische Angebote spätestens zurücknehmen (ms)',3600000,60000,86400000)});

FULL_DESCRIPTOR.schema.properties.general.properties.autonomousSetup={...bool('Automatischer Betrieb: Produktion, Merchant, Lernen und Bosswahl selbst steuern',true),description:'Aktiviert die unterstützten Produktionswege, Helferwahl, Tokenkäufe, Zerlegen, Bankentlastung und adaptive Teamwahl. Gold-/Verlustbudgets, Itemschutz und feste Charakterregeln bleiben verbindlich. Cloud wird separat eingerichtet.'};



FULL_DESCRIPTOR.schema.properties.production.properties.acquireBy.description="Im automatischen Betrieb werden bank, npc, market, farm, craft und exchange freigegeben. Itemschutz, Preise und Budgets bleiben verbindlich.";

FULL_DESCRIPTOR.schema.properties.world.properties.allowedBosses.description="Im automatischen Betrieb ergänzt die Runtime alle vom aktuellen Bossadapter unterstützten Gegner. Bereitschaft, Karten-/Instanzgrenzen und Mechanikprüfungen bleiben verbindlich.";


FULL_DESCRIPTOR.schema.properties.general.properties.autoRoster={...bool("Eigene Charaktere und Rollen beim Start automatisch erkennen",false),description:"Namenloses Profil: Accountliste und aktueller Realm; Charakterstarts erfolgen nur mit bewusst aktivierter Levelausgleichsrotation, belegten Levelwerten und sicheren Lifecycle-APIs. Bei mehreren Merchants ist der alphabetisch erste zustaendig."};
Object.assign(FULL_DESCRIPTOR.schema.properties.party.properties,{
 balanceFarmers:bool('Eigene Farmer mit Levelrückstand kontrolliert einwechseln',false),
 balanceLevelGap:number('Levelabstand für automatische Aufholrotation',2,1,100),
 balanceHoldMs:number('Mindestzeit zwischen Aufholwechseln (ms)',1800000,300000,86400000)
});
