// Conservative 24-hour worst-case exposure budget for autonomous mutations.
// Never replace the existing hourly, goal-specific or user-rule budgets.
export const MUTATION_RISK_WINDOW_MS=86400000;
export function mutationRiskLimit(item,meta,globalLossBudget){
 const classLimit=meta?.type==='ring'||meta?.type==='earring'?20000:
   meta?.type==='weapon'||meta?.wtype?100000:50000;
 return Math.max(0,Math.min(classLimit,Number.isFinite(globalLossBudget)?
   Math.max(0,globalLossBudget):0));
}
export function mutationRiskAllowed(charges,key,loss,limit){
 if(typeof key!=='string'||key.length<1||key.length>1024||
   !Number.isFinite(loss)||loss<=0||!Number.isFinite(limit)||
   !Number.isFinite(charges?.[key]??0)||charges?.[key]<0)return false;
 return (charges?.[key]??0)+loss<=limit;
}
