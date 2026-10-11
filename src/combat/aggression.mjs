// The game's monster definition is authoritative for autonomous hostility.
// A live target/aggro counter may be created by player attacks or taunts;
// it does not prove that a monster attacks unprovoked.
export function isNaturallyAggressive(G,monster){
 const kind=monster?.mtype??monster?.type;
 const meta=kind&&G?.monsters?.[kind];
 return meta?.aggro===true||(typeof meta?.aggro==='number'&&Number.isFinite(meta.aggro)&&meta.aggro>0);
}
export function isOwnAggressiveThreat(G,monster,name){
 return isNaturallyAggressive(G,monster)&&monster?.target===name&&monster?.hp>0&&!monster?.dead;
}
