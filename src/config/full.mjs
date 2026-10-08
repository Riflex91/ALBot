import {P3P4_DESCRIPTOR} from './p3p4.mjs';
import {SUPPORTED_SKILLS} from './live-a.mjs';
export const FULL_SKILLS=[...SUPPORTED_SKILLS,'burst','cburst','mshield','aether_shield','cleansing_light','guardians_oath','beacon_of_resolve','mluck','mcourage','mfrenzy','massproduction','massproductionpp','massexchange','massexchangepp'];
export const FULL_DESCRIPTOR=structuredClone(P3P4_DESCRIPTOR);
FULL_DESCRIPTOR.schemaId='albot.full/v1';FULL_DESCRIPTOR.schema.title='ALBot · Vollbetrieb';
const bool=(title,value=false)=>({type:'boolean',title,default:value});
const number=(title,value,minimum=0,maximum=1000000000)=>({type:'integer',title,default:value,minimum,maximum});
Object.assign(FULL_DESCRIPTOR.schema.properties.general.properties,{testLogging:bool('Fortlaufendes Testlog schreiben',true)});
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
