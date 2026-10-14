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

/**
 * Assign ONE carried utility item to a selected Farmer with verified missing
 * coverage. The merchant never guesses from absent/stale heartbeats. Every
 * recipient is rechecked by the normal session-bound item handoff protocol.
 */
export function carrierRecipient(farmers,fresh,realm){
 if(!Array.isArray(farmers)||typeof fresh!=='function')return null;
 const visited=new Set();
 for(const name of farmers){
  if(typeof name!=='string'||!name||visited.has(name))continue;
  visited.add(name);
  const h=fresh(name);
  if(h?.name!==name||!h.running||h.rip||h.realm!==realm||
     h.achievementCarrier!==null||h.inventoryBlocked===true||
     h.journal===true||h.reserved===true||
     !Number.isSafeInteger(h.free)||h.free<1)continue;
  return name;
 }
 return null;
}
