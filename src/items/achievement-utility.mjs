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

// Only confirmed absence in a live, selected, same-realm Farmer can
// authorize automatic Tracktrix delivery. An unknown heartbeat MUST NOT.
export function trackerDeliveryNeed(peer,realm,{reserve=4}={}){
 return !!peer&&peer.running===true&&!peer.rip&&peer.realm===realm&&
   peer.achievementCarrier===null&&peer.inventoryBlocked===false&&
   !peer.journal&&Number.isSafeInteger(peer.free)&&
   peer.free>reserve?1:0;
}
// Preserve the Merchant's own tracker if it has no Super Computer. A
// duplicate is surplus, and an available Super Computer replaces Tracktrix.
export function trackerMerchantKeep(items){
 return carriedAchievementCarrier(items)==='tracker'?1:0;
}
