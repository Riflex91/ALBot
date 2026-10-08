import {distance} from '../core/policy.mjs';
import {createFairTasks} from '../core/fair-tasks.mjs';
export function createMerchant(bot){
 const {p,cfg,me,exec}=bot,e=bot.economy,tasks=createFairTasks({holdMs:cfg.merchant.taskHoldMs,starvationMs:cfg.merchant.starvationMs});
 function buff(){
  if(me.role!=='merchant'||!cfg.merchant.mluck||!p.G.skills?.mluck)return;const skill=p.G.skills.mluck;
  if(p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||p.call('is_on_cooldown','mluck'))return;
  for(const c of cfg.merchant.mluckOthers?Object.values(p.entities).filter(x=>x.type==='character'):bot.allies()){
   if(c.rip||distance(p.c,c)>(skill.range??320)||c.s?.mluck?.strong&&c.s.mluck.f!==me.name||c.s?.mluck?.ms>60000)continue;
   if(exec.run('mluck',['skill','mana'],()=>bot.running&&p.c.mp>=(skill.mp??0),()=>p.call('use_skill','mluck',c.id??c.name),{delay:2000}))break;
  }
 }
 function tick(){
  if(bot.recovering)return;
  if(bot.bank.pending){if(!bot.bank.recoverCapacity())bot.bank.recover();return;}
  if(!bot.running||p.c.rip||bot.inventoryBlocked||bot.journal||bot.logistics.reserved||exec.busy('inventory'))return;
  if(me.role==='merchant'&&!cfg.merchant.enabled)return;if(me.role==='merchant')bot.production.planGoals();buff();
  const route=bot.movement.order;if(['logistics','gold'].includes(route?.owner)){const peer=bot.transport?.fresh?.(route.dest.name);if(route.dest.name&&!peer?.running||bot.strategy?.canVisit?.(peer??route.dest)===false)bot.movement.stop();}
  bot.logistics.travel();if(!bot.movement.order)bot.gold?.travel();
  if(['logistics','gold'].includes(bot.movement.order?.owner)){bot.services?.interrupt();bot.services?.restore();return;}
  if(bot.movement.order?.owner==='economy'){bot.reason='Unterwegs: '+(tasks.status().task??'Merchant-Auftrag');return;}
  if(bot.services?.active&&bot.services.status().gathering){bot.services.tick();return;}
  if(me.role==='merchant'&&!bot.movement.order)bot.reason=bot.production.status().blocked??'Merchant wartet: kein freigegebener Auftrag/Nachschubbedarf';
  const jobs=[],add=(id,r,run)=>jobs.push({id,priority:r?.priority??-100,run,r});
  for(let slot=0;slot<p.c.items.length;slot++){
   const i=p.c.items[slot];if(!e.safe(i))continue;const inventory=e.rules(i),production=e.rules(i,'production');
   for(const [phase,r] of [['inventory',inventory],['production',production]]){
    if(!r||!e.remaining(r)||['keep','send','consume'].includes(r.action))continue;
    if(['sell','bank','list','exchange'].includes(r.action)&&e.spare(slot,r)<1)continue;
    if(['upgrade','compound'].includes(r.action)&&(i.level??0)>=r.targetLevel)continue;
    let run;if(r.action==='sell')run=()=>e.npcSell(slot,r);
    if(r.action==='equip')run=()=>bot.gear.equip(slot,r);
    if(me.role==='merchant'){
     if(r.action==='bank')run=()=>bot.bank.store(slot,r);
     if(r.action==='list')run=()=>bot.market.listing(slot,r);
     if(r.action==='exchange')run=()=>bot.production.exchange(slot,r);
     if(['upgrade','compound'].includes(r.action))run=()=>bot.production.mutate(slot,r);
    }
    if(run)add(phase+':'+cfg.items.indexOf(r)+':'+slot,r,()=>{
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
   add('production',null,()=>bot.production.tick());add('bank.gold',null,()=>bot.bank.gold());add('bank.consolidate',null,()=>bot.bank.consolidate());if(cfg.merchant.bankReclaim)add('bank.capacity',null,()=>bot.bank.reclaim());
   if(bot.strategy?.status().manual?.task==='bank')add('bank.request',{priority:-50},()=>bot.strategy.travel());
   add('market.background',{priority:-1000},()=>bot.market.background());add('services',{priority:-1000},()=>bot.services.tick());
  }
  if(cfg.merchant.stand&&!p.c.stand&&!p.c.moving&&!bot.movement.order&&p.c.items.some(i=>i&&p.G.items[i.name]?.stand)&&me.role==='merchant')exec.run('stand',['stand'],()=>bot.running&&!p.c.moving,()=>p.call('open_stand'),{delay:5000});
  for(const job of tasks.rank(jobs)){
   if(bot.movement.order?.owner==='economy'&&tasks.status().task&&tasks.status().task!==job.id)bot.movement.stop();
   if(job.id!=='services'&&bot.services?.active){bot.services.interrupt();if(bot.services.restore())return;}
   const accepted=job.run();if(accepted||bot.movement.order?.owner==='economy'){if(job.id!=='services'&&bot.services?.waiting)bot.services.interrupt();tasks.selected(job.id);bot.event?.("merchant.selected",{task:job.id,rule:job.r?.name??"Ziel-/Hintergrundauftrag",priority:job.priority,reason:"Regelpriorität, Haltezeit und Wartealter; Logistik hat Vorrang"});return;}
  }
  if(me.role!=='merchant')return;
  const pos=cfg.merchant.position;if(pos.enabled)e.travel({...pos,in:pos.map},'Standplatz',20);
 }
 return {tick,status:tasks.status,close:tasks.clear};
}
