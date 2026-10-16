// Phase 5 shadow-only observed stock delta telemetry. A reduction in held
// potions MAY be consumption, delivery, sale or another inventory change.
// Never treat it as a confirmed consumption receipt or a delivery permit.
export function supplyRunwayDelta(previous,current,{
 now=Date.now(),realm,ttlMs=10000,minWindowMs=2000
}={}){
 const unknown=reason=>({valid:false,reason,authority:'none',mode:'shadow-only'});
 const good=p=>p&&p.running===true&&!p.rip&&
  p.realm===realm&&typeof p.name==='string'&&p.name.length>0&&
  typeof p.session==='string'&&p.session.length>0&&
  !p.journal&&!p.inventoryBlocked&&!p.reserved&&!p.lifecycleChanging&&
  Number.isFinite(p.received)&&p.received>0&&p.received<=now&&
  p.potions&&['hpot0','mpot0'].every(k=>Number.isSafeInteger(p.potions[k])&&p.potions[k]>=0&&p.potions[k]<=1e7);
 if(!good(current)||!good(previous)||current.name!==previous.name||
    current.session!==previous.session)return unknown('unverified-peer-or-session');
 const elapsed=current.received-previous.received;
 if(!Number.isFinite(elapsed)||elapsed<minWindowMs||elapsed>300000||
    now-current.received>ttlMs)return unknown('stale-or-short-interval');
 const records={};
 for(const item of ['hpot0','mpot0']){
  const before=previous.potions[item],after=current.potions[item],delta=before-after;
  if(delta<=0){
   records[item]={item,status:delta===0?'no-depletion':'replenished',
    observedDecrease:0,remainingSeconds:null};continue;
  }
  const perSecond=delta/(elapsed/1000);
  records[item]={item,status:'observed-net-decrease',observedDecrease:delta,
   perSecond,remainingSeconds:perSecond>0?Math.min(604800,Math.floor(after/perSecond)):null};
 }
 return {valid:true,authority:'none',mode:'shadow-only',owner:current.name,
  session:current.session,realm,windowMs:elapsed,at:current.received,
  records,reason:'net-stock-delta-is-not-proven-consumption'};
}
export function createSupplyForecast(bot){
 const history=new Map(),latest=new Map();
 const {p}=bot;
 function tick(){
  if(bot.me?.role!=='merchant')return;
  const now=Date.now(),realm=p.realm(),names=(bot.farmers??[]).slice(0,8);
  for(const name of names){
   const peer=bot.transport?.fresh?.(name);
   if(!peer||peer.realm!==realm||!peer.running||peer.rip||
      peer.journal||peer.inventoryBlocked||peer.reserved||peer.lifecycleChanging||
      !Number.isFinite(peer.received)||peer.received>now||
      now-peer.received>Math.min(30000,bot.cfg.general?.messageTtlMs??10000)){
    history.delete(name);latest.delete(name);continue;
   }
   const before=history.get(name);
   if(before&&before.session!==peer.session){
    history.delete(name);latest.delete(name);
   }else if(before&&peer.received>before.received){
    const result=supplyRunwayDelta(before,peer,{
     now,realm,ttlMs:Math.min(30000,bot.cfg.general?.messageTtlMs??10000)
    });
    if(result.valid)latest.set(name,result);
    else latest.delete(name);
   }
   if(!before||peer.received>before.received||before.session!==peer.session)
    history.set(name,{name:peer.name,session:peer.session,realm:peer.realm,
     running:peer.running,rip:peer.rip,journal:peer.journal,
     inventoryBlocked:peer.inventoryBlocked,reserved:peer.reserved,
     lifecycleChanging:peer.lifecycleChanging,received:peer.received,
     potions:{hpot0:peer.potions?.hpot0,mpot0:peer.potions?.mpot0}});
  }
  for(const name of [...history.keys()])if(!names.includes(name)){
   history.delete(name);latest.delete(name);
  }
  for(const [name,row] of latest)if(now-row.at>60000)latest.delete(name);
 }
 return {tick,status:()=>({mode:'shadow-only',authority:'none',
  recipients:[...latest.values()].slice(0,8).map(r=>({
   owner:r.owner,session:r.session,realm:r.realm,at:r.at,
   windowMs:r.windowMs,records:r.records})),executable:false}),
  close(){history.clear();latest.clear();}};
}
