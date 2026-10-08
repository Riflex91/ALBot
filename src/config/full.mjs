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
 collectGold:bool('Farmer-Gold oberhalb ihrer Reserven abholen'),goldTransferMax:number('Gold je bestätigter Übergabe',100000,1),goldCollectBelow:number('Goldabholung erst ab Überschuss',10000,1),
 bankWorkspace:number('Freie Bankplätze je Pack anstreben',2,0,42),bankReclaim:bool('Bei Bankdruck explizit verkäuflichen Bestand zum NPC freigeben')
});
Object.assign(FULL_DESCRIPTOR.schema.properties.party.properties,{gearSynergy:bool('Ausrüstung und Klassenkombination bei Teamwahl berücksichtigen',true),advancedSkills:bool('Situationsabhängige Paladin-/Mage-Fähigkeiten',true)});
Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{
 autoGear:bool('Bekannte Ausrüstung bis zum konfigurierten Level verbessern'),autoGearMaxLevel:number('Automatische Gear-Zielgrenze',3,0,99),autoGearBudget:number('Budget je automatischem Gearziel',100000),
 autoGearItems:{type:'array',title:'Erlaubte Items für automatische Gearziele',items:{type:'string',minLength:1,maxLength:160},maxItems:2000,uniqueItems:true,default:['helmet','coat','pants','shoes','gloves','bow','staff','sword','blade','shield']}
});
Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{questTargets:bool('Sichere Monsterhunt-Ziele vorübergehend als Teamziel zulassen',true)});
for(const section of ['general','merchant','party','production','world'])FULL_DESCRIPTOR.schema.properties[section].required=Object.keys(FULL_DESCRIPTOR.schema.properties[section].properties);
FULL_DESCRIPTOR.schema.properties.skills.items.properties.skill.enum=FULL_SKILLS;

// Optional additions preserve full/v1 profiles; defaults are applied on import.
Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{autoTargets:bool('Farmmonster automatisch aus öffentlichen Spawns auswählen',true),elixirs:bool('Klassen-Elixiere beschaffen und erneuern',true),switchImprovement:{type:'number',title:'Mindestverbesserung für Standortwechsel',default:.2,minimum:0,maximum:2},planHoldMs:number('Farmplan mindestens halten (ms)',60000,1000,3600000)});
Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{optimizeGear:bool('Gearalternativen und Ziellevel wirtschaftlich auswählen',true),autoDisposition:bool('Ungeregelte ungeschützte Items wirtschaftlich einordnen',true),autoSellMaxValue:number('Automatischer NPC-Verkauf höchstens Itemwert',100,0,1000000),farmConfidence:{type:'string',title:'Farmzeitbudget',enum:['mean','p90'],default:'p90'}});
Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{marketMinSamples:number('Unabhängige Marktanbieter für Preisreferenz',3,1,20),mluckTravel:bool('Für benötigte Mluck-Erneuerung sicher anreisen',true)});
Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{autoHop:bool('Serverwechsel nach geprüftem Standortdruck',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.skills.items.properties,{minTargets:number('Mindestzahl Ziele',2,1,20),minInjured:number('Mindestzahl verletzte Mitglieder',2,1,20),hpThreshold:{type:'number',title:'HP-Schwelle für Heilung/Schutz',default:.7,minimum:0,maximum:1},manaBudget:{type:'number',title:'Maximaler MP-Anteil für Burst',default:.2,minimum:.01,maximum:1}});

Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{adaptivePull:bool('Pullgröße aus tatsächlichen Kämpfen lernen',true),pullHp:{type:'number',title:'HP-Bereitschaft vor neuem Pull',default:.8,minimum:.1,maximum:1},pullMp:{type:'number',title:'MP-Bereitschaft vor neuem Pull',default:.5,minimum:0,maximum:1},potionUtilization:{type:'number',title:'Mindestnutzung eines Tranks außerhalb Notfall',default:.65,minimum:0,maximum:1},orbit:bool('Kampfbewegung am Farmanker halten',true)});

Object.assign(FULL_DESCRIPTOR.schema.properties.merchant.properties,{townTravel:bool('Town und Laufen nach Reisezeit vergleichen',true),townMinSavingsMs:number('Mindestzeitgewinn durch Town (ms)',3000,1000,300000),servicePositionError:number('Maximale Unsicherheit eines Serviceziels (Pixel)',70,10,300)});
Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{orbitRadius:number('Maximaler Orbitabstand vom Farmanker',220,50,1000),knowledgeFreshMs:number('Lernwissen vollständig frisch (ms)',21600000,1000,604800000)});

Object.assign(FULL_DESCRIPTOR.schema.properties.production.properties,{materialPreference:{type:'number',title:'Materialnutzen relativ zu normalem Farmen',default:1.25,minimum:0,maximum:100},materialXpPerGold:{type:'number',title:'EXP-Nutzen je Goldwert des Materialziels',default:10,minimum:0,maximum:100000}});
Object.assign(FULL_DESCRIPTOR.schema.properties.world.properties,{questPreference:{type:'number',title:'Nutzengewicht für Monsterhunt',default:1.1,minimum:0,maximum:100}});

FULL_DESCRIPTOR.schema.properties.skills.items.properties.maxTargets.default=5;
Object.assign(FULL_DESCRIPTOR.schema.properties.farming.properties,{potionCarryMax:number('Gemeinsame HP-/MP-Trank-Obergrenze je Farmer',10000,1,1000000)});
