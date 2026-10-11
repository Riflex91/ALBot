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
// The normal keep amount is an *inventory* reserve; moving an automatically
// bankable, unreserved stack into the bank does not destroy that reserve.
// Never override a user-authored rule, explicit gear commitment or protected
// variant. A derived NPC-sale rule is never broadened.
export function pickupCleanupCandidates(items,rules,spare,safe,canBankWhole=()=>false){
 const bank=[],sell=[];
 for(let slot=0;slot<(items??[]).length;slot++){
  const item=items[slot];if(!item||!safe(item))continue;
  const r=rules(item),quantity=item.q??1;
  if(!r||!['bank','sell'].includes(r.action)||!Number.isSafeInteger(quantity)||
     quantity<1)continue;
  let rule=r,adjusted=false;
  if(r.action==='bank'&&spare(slot,r)<quantity&&
     r._autoDisposition===true&&canBankWhole(item,r,slot)){
   rule={...r,keep:0,teamReserve:0,batch:Math.max(quantity,r.batch??1)};
   adjusted=true;
  }
  if(spare(slot,rule)<quantity)continue;
  if(rule.action==='bank')bank.push({slot,item,rule,adjusted});
  else sell.push({slot,item,rule});
 }
 return {bank,sell};
}
