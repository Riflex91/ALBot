import {DESCRIPTOR} from '../../editor/lib/schema.mjs';
import {SUPPORTED_SKILLS} from './live-a.mjs';
export const INTEGRATION_DESCRIPTOR=structuredClone(DESCRIPTOR);
INTEGRATION_DESCRIPTOR.schemaId='albot.live-c/v1';
INTEGRATION_DESCRIPTOR.schema.title='ALBot · Live C';
function omitC(schema,keys){for(const key of keys)delete schema.properties[key];schema.required=schema.required.filter(k=>!keys.includes(k));}
omitC(INTEGRATION_DESCRIPTOR.schema.properties.general,['autoUpdate','updateChannel']);
omitC(INTEGRATION_DESCRIPTOR.schema.properties.items.items,['recipe']);
omitC(INTEGRATION_DESCRIPTOR.schema.properties.production,['autonomy','strategy','fallbackKillsPerHour','goldPerHour','travelSpeed','helperMaxPrice','gearTargets']);
omitC(INTEGRATION_DESCRIPTOR.schema.properties.merchant,['marketHistory','marketHistoryTtlMs','serviceSliceMs']);
INTEGRATION_DESCRIPTOR.schema.properties.general.properties.messageTtlMs.minimum=6000;
// Additive optional fields keep already exported Live-C profiles loadable.
INTEGRATION_DESCRIPTOR.schema.properties.merchant.required=INTEGRATION_DESCRIPTOR.schema.properties.merchant.required.filter(k=>!['partialBank','partialBankMaxStack'].includes(k));
INTEGRATION_DESCRIPTOR.schema.properties.merchant.properties.bankGold.title='Goldbestand bei Bankbesuchen ausgleichen';
INTEGRATION_DESCRIPTOR.schema.properties.skills.items.properties.skill.enum=SUPPORTED_SKILLS;
INTEGRATION_DESCRIPTOR.schema.properties.skills.items.properties.skill.default='supershot';
