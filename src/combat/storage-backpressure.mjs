// A soft, fresh-heartbeat backpressure signal. This controls optional NEW
// loot-producing pulls, never inventory handoff, healing or defensive combat.
// The Merchant already owns the hysteretic transition into/out of recovery.
export function farmingStoragePressure({free,reserve=4,merchant=null,realm=null}={}){
 const limit=Number.isSafeInteger(reserve)&&reserve>=0?reserve:4;
 if(!Number.isSafeInteger(free)||free<=limit)return 'FARMER_RESERVE';
 if(merchant?.running===true&&!merchant.rip&&merchant.realm===realm&&
    merchant.storagePressure===true)return 'MERCHANT_CAPACITY';
 return null;
}

// A full/pressured team should finish fights it has already engaged, but it
// must not start a new one while the Merchant is trying to clear safe slots.
export function defensiveFarmTarget(monster,teamNames){
 return !!monster?.target&&Array.isArray(teamNames)&&
    teamNames.includes(monster.target);
}
