import {distance,samePlace} from '../core/policy.mjs';
import {createServicePlan} from './service-plan.mjs';
import {createFairTasks} from '../core/fair-tasks.mjs';
import {planPickupCapacity,pickupCleanupCandidates} from './pickup-capacity.mjs';
// A stand may only open while idle. Native smart_move pathfinding can leave
// character.moving false for several seconds; inspect the movement owner too.
export function canOpenMerchantStand(bot){
 const {p,cfg,me,exec}=bot;
 if(me.role!=='merchant'||!cfg.merchant.stand||!bot.running||p.c.rip||bot.journal||bot.inventoryBlocked||p.c.stand||p.c.moving||p.c.c?.town||bot.movement?.order||exec.busy('movement')||exec.busy('stand'))return false;
 if([p.root?.smart,p.parent?.smart].some(s=>s?.moving||s?.searching))return false;
 if(exec.frame?.some(j=>j.resources.includes('movement')||j.resources.includes('inventory')||j.resources.includes('lifecycle')))return false;
 return (p.c.items??[]).some(i=>i&&p.G.items?.[i.name]?.stand);
}
export function createMerchant(bot){
 const {p,cfg,me,exec}=bot,e=bot.economy,tasks=createFairTasks({holdMs:cfg.merchant.taskHoldMs,starvationMs:cfg.merchant.starvationMs});
 const service=createServicePlan({holdMs:cfg.merchant.taskHoldMs,event:(type,data)=>bot.event?.(type,data)});
 let standIdleSince=null,lastPickupWarning=0,pickupStatus=null,departure=null,
  standRequestedUntil=0;
 // A pickup is admitted only after a bounded, sequential depot cycle.
 // Mutations use the existing durable journal and retain every user rule,
 // safety reservation, minimum success chance and hourly budget.
 const stages=['reconcile','materials','mutation','sale','gear','potions','capacity','ready'];
 function nextStage(){
  const previous=departure.stage;departure.stage=stages[stages.indexOf(previous)+1]??'ready';
  departure.stageAt=Date.now();
  if(departure.stage==='ready')departure.readyAt=Date.now();
  bot.event?.('merchant.departureStage',{from:previous,to:departure.stage,
    free:bot.free(),elapsedMs:Date.now()-departure.started});
 }
 function safeMaterial(item){
  const meta=p.G?.items?.[item?.name];
  if(!e.safe(item)||!meta||!(meta.type==='material'||
    Number.isSafeInteger(meta.e)&&meta.e>0)||
     item.data!==undefined||item.p||item.title||item.stat_type||
     item.acc||item.rid||item.skin||item.v||item.special)return false;
  if(bot.production?.reservedQuantity?.(item)>0)return false;
  const explicit=e.explicit(item),action=(explicit??e.rules(item))?.action;
  // Keep all manual protection; bank exchange materials until a verified
  // exchange job explicitly needs them.
  return (!explicit||explicit.action==='exchange')&&
    !['keep','send','consume','equip','sell','list',
      'upgrade','compound','craft'].includes(action);
 }
 function workStage(action){
  const choices=[];
  for(let slot=0;slot<(p.c.items??[]).length;slot++){
   const item=p.c.items[slot];if(!e.safe(item))continue;
   const rules=action==='sell'?[e.rules(item,'inventory')]:
     [e.rules(item,'production'),e.rules(item,'inventory')];
   for(const r of rules){
    if(r?.action!==action||!e.remaining(r))continue;
    if(action==='sell'&&e.spare(slot,r)<1)continue;
    if((action==='upgrade'||action==='compound')&&
      (item.level??0)>=r.targetLevel)continue;
    choices.push({slot,r,priority:(r._autoProduction?1000:0)+(r.priority??0)});
   }
  }
  choices.sort((a,b)=>b.priority-a.priority||a.slot-b.slot);
  for(const {slot,r} of choices){
   const accepted=action==='sell'?
     (r._autoDisposition===true&&(bot.market?.sellToBid?.(slot,r)??false))||
       e.npcSell(slot,r):action==='exchange'?
       bot.production?.exchange?.(slot,r):bot.production?.mutate?.(slot,r);
   if(accepted||bot.movement.order?.owner==='economy'||
      bot.journal||exec.busy('inventory')||exec.busy('economy'))return true;
  }
  return false;
 }
 function supplyBeforePickup(){
  const farmers=(bot.farmers??[]).map(name=>({name,peer:bot.transport?.fresh?.(name)}));
  if(farmers.some(({peer})=>!peer?.running||peer.rip||peer.realm!==p.realm()||
      !['hpot0','mpot0'].every(id=>Number.isSafeInteger(peer.potions?.[id])&&
        peer.potions[id]>=0&&peer.potions[id]<=100000))){
   bot.reason='Abfahrt wartet auf aktuelle HP-/MP-Trankbestände aller Farmer';
   return false;
  }
  for(const id of ['hpot0','mpot0']){
   if(departure.skipped.has(id))continue;
   const shortage=farmers.reduce((total,{peer})=>
     total+Math.max(0,3000-peer.potions[id]),0);
   const carried=e.count({name:id,level:0}),reserve=200;
   const missing=Math.max(0,shortage+reserve-carried);
   if(!missing)continue;
   // Prefer already-owned bank stock before spending gold at the NPC.
   // The bank module verifies source/destination slots and handles partial
   // withdrawal with its existing persisted checkpoint.
   const available=bot.bank?.stock?.(id,0,missing)??0;
   if(available>0&&bot.free()>cfg.merchant.minFreeSlots+1){
    const take=Math.min(available,missing);
    const retrieveRule={name:'Tourversorgung Bank '+id,item:id,action:'retrieve',
      enabled:true,batch:take,maxCount:Math.max(100000,carried+missing),
      keep:0,teamReserve:0,goldBudget:0,lossBudget:0};
    if(bot.bank?.retrieve?.({name:id,level:0},retrieveRule,take))return true;
    if(bot.bank?.pending||bot.movement.order?.owner==='economy'||
       bot.journal||exec.busy('inventory'))return true;
   }
   const meta=p.G?.items?.[id],price=meta?.g;
   const left=Math.max(0,cfg.merchant.maxSpendPerHour-(e.ledger?.spent??0));
   const gold=Math.max(0,p.c.gold-Math.max(cfg.merchant.goldReserve??0,me.goldReserve??0));
   const quantity=Number.isFinite(price)&&price>0?
     Math.min(missing,Math.max(1,cfg.merchant.maxDelivery??3000),
       Math.floor(left/price),Math.floor(gold/price)):0;
   if(quantity<1||bot.free()<=cfg.merchant.minFreeSlots){
    departure.skipped.add(id);
    bot.event?.('merchant.potionShortfall',{item:id,remaining:missing,
      reason:quantity<1?'Budget/Gold oder NPC-Preis':'Kein Inventarplatz'});
    continue;
   }
   const rule={name:'Tourversorgung '+id,item:id,action:'buy',role:'merchant',
     enabled:true,maxPrice:price,goldBudget:quantity*price,lossBudget:0,
     batch:quantity,maxCount:Math.max(100000,carried+missing),
     keep:0,teamReserve:0,targetCount:carried+missing};
   if(e.npcBuy({name:id,level:0},rule,quantity))return true;
   if(bot.movement.order?.owner==='economy'||bot.journal||
      exec.busy('inventory')||exec.busy('economy'))return true;
   // Unavailable NPC or a veto from a separate budget must be surfaced,
   // never retried forever in a tight loop.
   departure.skipped.add(id);
   bot.event?.('merchant.potionShortfall',{item:id,remaining:missing,
     reason:bot.reason||'Kauf nicht zugelassen'});
  }
  nextStage();return false;
 }
 function prepareDeparture(peer){
  if(me.role!=='merchant'||!cfg.merchant.enabled||!cfg.merchant.pickup)return true;
  const now=Date.now();
  if(departure?.stage==='ready'){
   if(now-(departure.readyAt??0)<60000)return true;
   departure=null;
  }
  if(!departure){
   departure={stage:'reconcile',started:now,stageAt:now,skipped:new Set()};
   bot.event?.('merchant.departureStage',{from:null,to:'reconcile',free:bot.free()});
  }
  if(bot.inventoryBlocked||bot.journal||bot.bank?.pending||
     bot.logistics?.reserved||bot.gold?.reserved||
     exec.busy('inventory'))return false;
  if(bot.services?.active||bot.services?.waiting){
   bot.services.interrupt();
   if(bot.services.restore())return false;
  }
  switch(departure.stage){
   case 'reconcile':
    if(bot.bank?.manageStand?.()||bot.movement.order?.owner==='economy')return false;
    if(cfg.merchant.bank&&!bot.bank?.ready?.('items0')){
     bot.reason='Depotabgleich: zur Bank fahren';
     return false;
    }
    if(bot.bank?.consolidateInventory?.()||
       bot.bank?.consolidate?.()||
       bot.bank?.consolidateAcross?.())return false;
    nextStage();return false;
   case 'materials':
    for(let slot=0;slot<p.c.items.length;slot++){
     const item=p.c.items[slot];if(!safeMaterial(item))continue;
     const q=item.q??1;
     const rule={name:'Depotmaterial '+item.name,item:item.name,
       action:'bank',batch:q,keep:0,teamReserve:0,maxActions:0,
       goldBudget:0,lossBudget:0};
     if(bot.bank?.store?.(slot,rule)||
        bot.movement.order?.owner==='economy'||bot.journal||
        exec.busy('inventory'))return false;
    }
    nextStage();return false;
   case 'mutation':
    if(workStage('exchange')||workStage('upgrade')||workStage('compound'))return false;
    nextStage();return false;
   case 'sale':
    if(workStage('sell'))return false;
    nextStage();return false;
   case 'gear':
    // Items with verified or unresolved team utility are bank reserves,
    // never arbitrary sales. Preserve direct delivery and production claims.
    for(let slot=0;slot<(p.c.items??[]).length;slot++){
     const item=p.c.items[slot],meta=p.G?.items?.[item?.name];
     if(!e.safe(item)||!meta||!(meta.upgrade||meta.compound||
       meta.wtype||['weapon','ring','earring','amulet','belt','helmet',
         'chest','pants','shoes','gloves','shield','cape','orb'].includes(meta.type))||
       e.explicit(item)||bot.production?.reservedQuantity?.(item)>0)continue;
     const gear=bot.intelligence?.gearUse?.(item);
     if(!gear||!['gear-useful','unknown'].includes(gear.state))continue;
     const rule={enabled:true,name:'Gearreserve '+item.name,
       item:item.name,action:'bank',batch:item.q??1,keep:0,
       teamReserve:0,maxCount:9999,goldBudget:0,lossBudget:0};
     if(bot.bank?.store?.(slot,rule)||bot.movement.order?.owner==='economy'||
       bot.journal||exec.busy('inventory'))return false;
    }
    nextStage();return false;
   case 'potions':
    supplyBeforePickup();return false;
   case 'capacity':{
    // Prepare a genuinely large pickup workspace rather than treating the
    // minimum 4+3 slots as the objective. Never sell protected/reserved gear
    // just to achieve the ideal. When no safe cleanup remains, depart with
    // a bounded partial load above the physical reserve.
    const reserve=Math.max(0,cfg.merchant.minFreeSlots??4);
    const ideal=Math.min(p.c.items.length-reserve,
      Math.max(20,Math.min(32,peer?.lootSlots??20)));
    if(bot.free()<ideal){
     const options=pickupCleanupCandidates(p.c.items,i=>e.rules(i),
       (slot,rule)=>e.spare(slot,rule),i=>e.safe(i),
       (item,rule)=>cfg.merchant.bank&&rule._autoDisposition===true&&
         !e.explicit?.(item)&&!e.explicit?.(item,'production')&&
         e.remaining(rule)&&(bot.production?.reservedQuantity?.(item)??0)===0);
     for(const row of [...options.bank,...options.sell]){
      const accepted=row.rule.action==='bank'?
        bot.bank?.store?.(row.slot,row.rule):e.npcSell(row.slot,row.rule);
      if(accepted||bot.movement.order?.owner==='economy'||bot.journal||
         exec.busy('inventory'))return false;
     }
    }
    if(preparePickup(peer)===false){
     // A bank that cannot safely accept/sell anything must not trap the
     // Merchant forever. Take a bounded partial pickup if there is physical
     // capacity above the four-slot working reserve.
     if(pickupStatus?.state==='blocked'&&
       bot.free()>Math.max(0,cfg.merchant.minFreeSlots??4)){
      bot.event?.('merchant.pickupPartial',{peer:peer.name,
        free:bot.free(),target:pickupStatus.target});
      nextStage();return true;
     }
     return false;
    }
    if(bot.free()<ideal)bot.event?.('merchant.pickupPartial',{
      peer:peer.name,free:bot.free(),ideal,
      reason:'Nur geschützte/reservierte oder nicht sicher verwertbare Slots verbleiben'});
    nextStage();return true;
   }
   default:return true;
  }
 }

 function preparePickup(peer){
  if(me.role!=='merchant'||!cfg.merchant.enabled||!cfg.merchant.pickup)return true;
  const reserve=cfg.merchant.minFreeSlots??4;
  const plan=planPickupCapacity(peer?.items,{merchant:me.name,free:bot.free(),reserve,
    known:i=>!!p.G?.items?.[i.name]});
  const previous=pickupStatus;
  pickupStatus={peer:peer.name,...plan,at:Date.now(),state:plan.ready?'ready':'preparing'};
  if(!plan.offers||plan.ready){
   if(plan.ready&&previous?.peer===peer.name&&previous.missing>0)
    bot.event?.('merchant.pickupReady',{peer:peer.name,free:plan.free,target:plan.target});
   return true;
  }
  bot.reason='Abholung vorbereiten: '+plan.missing+' freie Inventarplätze fehlen für '+peer.name;
  if(bot.journal||bot.inventoryBlocked||bot.gold?.reserved||bot.bank.pending||
     bot.logistics?.reserved||exec.busy('inventory'))return false;
  if(bot.services?.active||bot.services?.waiting){
   bot.services.interrupt();
   if(bot.services.restore())return false;
  }
  // Stack merging is safe before any destructive cleanup. Every other
  // action reuses economy.perform and durable per-slot value journals.
  if(bot.bank.consolidateInventory?.())return false;
  const options=pickupCleanupCandidates(p.c.items,i=>e.rules(i),
    (slot,rule)=>e.spare(slot,rule),i=>e.safe(i),
    (item,rule)=>cfg.merchant.bank&&rule._autoDisposition===true&&
      !e.explicit?.(item)&&!e.explicit?.(item,'production')&&e.remaining(rule)&&
      (bot.production?.reservedQuantity?.(item)??0)===0);
  for(const x of options.bank){
   // Persist preparation across the trip to the bank and every subsequent
   // confirmed slot release. Never start a farmer pickup from here.
   if(bot.bank.store(x.slot,x.rule)){
    pickupStatus.state='banking';pickupStatus.cleanup={slot:x.slot,
      item:x.item.name,fullStack:!!x.adjusted};
    return false;
   }
   if(bot.movement?.order?.owner==='economy'||bot.journal||exec.busy('inventory')){
    pickupStatus.state='banking';pickupStatus.cleanup={slot:x.slot,item:x.item.name};
    return false;
   }
  }
  for(const x of options.sell){
   if(e.npcSell(x.slot,x.rule)){
    pickupStatus.state='selling';pickupStatus.cleanup={slot:x.slot,item:x.item.name};
    return false;
   }
   if(bot.movement?.order?.owner==='economy'||bot.journal||exec.busy('inventory')){
    pickupStatus.state='selling';pickupStatus.cleanup={slot:x.slot,item:x.item.name};
    return false;
   }
  }
  pickupStatus.state='blocked';
  if(Date.now()-lastPickupWarning>10000){
   lastPickupWarning=Date.now();
   bot.event?.('merchant.pickupCapacity',{peer:peer.name,...plan,
      state:'blocked',reason:'Kein sicherer Ganzstapel frei; manuelle Regeln, Gear-/Produktionsreservierungen und Wertjournale bleiben geschützt'});
  }
  return false;
 }
 function activateStand(){
  // Only a verified market listing/wishlist job may request a stand.
  if(!cfg.merchant.stand||me.role!=='merchant'||p.c.rip||
    bot.inventoryBlocked||bot.journal||bot.logistics?.reserved)return false;
  standRequestedUntil=Date.now()+30000;
  if(p.c.stand)return true;
  const slot=p.c.items.findIndex(i=>i?.name==='stand0'&&!i.l&&!i.b&&
    !i.locked&&!i.data&&(i.level??0)===0);
  if(slot<0){
   const rule={enabled:true,name:'Stand für aktiven Handelsauftrag',
    item:'stand0',action:'retrieve',batch:1,maxCount:99,
    keep:0,teamReserve:0,goldBudget:0,lossBudget:0};
   return bot.bank?.retrieve?.({name:'stand0',level:0},rule,1)??false;
  }
  return exec.run('stand.open',['stand'],
    ()=>bot.running&&!p.c.rip&&!p.c.stand&&
      p.c.items[slot]?.name==='stand0'&&!bot.movement.order&&
      !bot.inventoryBlocked&&!bot.journal,
    ()=>p.call('open_stand'),{delay:3000,timeout:10000});
 }
 function standDepot(){
  if(Date.now()<standRequestedUntil)return false;
  // An actionable, user-authored stand rule takes precedence over depot
  // storage even before the Market controller has activated the stand.
  const marketDemand=(cfg.items??[]).some(r=>r.enabled&&
    (r.action==='list'&&(p.c.items??[]).some((i,slot)=>
      i&&e.rules(i)?.action==='list'&&e.spare(slot,e.rules(i))>0)||
    r.action==='wishlist'&&e.rules({name:r.item,level:r.minLevel??0},
      'acquisition')===r&&e.count({name:r.item,level:r.minLevel??0})<
      Math.min(r.targetCount,r.maxCount)));
  if(marketDemand)return false;
  if(me.role!=='merchant'||!cfg.merchant.bank||bot.logistics?.reserved||
    bot.journal||bot.inventoryBlocked||bot.bank?.pending||
    bot.movement?.order)return false;
  const activeTrades=Object.entries(p.c.slots??{}).some(([id,item])=>
    /^trade([1-9]|1[0-6])$/.test(id)&&!!item);
  if(activeTrades)return false;
  if(p.c.stand){
   return exec.run('stand.close',['stand'],()=>bot.running&&!!p.c.stand&&
     !Object.entries(p.c.slots??{}).some(([id,item])=>
       /^trade([1-9]|1[0-6])$/.test(id)&&!!item),
     ()=>p.call('close_stand'),{delay:3000,timeout:10000});
  }
  return bot.bank?.manageStand?.()??false;
 }
 function openStandWhenIdle(){
  if(!canOpenMerchantStand(bot)){standIdleSince=null;return false;}
  if(standIdleSince===null){standIdleSince=Date.now();return false;}
  if(Date.now()-standIdleSince<2000)return false;
  return exec.run('stand',['stand'],()=>canOpenMerchantStand(bot),()=>p.call('open_stand'),{delay:5000});
 }
 function buff(preferred=null){
  if(me.role!=='merchant'||!cfg.merchant.mluck||!p.G.skills?.mluck)return false;
  const skill=p.G.skills.mluck,range=skill.range??320;
  if(p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||
    p.call('is_on_cooldown','mluck'))return false;
  // Selecting a farmer for mluck.service is only a travel decision. The
  // service must execute the actual skill once in range; previously it just
  // returned false at arrival and deferred itself without ever casting.
  const targets=preferred?[bot.entity?.(preferred)].filter(Boolean):
    (cfg.merchant.mluckOthers?Object.values(p.entities).filter(x=>x.type==='character'):
      bot.allies());
  for(const c of targets.sort((a,b)=>(a.s?.mluck?.ms??0)-(b.s?.mluck?.ms??0))){
   if(c.rip||!samePlace(p.c,c)||distance(p.c,c)>range||
      c.s?.mluck?.strong&&c.s.mluck.f!==me.name||c.s?.mluck?.ms>60000)continue;
   const recipient=c.name??c.id;
   if(exec.run('mluck',['skill','mana'],()=>bot.running&&!p.c.rip&&
     p.c.mp>=(skill.mp??0)&&!p.call('is_on_cooldown','mluck')&&
     samePlace(p.c,c)&&distance(p.c,c)<=range,
     ()=>p.call('use_skill','mluck',c.id??c.name),{delay:2000})){
    bot.event?.('merchant.mluckRequested',{recipient,range:Math.round(distance(p.c,c))});
    return true;
   }
  }
  return false;
 }
 function tick(){
  if(bot.recovering)return;
  if(bot.bank.pending){if(!bot.bank.recoverCapacity())bot.bank.recover();return;}
  if(!bot.running||p.c.rip||bot.inventoryBlocked||bot.journal||bot.logistics.reserved||exec.busy('inventory'))return;
  if(me.role==='merchant'&&!cfg.merchant.enabled)return;
// Production planning runs in the slower planning loop (src/main.mjs).
// Do not replan while an admitted merchant job is still executing.
  // Delivery routes are owned by logistics.travel(): that controller owns
  // fresh-heartbeat retargeting. Do not cancel a valid route using its old
  // coordinates here, before logistics can replan it.
  const route=bot.movement.order;if(route?.owner==='gold'){const peer=bot.transport?.fresh?.(route.dest.name);if(route.dest.name&&(!peer?.running||bot.strategy?.canVisit?.(peer)===false))bot.movement.stop();}
  // Cast first at the arrived position: logistics.travel() can initiate
  // a bank departure in the same tick and otherwise preempt the spell.
  if(!bot.movement.order&&bot.farmers?.some(n=>{
    const h=bot.transport?.fresh?.(n);
    return h?.running&&!h.rip&&samePlace(p.c,h)&&
      distance(p.c,h)<=(p.G.skills?.mluck?.range??320);
  }))buff();
  bot.logistics.travel();
  if(departure&&departure.stage!=='ready'&&!['logistics','gold'].includes(bot.movement.order?.owner))
    return;
  // If pickup preflight could not create space, do not schedule unrelated
  // production/market work in the same frame and discard the pickup objective.
  if(pickupStatus?.missing>0&&Date.now()-(pickupStatus.at??0)<3000){
    // Gold requires no inventory slot. A pickup that cannot safely free
    // space must not starve independent gold collection indefinitely.
    if(pickupStatus.state==='blocked'&&!bot.movement.order)bot.gold?.travel();
    return;
  }
  if(!bot.movement.order)bot.gold?.travel();
  if(['logistics','gold'].includes(bot.movement.order?.owner)){bot.services?.interrupt();bot.services?.restore();return;}
  // Do not head back to the bank/market after one received stack while a
  // nearby farmer is still cycling its heartbeat's advertised loot variants.
  // The on-site lease is bounded and yields immediately when inventory
  // workspace is exhausted; it never suppresses emergency/supply travel.
  if(bot.logistics.pickupOnSite?.()){
    bot.reason='Beute-Abholung vor Ort: Farmer-Inventar abarbeiten';
    return;
  }
  if(bot.movement.order?.owner==='economy'){bot.reason='Unterwegs: '+(tasks.status().task??'Merchant-Auftrag');return;}
  if(bot.services?.approaching){const continued=bot.services.tick();if(continued||bot.services.approaching)return;}
  if(bot.services?.active&&bot.services.status().gathering){bot.services.tick();return;}
  if(me.role==='merchant'&&!bot.movement.order){
    const progress=bot.production.status(),intent=progress.intent;
    bot.reason=progress.blocked??(intent?.phase==='delivery'
      ?'Lieferauftrag offen: '+(intent.recipient??'Team')+' – Warte auf freigegebene Items/aktuelle Empfangsposition'
      :'Merchant wartet: kein freigegebener Auftrag/Nachschubbedarf');
  }
  if(standDepot())return;
  const jobs=[],spaceNeeded=bot.free()<=cfg.merchant.minFreeSlots+(cfg.merchant.bankWorkspace??0),add=(id,r,run)=>jobs.push({id,priority:r?.priority??-100,critical:spaceNeeded&&['bank','sell'].includes(r?.action),local:r?.action==='bank'?p.c.map==='bank':r?.action==='sell'&&!!e.at?.(e.destination?.('fancypots')??e.destination?.('potions')??e.npcFor?.('hpot0')),run,r});
  for(let slot=0;slot<p.c.items.length;slot++){
   const i=p.c.items[slot];if(!e.safe(i))continue;const inventory=e.rules(i),production=e.rules(i,'production');
   for(const [phase,r] of [['inventory',inventory],['production',production]]){
    if(!r||!e.remaining(r)||['keep','send','consume'].includes(r.action))continue;
    if(['sell','bank','list','exchange'].includes(r.action)&&e.spare(slot,r)<1)continue;
    if(['upgrade','compound'].includes(r.action)&&(i.level??0)>=r.targetLevel)continue;
    let run;if(r.action==='sell')run=()=>r._autoDisposition===true&&(bot.market?.sellToBid?.(slot,r)??false)||e.npcSell(slot,r);
    if(r.action==='equip')run=()=>bot.gear.equip(slot,r);
    if(me.role==='merchant'){
     if(r.action==='bank')run=()=>bot.bank.store(slot,r);
     if(r.action==='list')run=()=>bot.market.sellToBid?.(slot,r)||bot.market.listing(slot,r);
     if(r.action==='exchange')run=()=>bot.production.exchange(slot,r);
     if(['upgrade','compound'].includes(r.action))run=()=>bot.production.mutate(slot,r);
    }
    if(run)add(phase+':'+JSON.stringify([r.name,r.action,i.name,i.level??0,r.recipient]),r,()=>{
     const done=run();if(done||bot.movement.order||bot.journal)return done;
     if(r.fallback==='bank'&&me.role==='merchant'&&r.action!=='bank')return bot.bank.store(slot,{...r,action:'bank',_originalAction:r.action});
     if(r.fallback==='notify')e.note(r.name+': Voraussetzungen fehlen; Item bleibt erhalten');return false;
    });
   }
  }
  if(me.role==='merchant'){
   for(const r of cfg.items.filter(r=>r.enabled&&e.remaining(r))){const item={name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title};
    if(e.rules(item,'acquisition')===r&&!e.downstreamSatisfied(item,r)){const n=e.count(item),need=Math.min(r.targetCount,r.maxCount)-n;if(need<=0||r.requestBelow>0&&n>r.requestBelow)continue;
     const run={buy:()=>e.npcBuy(item,r,need),retrieve:()=>bot.bank.retrieve(item,r,need),marketBuy:()=>bot.market.buy(item,r),wishlist:()=>bot.market.wishlist(item,r)}[r.action];if(run)add('acquisition:'+cfg.items.indexOf(r),r,run);
    }
    if(r.action==='craft'&&e.rules(item,'production')===r&&bot.production.outputCount(r.item,r)<r.targetCount)add('craft:'+cfg.items.indexOf(r),r,()=>bot.production.craft(r.item,r));
   }
   if(cfg.merchant.mluck&&cfg.merchant.mluckTravel!==false&&
     bot.free()>=Math.max(1,(cfg.merchant.minFreeSlots??4)+3))add('mluck.service',{priority:-200},()=>{
      const candidate=(bot.farmers??[]).map(n=>bot.transport.fresh(n))
       .filter(h=>h?.running&&!h.rip&&h.realm===p.realm()&&
         !(h.mluck?.strong&&h.mluck.f!==me.name)&&
         (!h.mluck||Number.isFinite(h.mluck.ms)&&h.mluck.ms<60000))
       .sort((a,b)=>(a.mluck?1:0)-(b.mluck?1:0)||
         (a.mluck?.ms??0)-(b.mluck?.ms??0))
       .find(h=>bot.strategy?.canVisit?.(h)??true);
      if(!candidate||service.claim(candidate.name)===false)return false;
      if(samePlace(p.c,candidate)&&distance(p.c,candidate)<=(p.G.skills.mluck?.range??320)){
       // A real cast, not merely an arrived movement order.
       return buff(candidate.name);
      }
      return !e.travel({...candidate,radius:150},'Mluck-Erneuerung',200);
     });
   add('inventory.consolidate',{priority:bot.free()<=cfg.merchant.minFreeSlots+2?100:-150},()=>bot.bank.consolidateInventory?.()??false);add('production',null,()=>bot.production.tick());add('bank.gold',null,()=>bot.bank.gold());add('bank.consolidate',null,()=>bot.bank.consolidate());if(cfg.merchant.bankReclaim)add('bank.capacity',null,()=>bot.bank.reclaim());
   if(bot.strategy?.status().manual?.task==='bank')add('bank.request',{priority:-50},()=>bot.strategy.travel());
   add('market.background',{priority:-1000},()=>bot.market.background());add('services',{priority:-1000},()=>{buff();return bot.services.tick();});
  }
  // Open the stand only AFTER the priority planner has had the chance to
  // schedule travel. The old pre-planner scheduling raced against smart_move.
  for(const job of tasks.rank(jobs)){
   if(bot.movement.order?.owner==='economy'&&tasks.status().task&&tasks.status().task!==job.id)bot.movement.stop();
   if(job.id!=='services'&&bot.services?.active){bot.services.interrupt();if(bot.services.restore())return;}
   const accepted=job.run();if(accepted||bot.movement.order?.owner==='economy'){if(job.id!=='services'&&bot.services?.waiting)bot.services.interrupt();const changed=tasks.status().task!==job.id;tasks.selected(job.id);if(changed)bot.event?.("merchant.selected",{task:job.id,rule:job.r?.name??"Ziel-/Hintergrundauftrag",priority:job.priority,reason:"Regelpriorität, Haltezeit und Wartealter; Logistik hat Vorrang"});return;}if(!bot.journal&&!exec.pending.size){tasks.defer(job.id);bot.event?.('merchant.deferred',{task:job.id,rule:job.r?.name,reason:bot.reason||'Voraussetzungen fehlen',retryMs:30000});}
  }
  if(me.role!=='merchant')return;
  const pos=cfg.merchant.position;if(pos.enabled)e.travel({...pos,in:pos.map},'Standplatz',20);
  // Stand usage is now demand-driven by market.list/market.wishlist.
 }
 return {tick,preparePickup,prepareDeparture,activateStand,claimService:service.claim,serviceTarget:service.current,status:()=>({...tasks.status(),service:service.status(),pickup:pickupStatus,departure:departure?{phase:departure.stage,started:departure.started,readyAt:departure.readyAt??null,skipped:[...departure.skipped]}:null}),close(){tasks.clear();service.clear();}};
}
