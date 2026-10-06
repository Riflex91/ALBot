import {DESCRIPTOR} from '../../editor/lib/schema.mjs';

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
export const LIVE_DESCRIPTOR={format:'albot-settings',formatVersion:1,schemaId:'albot.live-a/v1',schema:{type:'object',title:'ALBot · Live A',properties:{},required:[],additionalProperties:false}};
for(const [key,keys] of Object.entries(fields))LIVE_DESCRIPTOR.schema.properties[key]=pick(base[key],keys);
LIVE_DESCRIPTOR.schema.properties.general.properties.messageTtlMs.minimum=6000;
LIVE_DESCRIPTOR.schema.properties.characters={...structuredClone(base.characters),items:pick(base.characters.items,['name','enabled','class','role','group','region','server','farmTargets'])};
LIVE_DESCRIPTOR.schema.properties.skills=structuredClone(base.skills);
export const SUPPORTED_SKILLS=['hardshell','charge','taunt','warcry','huntersmark','poisonarrow','piercingshot','supershot','entangle','arcane_needle','curse','darkblessing','phaseout','invis','pcoat','mentalburst','quickstab','quickpunch','selfheal','shield_slam','purify','smash','heal','partyheal','energize','reflection','rspeed','revive','3shot','5shot','cleave','stomp','fanofknives'];
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
