// Phase 5: per-session, monotonic evidence from an observed inventory
// decrement after the game's potion action, not from net-stock changes.
// These receipts are still client-attested and never authorize item transfers.
export function createPotionReceipts({session,realm,now=()=>Date.now()}={}){
 const totals={hpot0:0,mpot0:0};let last=0;
 function observe(type,data){
  if(type!=='potion.consumeConfirmed'||!Object.hasOwn(totals,data?.item))return false;
  if(totals[data.item]>=10000000)return false;
  totals[data.item]++;last=now();return true;
 }
 return {observe,heartbeat:()=>({session,realm,
   hpot0:totals.hpot0,mpot0:totals.mpot0,at:last}),
  status:()=>({mode:'observed-confirmed-inventory-decrement',
   authority:'none',session,realm,totals:{...totals},last}),
  close:()=>{}};
}
export function confirmedPotionRunway(before,after,{
 now=Date.now(),realm,ttlMs=10000,minMs=10000
}={}){
 const deny=reason=>({valid:false,reason,authority:'none'});
 const valid=p=>p?.running===true&&!p.rip&&!p.journal&&
   !p.inventoryBlocked&&!p.reserved&&!p.lifecycleChanging&&
   p.realm===realm&&p.potionConsumption?.session===p.session&&
   p.potionConsumption.realm===realm&&
   Number.isFinite(p.received)&&p.received<=now&&now-p.received<=ttlMs&&
   ['hpot0','mpot0'].every(name=>
    Number.isSafeInteger(p.potionConsumption[name])&&
    p.potionConsumption[name]>=0&&
    Number.isSafeInteger(p.potions?.[name])&&p.potions[name]>=0);
 if(!valid(before)||!valid(after)||before.name!==after.name||
   before.session!==after.session)return deny('invalid-or-changed-session');
 const interval=after.received-before.received;
 if(interval<minMs||interval>300000)return deny('insufficient-or-stale-window');
 const rows={};
 for(const item of ['hpot0','mpot0']){
  const diff=after.potionConsumption[item]-before.potionConsumption[item];
  if(diff<0)return deny('counter-reversed');
  const rate=diff/(interval/1000);
  rows[item]={confirmedCount:diff,perSecond:rate,
   remainingSeconds:rate>0?Math.min(604800,
    Math.floor(after.potions[item]/rate)):null};
 }
 return {valid:true,authority:'none',mode:'client-confirmed-use',
  owner:after.name,session:after.session,at:after.received,
  windowMs:interval,rows};
}
export function proactivePotionAlarm(forecasts,farmers,{
 target={},thresholdSeconds=180,minimumCount=3
}={}){
 if(!Array.isArray(farmers)||!farmers.length||!Array.isArray(forecasts)||
    forecasts.length!==farmers.length)return {trigger:false,reason:'roster-evidence-missing'};
 for(const farmer of farmers){
  const r=forecasts.find(x=>x?.valid&&x.owner===farmer.name&&
    x.session===farmer.session);
  if(!r)return {trigger:false,reason:'consumption-window-unverified'};
 }
 for(const farmer of farmers){
  const r=forecasts.find(x=>x.owner===farmer.name);
  for(const item of ['hpot0','mpot0']){
   const row=r.rows[item];
   if(row.confirmedCount>=minimumCount&&
      Number.isFinite(row.remainingSeconds)&&
      row.remainingSeconds<=thresholdSeconds&&
      farmer.potions[item]<(target[item]??0))
    return {trigger:true,reason:'verified-consumption-runway',
     owner:farmer.name,item,remainingSeconds:row.remainingSeconds};
  }
 }
 return {trigger:false,reason:'runway-sufficient-or-no-proven-consumption'};
}
