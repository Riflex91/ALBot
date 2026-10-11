// Pickup preflight derives a conservative number of free inventory slots
// from authenticated peer heartbeat summaries. It is planning evidence only;
// actual transfer still requires the existing offer/accept/receipt journal.
export function planPickupCapacity(rows,{merchant,free,reserve=4,maxBatchSlots=3,known=()=>true}={}){
 const variants=new Set();
 for(const row of rows??[]){
  if(!row||row.to!==merchant||!Number.isSafeInteger(row.surplus)||row.surplus<=0)continue;
  const i=row.variant??{name:row.item,level:0,stat_type:'',p:'',title:''};
  if(!i||typeof i.name!=='string'||!i.name||!Number.isInteger(i.level)||i.level<0||!known(i))continue;
  variants.add(JSON.stringify([i.name,i.level,i.stat_type??'',i.p??'',i.title??'']));
 }
 const offers=variants.size;
 const target=offers?Math.min(42,Math.max(0,reserve)+Math.min(maxBatchSlots,offers)):0;
 return {offers,target,free,missing:Math.max(0,target-Math.max(0,free)),
  ready:offers>0&&free>=target};
}

// A cleanup must free a *whole slot*. Partial stack transfers are not a
// pickup capacity gain and could consume extra temporary workspace.
export function pickupCleanupCandidates(items,rules,spare,safe){
 const bank=[],sell=[];
 for(let slot=0;slot<(items??[]).length;slot++){
  const item=items[slot];if(!item||!safe(item))continue;
  const r=rules(item);
  if(!r||!['bank','sell'].includes(r.action)||!Number.isSafeInteger(item.q??1)||
     spare(slot,r)<(item.q??1))continue;
  if(r.action==='bank')bank.push({slot,item,rule:r});
  else sell.push({slot,item,rule:r});
 }
 return {bank,sell};
}
