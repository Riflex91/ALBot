// Tracktrix and Super Computer activate account-achievement stat bonuses
// only while present in the character's carried inventory (official guide).
// Ordinary Computer is not a documented replacement. Do not mistake a
// banked/remote utility item for a bonus activated on this Farmer.
export const ACHIEVEMENT_CARRIER_IDS=['tracker','supercomputer'];
export function isAchievementCarrier(item){
 return !!item&&ACHIEVEMENT_CARRIER_IDS.includes(item.name);
}
export function carriedAchievementCarrier(items){
 if(!Array.isArray(items))return 'unknown';
 return items.some(i=>i?.name==='supercomputer')?'supercomputer':
  items.some(i=>i?.name==='tracker')?'tracker':null;
}
