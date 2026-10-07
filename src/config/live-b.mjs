import {DESCRIPTOR} from '../../editor/lib/schema.mjs';
import {LIVE_DESCRIPTOR} from './live-a.mjs';
export const ECONOMY_DESCRIPTOR=structuredClone(LIVE_DESCRIPTOR);
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
