import {distance} from '../core/policy.mjs';
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
 let standIdleSince=null,lastPickupWarning=0,pickupStatus=null;
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
 function openStandWhenIdle(){
  if(!canOpenMerchantStand(bot)){standIdleSince=null;return false;}
  if(standIdleSince===null){standIdleSince=Date.now();return false;}
  if(Date.now()-standIdleSince<2000)return false;
  return exec.run('stand',['stand'],()=>canOpenMerchantStand(bot),()=>p.call('open_stand'),{delay:5000});
 }
 function buff(){
  if(me.role!=='merchant'||!cfg.merchant.mluck||!p.G.skills?.mluck)return;const skill=p.G.skills.mluck;
  if(p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||p.call('is_on_cooldown','mluck'))return;
  for(const c of (cfg.merchant.mluckOthers?Object.values(p.entities).filter(x=>x.type==='character'):bot.allies()).sort((a,b)=>(a.s?.mluck?.ms??0)-(b.s?.mluck?.ms??0))){
   if(c.rip||distance(p.c,c)>(skill.range??320)||c.s?.mluck?.strong&&c.s.mluck.f!==me.name||c.s?.mluck?.ms>60000)continue;
   if(exec.run('mluck',['skill','mana'],()=>bot.running&&p.c.mp>=(skill.mp??0),()=>p.call('use_skill','mluck',c.id??c.name),{delay:2000}))break;
  }
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
  bot.logistics.travel();
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
   if(cfg.merchant.mluck&&cfg.merchant.mluckTravel!==false)add('mluck.service',{priority:-200},()=>{const candidate=bot.farmers.map(n=>bot.transport.fresh(n)).filter(h=>h?.running&&!h.rip&&h.realm===p.realm()&&!(h.mluck?.strong&&h.mluck.f!==me.name)&&(!h.mluck||Number.isFinite(h.mluck.ms)&&h.mluck.ms<60000)).sort((a,b)=>(a.mluck?1:0)-(b.mluck?1:0)||(a.mluck?.ms??0)-(b.mluck?.ms??0)).find(h=>bot.strategy?.canVisit?.(h)??true);if(!candidate||service.claim(candidate.name)===false||distance(p.c,candidate)<(p.G.skills.mluck?.range??320))return false;return !e.travel({...candidate,radius:150},'Mluck-Erneuerung',200);});
   add('inventory.consolidate',{priority:bot.free()<=cfg.merchant.minFreeSlots+2?100:-150},()=>bot.bank.consolidateInventory?.()??false);add('production',null,()=>bot.production.tick());add('bank.gold',null,()=>bot.bank.gold());add('bank.consolidate',null,()=>bot.bank.consolidate());if(cfg.merchant.bankReclaim)add('bank.capacity',null,()=>bot.bank.reclaim());
   if(bot.strategy?.status().manual?.task==='bank')add('bank.request',{priority:-50},()=>bot.strategy.travel());
   add('market.background',{priority:-1000},()=>bot.market.background());add('services',{priority:-1000},()=>{buff();return bot.services.tick();});
  }
  // Open the stand only AFTER the priority planner has had the chance to
  // schedule travel. The old pre-planner scheduling raced against smart_move.
  for(const job of tasks.rank(jobs)){
   if(bot.movement.order?.owner==='economy'&&tasks.status().task&&tasks.status().task!==job.id)bot.movement.stop();
   if(job.id!=='services'&&bot.services?.active){bot.services.interrupt();if(bot.services.restore())return;}
   const accepted=job.run();if(accepted||bot.movement.order?.owner==='economy'){if(job.id!=='services'&&bot.services?.waiting)bot.services.interrupt();const changed=tasks.status().task!==job.id;tasks.selected(job.id);if(changed)bot.event?.("merchant.selected",{task:job.id,rule:job.r?.name??"Ziel-/Hintergrundauftrag",priority:job.priority,reason:"Regelpriorität, Haltezeit und Wartealter; Logistik hat Vorrang"});openStandWhenIdle();return;}if(!bot.journal&&!exec.pending.size){tasks.defer(job.id);bot.event?.('merchant.deferred',{task:job.id,rule:job.r?.name,reason:bot.reason||'Voraussetzungen fehlen',retryMs:30000});}
  }
  if(me.role!=='merchant')return;
  const pos=cfg.merchant.position;if(pos.enabled)e.travel({...pos,in:pos.map},'Standplatz',20);
  openStandWhenIdle();
 }
 return {tick,preparePickup,claimService:service.claim,serviceTarget:service.current,status:()=>({...tasks.status(),service:service.status(),pickup:pickupStatus}),close(){tasks.clear();service.clear();}};
}
