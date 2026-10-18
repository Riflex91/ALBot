import {distance,samePlace} from '../core/policy.mjs';

// A Monsterhunt NPC visit is an individual errand, not a squad relocation.
// Grant exactly one conservative temporary puller only when BOTH remaining
// farmers are still at the leader's previously verified ordinary farm anchor.
// Unknown/stale heartbeats, split instances, other errands or unsafe plans
// fail closed. The quest owner is never counted as combat support.
export function assessQuestDetachment(bot){
 const {cfg,p,me}=bot,names=bot.farmers??[];
 if(cfg.party?.enabled!==true||cfg.party?.waitForTeam!==true||
    names.length!==3||!names.includes(me.name)||!bot.running)return null;
 const peer=name=>name===me.name?{
  name,running:bot.running,rip:!!p.c.rip,realm:p.realm(),
  map:p.c.map,in:p.c.in??p.c.map,x:p.c.x,y:p.c.y,
  hp:p.c.hp,max_hp:p.c.max_hp,mp:p.c.mp,max_mp:p.c.max_mp,
  questVisit:!!bot.strategy?.busy,journal:!!bot.journal,
  inventoryBlocked:!!bot.inventoryBlocked,reserved:!!bot.logistics?.reserved
 }:bot.transport?.fresh?.(name);
 const rows=names.map(peer);
 const visitors=rows.filter(h=>h?.questVisit===true);
 if(visitors.length!==1||visitors[0].name===me.name)return null;
 const active=rows.filter(h=>h?.name!==visitors[0].name);
 const plan=bot.teamPlan?.heartbeat?.();
 if(!plan||plan.kind!=='farm'||plan.objective||
    !bot.teamPlan?.valid?.(plan)||plan.leader!==bot.leader||
    plan.realm!==p.realm()||!samePlace(p.c,plan)||
    distance(p.c,plan)>120)return null;
 for(const h of active){
  if(!h?.running||h.rip||h.realm!==p.realm()||
     h.journal||h.inventoryBlocked||h.reserved||
     !samePlace(h,plan)||distance(h,plan)>120||
     !Number.isFinite(h.hp)||!Number.isFinite(h.max_hp)||h.max_hp<=0||
     !Number.isFinite(h.mp)||!Number.isFinite(h.max_mp)||h.max_mp<=0||
     h.hp<=0||h.mp<0)return null;
 }
 if(distance(active[0],active[1])>140)return null;
 const puller=active.some(h=>h.name===bot.leader)?
  bot.leader:active[0].name;
 return {visitor:visitors[0].name,puller,
  active:active.map(h=>h.name),target:plan.target,key:plan.key,
  planId:plan.id};
}
