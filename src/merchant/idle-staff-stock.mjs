// Read-only permission for banking obsolete *carried* staff after the Merchant
// has already equipped a strictly better staff. Never authorize a sale,
// destruction, upgrade or transfer of an unverified team gear candidate.
export function idleStaffBankRule({
 item,equipped,gearUse,inventoryRule,productionRule,reserved,activeGoal
}={}){
 if(item?.name!=='staff'||!Number.isSafeInteger(item.level)||
    equipped?.name!=='staff'||!Number.isSafeInteger(equipped.level)||
    equipped.level<=item.level||item.l||item.b||
    item.data!==undefined||item.p||item.title||item.stat_type||
    item.acc||item.rid||item.skin||item.v||item.special||
    gearUse?.state!=='no-gear-use'||
    inventoryRule||productionRule||
    !Number.isSafeInteger(reserved)||reserved!==0||
    activeGoal?.item===item.name)return null;
 return {enabled:true,name:'Verifizierter überschüssiger Staff',
  item:item.name,minLevel:item.level,maxLevel:item.level,
  action:'bank',batch:1,keep:0,teamReserve:0,
  maxCount:9999,goldBudget:0,lossBudget:0};
}
