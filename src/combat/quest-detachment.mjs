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
  name,class:p.c.ctype,running:bot.running,rip:!!p.c.rip,realm:p.realm(),
  map:p.c.map,in:p.c.in??p.c.map,x:p.c.x,y:p.c.y,
  hp:p.c.hp,max_hp:p.c.max_hp,mp:p.c.mp,max_mp:p.c.max_mp,
  questVisit:!!bot.strategy?.busy,journal:!!bot.journal,
  inventoryBlocked:!!bot.inventoryBlocked,reserved:!!bot.logistics?.reserved
 }:bot.transport?.fresh?.(name);
 const rows=names.map(peer);
 const visitors=rows.filter(h=>h?.questVisit===true);
 if(visitors.length!==1||visitors[0].name===me.name)return null;
 const active=rows.filter(h=>h?.name!==visitors[0].name);
 // A follower's local team-plan cache may be empty even while the
 // leader advertises a verified ordinary farm anchor. Admit that leader
 // snapshot only after the *same local* spawn/risk validity check.
 const localPlan=bot.teamPlan?.heartbeat?.();
 const leader=me.name===bot.leader?null:bot.transport?.fresh?.(bot.leader);
 // The current local cache may be stale after leader quest departure.
 // Try the leader's independently verified compact farm anchor as well.
 const trusted=leader?.running&&!leader.rip&&leader.realm===p.realm();
 const plans=[localPlan,...(trusted?[leader.farmPlan,leader.march?.anchor]:[])]
  .filter(Boolean);
 const plan=plans.find(row=>row.kind==='farm'&&!row.objective&&
  Number.isFinite(row.expires)&&row.expires>Date.now()&&
  bot.teamPlan?.valid?.(row)===true&&row.leader===bot.leader&&
  row.realm===p.realm()&&samePlace(p.c,row)&&distance(p.c,row)<=120);
 if(!plan)return null;
 for(const h of active){
  if(!h?.running||h.rip||h.realm!==p.realm()||
     (Number.isFinite(h.threats)&&h.threats>0)||
     h.journal||h.inventoryBlocked||h.reserved||
     !samePlace(h,plan)||distance(h,plan)>120||
     !Number.isFinite(h.hp)||!Number.isFinite(h.max_hp)||h.max_hp<=0||
     !Number.isFinite(h.mp)||!Number.isFinite(h.max_mp)||h.max_mp<=0||
     h.hp<=0||h.mp<0)return null;
 }
 if(distance(active[0],active[1])>140)return null;
 // When the leader is collecting the quest, use a verified damage class
 // instead of automatically making the Priest initiate fresh fights.
 const standby=active.find(h=>(h.class??h.ctype)!=='priest');
 if(!standby)return null;
 const puller=active.some(h=>h.name===bot.leader)?
  bot.leader:standby.name;
 return {visitor:visitors[0].name,puller,
  active:active.map(h=>h.name),target:plan.target,key:plan.key,
  planId:plan.id};
}
