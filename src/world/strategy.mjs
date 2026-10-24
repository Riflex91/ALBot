import {observeActivity} from './event-evidence.mjs';
import {distance,samePlace,xy} from '../core/policy.mjs';
import {materialDrops,expectedMonsterGold} from '../production/materials.mjs';
import {knowledgeFingerprint} from './knowledge.mjs';
import {combatMembers,compositionOptions} from './composition.mjs';
import {assessCombat} from './risk.mjs';
export function sharedFarmRejection(id,peers,realm,definition,now=Date.now()){
 return (peers??[]).some(h=>h?.running&&!h.rip&&h.realm===realm&&
  Number.isFinite(h.received)&&now-h.received>=0&&now-h.received<=4000&&
  Array.isArray(h.farmRejections)&&h.farmRejections.slice(0,4).some(r=>r?.monster===id&&r.definition===definition&&
   Number.isFinite(r.until)&&r.until>now&&r.until<=now+600000));
}
// A theoretical 12-target battle is not the actual normal farm pull.
// Preserve a conservative 3-target floor for 3shot, the configured AoE
// exposure and all verified already-engaged hostiles. This never authorizes
// a target: the complete Legacy combat/defense/mechanics gate still runs.
export function effectiveFarmAggro(maxAggro,aoeMaxTargets,engaged=0){
 if(!Number.isSafeInteger(maxAggro)||maxAggro<1||maxAggro>100||
    !Number.isSafeInteger(engaged)||engaged<0||engaged>100)return maxAggro;
 const aoe=Number.isSafeInteger(aoeMaxTargets)&&aoeMaxTargets>=1?
   aoeMaxTargets:3;
 return Math.max(Math.min(maxAggro,Math.max(3,aoe)),
  Math.min(100,engaged));
}
// The species gate evaluates a controlled basic single-target pull. Native
// aimed-AoE/multi-pull admission checks the *actual* target set separately.
// Reserve one additional unobserved attacker, but never assume all configured
// AoE slots have already aggroed. Real engaged hostiles always count.
export function boundedSinglePullAggro(maxAggro,engaged=0){
 if(!Number.isSafeInteger(maxAggro)||maxAggro<1||
    !Number.isSafeInteger(engaged)||engaged<0||engaged>100)return maxAggro;
 return Math.max(Math.min(maxAggro,2),engaged,1);
}
export function rankFarmTargets(G,character,targets,mode='balanced',learned={},weight=0){
 return targets.filter(id=>G.monsters?.[id]).map((id,index)=>{
  const m=G.monsters[id],seconds=Math.max(1,(m.hp??100)/Math.max(1,(character.attack??1)*(character.frequency??1))),xp=(m.xp??1)/seconds;
  const gold=materialDrops(G,G.drops?.monsters?.[id]).filter(d=>d.item==='gold').reduce((n,d)=>n+d.chance*d.quantity,0)/seconds;
  const risk=1+Math.max(0,(m.attack??0)/Math.max(1,character.max_hp??1))*10;
  const base=(mode==='xp'?xp:mode==='gold'?gold:mode==='materials'?1:Math.sqrt(Math.max(1,xp)*Math.max(1,gold)))/risk;
  const adjust=1+Math.max(-weight,Math.min(weight,(learned[id]?.factor??1)-1));return {id,index,score:base*adjust};
 }).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.id);
}
export function farmRiskHp(base,live){
 const ordinary=base?.hp??0;
 if(live&&Number.isFinite(ordinary)&&ordinary>0&&
  Number.isFinite(live.max_hp)&&live.max_hp>ordinary)return ordinary;
 return Math.max(ordinary,live?.max_hp??live?.hp??0);
}
// A monsterhunt's ms changes continuously. That countdown is not evidence
// that Daisy accepted or completed a quest; only id, count, realm or presence
// changes qualify as a meaningful authoritative state transition.
// Quests may be interrupted when a journey has ceased making observable
// progress. Native smart_move gets a longer search window than direct walk.
// This controls only travel, never server-authoritative quest completion.
export function questTravelStalled(visit,character,{now=Date.now(),smart=false,town=false}={}){
 if(!visit||visit.phase!=='travel'||!Number.isFinite(now)||town)return false;
 const x=character?.real_x??character?.x,y=character?.real_y??character?.y;
 if(!Number.isFinite(x)||!Number.isFinite(y)||typeof character?.map!=='string')return false;
 const prior=visit.progress;
 if(!prior||!Number.isFinite(prior.at)||prior.at>now||prior.map!==character.map||
    Math.hypot(x-prior.x,y-prior.y)>12){
  visit.progress={map:character.map,x,y,at:now};return false;
 }
 return now-prior.at>(smart?90000:45000);
}
export function questIdentity(q){
 return JSON.stringify(q?{id:q.id??null,c:q.c??null,sn:q.sn??null}:null);
}
// Independent world errands must not steal one Farmer's movement while
// the other selected Farmers are still following the shared spawn route.
export function squadMarchStillInTransit(self,names,plan,lookup,{
 assemblyDistance=140}={}){
 if(!plan?.id||!Array.isArray(names)||!names.includes(self?.name))return false;
 if(!samePlace(self,plan)||distance(self,plan)>assemblyDistance)return true;
 return names.some(name=>{
  if(name===self.name)return false;
  const member=lookup(name);
  return !member?.running||member.rip||member.realm!==plan.realm||
    !samePlace(member,plan)||distance(member,plan)>assemblyDistance;
 });
}
// Monsterhunt NPC visits may start during a shared ordinary farm route only
// when all selected farmers are nearby, alive, and out of combat. Waiting
// until the destination is reached caused endless quest deferrals in logs.
export function squadReadyForQuestVisit(self,names,lookup,{realm,maxGap=140}={}){
 if(!self||!Array.isArray(names)||!names.includes(self.name))return false;
 return names.every(name=>{
  const peer=name===self.name?self:lookup(name);
  return !!peer&&(name===self.name||peer.running===true)&&!peer.rip&&
   (!realm||name===self.name||peer.realm===realm)&&
   Number.isFinite(peer.hp)&&Number.isFinite(peer.max_hp)&&peer.max_hp>0&&
   peer.hp/peer.max_hp>=.6&&!(peer.threats>0)&&
   samePlace(self,peer)&&distance(self,peer)<=maxGap;
 });
}
export function createStrategy(bot){
 const {p,cfg,me,exec}=bot,w=cfg.world;let activity=null,manual=null,plannedAt=0,lastG=null,lastSample=null,rates={},ranked=[],rankedAt=0,rankedG=null,questVisit=null,nextQuest=0;
 const full=cfg.general.testLogging!==undefined,riskKey='albot:risk:'+me.name;let failed=p.read?.(riskKey)??{},lastRisk=new Map();const rejectionEvidence=new Map();
 const explicitTargets=()=>me.farmTargets.length?me.farmTargets:cfg.farming.targets;
 const state=()=>p.root.S??p.parent.S??{};
 const task=()=>manual?.task??(activity?.kind==='boss'?'boss':activity?.kind==='event'?'event':activity?.kind==='quest'?'quest':me.role==='merchant'?'supply':'farm');
 const permittedMap=map=>!!p.G.maps?.[map]&&!w.excludedMaps.includes(map)&&(!p.G.maps[map].pvp||cfg.farming.pvp);
 function members(planned=false){return combatMembers(bot,planned); }
 function risk(id,live,planned=false){const boss=bot.bosses?.evaluate(id,live,planned||!live);if(boss)return boss;
 const base=p.G.monsters?.[id];
 // Naturally grown monsters are a temporary occupant, not a new species
 // or a permanently dangerous respawn. Calculate spot viability with base
 // HP while retaining LIVE attack, frequency, mechanics and defenses.
 const hp=farmRiskHp(base,live);
 const liveEngaged=(bot.monsters?.()??[]).filter(m=>m.target&&
  (bot.teamNames??[]).includes(m.target)&&m.hp>0&&samePlace(p.c,m)).length;
 const aggro=boundedSinglePullAggro(cfg.farming.maxAggro,liveEngaged);
 return assessCombat({...base,...live,hp},members(planned),w.risk,aggro,
  {...compositionOptions(bot,planned),maxCombatSeconds:cfg.farming.maxCombatSeconds});}
 function logSafetyGate(id,result,planned,quiet){
  // Normal farm ranking probes hundreds of species; limit diagnostics to
  // named boss targets, active encounters and failed selections.
  if(!bot.bosses?.profile?.(id)&&!failed[id]&&activity?.target!==id)return;
  const key='gate:'+id+':'+(result.reason??'unknown');const at=Date.now();
  if(at-(lastRisk.get(key)??0)<30000)return;
  lastRisk.set(key,at);if(lastRisk.size>128)lastRisk.clear();
  bot.event?.('strategy.safetyGate',{target:id,safe:false,
   reason:result.reason??'unverified',phase:result.phase??null,
   planned:!!planned,probe:quiet?'ranking':'combat',
   retryAfter:result.retryAfter??null,seconds:result.seconds??null,
   dps:result.dps??result.outgoing??null,
   incoming:result.incoming??null,healer:result.healer??null,
   members:(bot.farmers??[]).map(n=>({name:n,ready:n===me.name||!!bot.transport.fresh(n)?.running}))});
 }
 function safeTarget(id,live,quiet=false,planned=false){
   if(sharedFarmRejection(id,(bot.farmers??[]).filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n)),
      p.realm(),knowledgeFingerprint(p.G.monsters?.[id])))return false;
  if(activity?.observationUnknown&&id===activity.target&&!live?.target)return false;
  if(!full)return true;
  // A death quarantine is different from a combat-readiness rejection.
  // Log both, including planned/spawn checks that used to be completely silent.
  if(failed[id]>Date.now()){
   logSafetyGate(id,{safe:false,reason:'failed-target-quarantine',retryAfter:failed[id]},planned,quiet);
   return false;
  }
  const result=risk(id,live,planned);
  if(!result.safe)logSafetyGate(id,result,planned,quiet);if(result.timelineShadow&&Date.now()-(lastRisk.get('shadow:sample')??0)>30000){lastRisk.set('shadow:sample',Date.now());const s=result.timelineShadow;bot.event('combat.timelineShadow',{monster:id,safe:result.safe,legacySeconds:result.seconds??null,projectedSeconds:s.projectedSeconds,deltaSeconds:s.deltaSeconds,lowerBoundDps:s.lowerBoundDps,expectedDps:s.expectedDps,expectedCritScenarioDps:s.expectedCritScenarioDps,healerDuty:s.healerDuty,healerManaLimited:s.healerManaLimited,healerProjectedHeals:s.healerProjectedHeals,healerCastSlots:s.healerCastSlots,healerAttackSlots:s.healerAttackSlots,attackIntervalsMs:JSON.stringify(s.attackIntervalsMs),authority:s.authority});}if(!quiet&&!result.safe&&lastRisk.get(id)!==result.reason){if(lastRisk.size>64)lastRisk.clear();lastRisk.set(id,result.reason);bot.event('strategy.riskRejected',{target:id,...result});}return result.safe;}
 function failActivity(reason,id=activity?.target??bot.target?.mtype){if(!id||failed[id]>Date.now())return;
  // A roaming unrelated hostile must not quarantine the leader's safe farm
  // spawn on followers: only the failed farm target itself invalidates it.
  if(bot.teamPlan?.status?.()?.current?.target===id)bot.teamPlan.failed(reason);
  failed=Object.fromEntries(Object.entries(failed).filter(([,until])=>until>Date.now()).slice(-31));failed[id]=Date.now()+cfg.farming.deathWindowMs;rejectionEvidence.set(id,{monster:id,until:Math.min(failed[id],Date.now()+600000),definition:knowledgeFingerprint(p.G.monsters?.[id])});p.write?.(riskKey,failed);activity=null;manual=null;plannedAt=0;bot.target=null;bot.movement.stop();bot.event('strategy.failedTarget',{target:id,reason,retryAfter:failed[id]});}
 function canVisit(h){if(bot.recovering||h.inventoryBlocked||h.rip||h.hp/h.max_hp<cfg.farming.resumeAbove)return false;
  const uncertainty=(h.motion?.moving?h.motion.speed:0)*Math.max(0,Date.now()-(h.motion?.at??Date.now()))/1000;if(uncertainty>(cfg.merchant.servicePositionError??70))return false;if(h.threats>0&&!h.motion)return false;if(h.threats>0&&h.hp/h.max_hp<(cfg.farming.pullHp??.8))return false;if(h.activity?.target){const m=p.G.monsters?.[h.activity.target];if(!m||!Number.isFinite(m.attack)||!(m.frequency>0)||m.attack*m.frequency>p.c.max_hp*.03)return false;}
  for(const spawn of p.G.maps?.[h.map]?.monsters??[]){const m=p.G.monsters?.[spawn.type],b=spawn.boundary;if(!(m?.aggro>0)||!Array.isArray(b)||b.length!==4)continue;const margin=(m.range??30)+120;if(h.x>=b[0]-margin&&h.x<=b[2]+margin&&h.y>=b[1]-margin&&h.y<=b[3]+margin&&m.attack*m.frequency>p.c.max_hp*.03)return false;}
  return true;
 }
 function safeMonster(id){return safeTarget(id);}

 function requestTask(value,ttlMs=120000){
  if(!bot.running||typeof value!=='string'||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>3600000)return false;
  const [kind,id]=value.split(':');
  if(kind==='farm'&&id&&!explicitTargets().includes(id))return false;
  if(kind==='boss'&&(!w.bosses||!w.allowedBosses.includes(id)))return false;
  if(kind==='event'&&(!w.events||!w.allowedEvents.includes(id)))return false;
  if(['fishing','mining','merrit','bank'].includes(kind)&&(me.role!=='merchant'||!cfg.merchant[kind]))return false;
  if(!['farm','boss','event','fishing','mining','merrit','bank'].includes(kind))return false;
  if(bot.journal||bot.logistics.reserved||questVisit)return false;
  manual={task:kind,id:id??null,until:Date.now()+ttlMs};activity=null;bot.target=null;bot.movement.stop();plannedAt=0;bot.event('strategy.request',{task:value,ttlMs});return true;
 }
 function encounter(kind,id){
  let live=state()[id];const meta=p.G.events?.[id],visible=bot.monsters().find(m=>m.mtype===id&&p.G.monsters[id]&&
   (kind==='boss'?w.allowedBosses:w.allowedEvents).includes(id));
  if(!live&&visible)live={live:true,type:id,map:visible.map,x:visible.real_x??visible.x,y:visible.real_y??visible.y};
  if(!live||typeof live!=='object'||!(live.live||live.active)||live.live===false||live.active===false||Number.isFinite(live.hp)&&live.hp<=0||Number.isFinite(live.expires)&&live.expires<Date.now())return null;
  const type=live.type&&p.G.monsters?.[live.type]?live.type:p.G.monsters?.[id]?id:null;
  if(!type||!safeMonster(type)||bot.content?.approve('activity:'+kind+':'+id,[p.G.monsters[type],p.G.events?.[id]])===false)return null;
  const map=live.map??meta?.map;if(!permittedMap(map))return null;
  const target=bot.monsters().find(m=>m.mtype===type);let x=live.x??target?.real_x??target?.x,y=live.y??target?.real_y??target?.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)){const spawn=p.G.maps[map]?.monsters?.find(m=>m.type===type),b=spawn?.boundary;if(Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)){x=(b[0]+b[2])/2;y=(b[1]+b[3])/2;}}
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {kind,id,target:type,definition:knowledgeFingerprint(p.G.monsters[type]),map,x,y,in:map,expires:Date.now()+Math.max(10000,w.cacheTtlMs*2)};
 }
 function validActivity(a){return a&&(!full||!a.definition||a.definition===knowledgeFingerprint(p.G.monsters[a.target]))&&(bot.content?.approve('activity:'+a.kind+':'+a.id,[p.G.monsters[a.target],p.G.events?.[a.id]])!==false)&&['boss','event','quest'].includes(a.kind)&&typeof a.id==='string'&&Number.isFinite(a.expires)&&a.expires>Date.now()&&a.expires<Date.now()+Math.max(120000,w.cacheTtlMs*3)&&permittedMap(a.map)&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&(a.kind==='quest'?w.quests&&w.questTargets:a.kind==='boss'?w.bosses&&w.allowedBosses.includes(a.id):w.events&&w.allowedEvents.includes(a.id))&&(!a.target||p.G.monsters[a.target]&&safeMonster(a.target));}
 function plan(){
  if(questVisit)return;
  const now=Date.now();if(manual?.until<=now){manual=null;activity=null;bot.target=null;bot.movement.stop();}
  if(lastG!==p.G){lastG=p.G;plannedAt=0;rates={};}
  if(activity){const live=state()[activity.id],visible=bot.monsters().some(m=>m.mtype===activity.target),questGone=activity.kind==='quest'&&me.name===bot.leader&&(!(p.c.s?.monsterhunt?.c>0)||p.c.s.monsterhunt.id!==activity.id);if(full&&activity.definition&&activity.definition!==knowledgeFingerprint(p.G.monsters[activity.target])||activity.expires<=now||questGone||activity.kind!=='quest'&&observeActivity(activity,live,visible,now,w.eventGraceMs??2500).state==='ended'||!safeMonster(activity.target)){activity=null;plannedAt=0;bot.target=null;bot.movement.stop();bot.event('strategy.return',{reason:'Aktivität beendet, nicht mehr beobachtet oder Risiko geändert'});}}
  if(activity&&activity.kind!=='quest'){
   const evidence=observeActivity(activity,state()[activity.id],bot.monsters().some(m=>m.mtype===activity.target),now,w.eventGraceMs??2500);
   if(evidence.state==='unknown'){activity.missingSince=evidence.missingSince;activity.observationUnknown=true;bot.target=null;bot.movement.stop();return;}
   delete activity.missingSince;delete activity.observationUnknown;
  }
  if(me.role==='merchant')return;
  if(cfg.party.enabled&&me.name!==bot.leader){const leader=bot.transport.fresh(bot.leader);activity=leader?.running&&leader.realm===p.realm()&&!leader.rip&&validActivity(leader.activity)?{...leader.activity}:null;return;}
  if(now-plannedAt<w.cacheTtlMs)return;plannedAt=now;
  let next=null;
  if(manual&&['boss','event'].includes(manual.task))next=encounter(manual.task,manual.id);
  else if(!manual){const options=[...(w.events?w.allowedEvents:[]).map(id=>encounter('event',id)),...(w.bosses?w.allowedBosses:[]).map(id=>encounter('boss',id))].filter(Boolean);if(full){const score=a=>{const m=p.G.monsters[a.target],travel=samePlace(p.c,a)?distance(p.c,a)/Math.max(1,p.c.speed??40):60,dps=members(true).reduce((n,c)=>n+(c.attack??0)*(c.frequency??1),0),seconds=Math.max(1,m.hp/Math.max(1,dps)),xp=(m.xp??0)*3600/(seconds+travel),gold=expectedMonsterGold(p.G,a.target)*3600/(seconds+travel);return (cfg.farming.mode==='xp'?xp:cfg.farming.mode==='gold'?gold:Math.sqrt(Math.max(1,xp)*Math.max(1,gold)))*1.25;};options.sort((a,b)=>score(b)-score(a));const farm=bot.teamPlan?.status().current?.score??0;next=options[0]&&score(options[0])>=farm?options[0]:null;}else next=options[0]??null;}
  if(!next&&!manual&&w.quests&&w.questTargets&&!bot.teamPlan?.orderedHunt?.()&&p.c.s?.monsterhunt?.c>0){const id=p.c.s.monsterhunt.id,d=safeMonster(id)&&bot.movement.farmLocation?.(id);if(d&&permittedMap(d.map)&&(!full||(p.G.monsters[id].xp??0)*3600/Math.max(1,p.G.monsters[id].hp/Math.max(1,p.c.attack*p.c.frequency))*(cfg.world.questPreference??1.1)>=(bot.teamPlan?.status().current?.score??0)))next={...d,kind:'quest',id,target:id,definition:knowledgeFingerprint(p.G.monsters[id]),expires:now+Math.max(10000,w.cacheTtlMs*2)};}
  if(activity?.id!==next?.id){bot.target=null;if(bot.movement.order?.owner==='farm'||bot.movement.order?.owner==='world')bot.movement.stop();bot.event('strategy.activity',{kind:next?.kind??'farm',id:next?.id??null});}activity=next;
 }
 function sample(){
  if(!w.learning||me.role!=='farmer')return;const now=Date.now(),id=bot.target?.mtype??targets()[0],xp=p.c.xp??0,gold=p.c.gold??0;
  if(lastSample&&id===lastSample.id&&now-lastSample.at>=10000&&!bot.journal&&xp>=lastSample.xp&&gold>=lastSample.gold){const observed=(xp-lastSample.xp)*1000/(now-lastSample.at),old=rates[id]??{xp:observed,samples:0,factor:1};old.xp=old.xp*.8+observed*.2;old.samples=Math.min(100,old.samples+1);old.factor=old.samples<3?1:Math.max(.5,Math.min(2,observed/Math.max(1,old.xp)));rates[id]=old;rates=Object.fromEntries(Object.entries(rates).slice(-32));lastSample=null;}
  if(!lastSample||lastSample.id!==id||now-lastSample.at>60000)lastSample={id,at:now,xp,gold};
 }
 function targets(){if(bot.teamPlan&&me.role==='farmer'&&!manual&&!activity)return bot.teamPlan.target()?[bot.teamPlan.target()]:[];if(activity?.target)return [activity.target].filter(id=>safeTarget(id));if(manual?.task==='farm'&&manual.id)return [manual.id].filter(id=>safeTarget(id));const material=bot.production?.farmTargets();if(material)return material.filter(id=>safeTarget(id));
  if(rankedG!==p.G||Date.now()-rankedAt>=w.cacheTtlMs){rankedG=p.G;rankedAt=Date.now();ranked=rankFarmTargets(p.G,p.c,explicitTargets(),cfg.farming.mode,rates,w.learning?w.learningWeight:0);}return ranked.filter(id=>safeTarget(id));
 }
 function travel(){
  if(activity?.observationUnknown){bot.target=null;bot.movement.stop();bot.reason='Aktivität kurz unbeobachtet: neue Reise/Pulls warten auf frische Sichtung';return true;}

  if(me.role==='merchant'&&manual?.task==='bank'){bot.bank.ready();return true;}
  if(me.role!=='farmer')return false;if(!activity)return bot.teamPlan?.travel()??false;
  if(full&&cfg.party.enabled&&cfg.party.waitForTeam&&me.name===bot.leader&&(bot.farmers??[]).some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.rip||bot.transport.fresh(n)?.realm!==p.realm()||!samePlace(p.c,bot.transport.fresh(n))||distance(p.c,bot.transport.fresh(n))>cfg.party.followDistance*2))){bot.reason='Warte auf Gruppe vor Aktivitätsreise';if(bot.movement.order?.owner==='world')bot.movement.stop();return true;}
  if(!samePlace(p.c,activity)){if(activity.kind==='event'&&p.G.events?.[activity.id]&&p.has('join'))return exec.run('event.join',['movement'],()=>bot.running&&!bot.journal,()=>p.call('join',activity.id),{delay:30000,timeout:20000});
   bot.movement.go({...activity,radius:70},'world');return true;}
  if(!bot.target&&distance(p.c,activity)>100){bot.movement.go({...activity,in:p.c.in??p.c.map,radius:70},'world');return true;}return false;
 }
 function quest(){
  if(questVisit){
   if(questTravelStalled(questVisit,p.c,{smart:bot.movement.order?.mode==='smart_move',
    town:bot.movement.townActive})){
    const elapsed=Date.now()-questVisit.progress.at;
    questVisit=null;nextQuest=Date.now()+60000;
    if(bot.movement.order?.owner==='quest'||bot.movement.townActive)bot.movement.stop();
    bot.event('quest.travelStalled',{elapsedMs:elapsed,
     reason:'No verified travel progress; resume approved farming'});
    return false;
   }
   if(questIdentity(p.c.s?.monsterhunt)!==questVisit.before&&questVisit.phase==='observing'){bot.event('quest.confirmed',{quest:'monsterhunt',reason:'Aktueller Queststatus hat sich geändert'});questVisit=null;nextQuest=Date.now()+5000;plannedAt=0;return false;}
   if(Date.now()>questVisit.until){const phase=questVisit.phase;questVisit=null;nextQuest=Date.now()+60000;bot.event('quest.timeout',{phase});if(phase==='observing')bot.pause('Monsterhunt ungeklärt: Queststatus prüfen');return true;}
   if(questVisit.phase==='observing'){bot.reason='Monsterhunt-Antwort bestätigen';return true;}
  }
  if(bot.teamPlan?.materialActive())return false;
  const turn=bot.teamPlan?.orderedHunt?.();
  if(!w.quests||me.role!=='farmer'||turn?.phase==='blocked'||
    cfg.party.enabled&&(turn?.owner??bot.leader)!==me.name||
    activity||bot.journal||bot.logistics.reserved)return false;
  const q=p.c.s?.monsterhunt;
  // Server authority: a timed-out 30-minute status must not be interpreted
  // as a new quest slot until the condition disappears from the character.
  if(q&&Number.isFinite(q.ms)&&q.ms<=0)return false;
  if(q?.c>0)return false;
  if(Date.now()<nextQuest||!p.has('interact')||!bot.economy)return false;const d=bot.economy.destination('monsterhunter');if(!d)return false;
  const squadPlan=bot.teamPlan?.heartbeat?.()??
   bot.transport?.fresh?.(bot.leader)?.farmPlan;
  const peer=n=>bot.transport?.fresh?.(n);
  const fighting=(bot.monsters?.()??[]).some(m=>m?.hp>0&&!m.dead&&
   bot.teamNames?.includes?.(m.target)===true)||(bot.farmers??[]).some(n=>n!==me.name&&peer(n)?.threats>0);
  if(!questVisit&&cfg.party.enabled&&(fighting||
    squadMarchStillInTransit(p.c,bot.farmers,squadPlan,peer)&&
    !squadReadyForQuestVisit(p.c,bot.farmers,peer,{realm:p.realm()}))){
   return false;
  }
  if(!questVisit){questVisit={phase:'travel',before:questIdentity(q),until:Date.now()+120000};bot.target=null;bot.movement.stop();bot.event('quest.visit',{quest:'monsterhunt',reason:'Aktiver Farmer nimmt eigenen Auftrag an oder gibt ihn ab'});}
  if(!bot.economy.at(d,70)){bot.reason='Unterwegs: Monsterhunt';bot.movement.go({...d,radius:60},'quest');return true;}
  const visit=questVisit;
  const accepted=exec.run('quest.monsterhunt',['quest'],()=>bot.running&&!bot.journal&&!bot.logistics.reserved&&bot.economy.at(d,70),()=>{visit.phase='observing';visit.until=Date.now()+15000;return p.call('interact','monsterhunt');},{timeout:10000,delay:5000,observe:()=>questIdentity(p.c.s?.monsterhunt)!==visit.before,onSettle:(result,error)=>{
   if(questVisit!==visit)return;if(result==='confirmed'){bot.event('quest.confirmed',{quest:'monsterhunt',reason:'Beobachteter Queststatus'});questVisit=null;nextQuest=Date.now()+60000;plannedAt=0;}
   else if(result==='rejected'){bot.event('quest.rejected',{reason:error?.reason??error?.message??'Server lehnt Interaktion ab'});questVisit=null;nextQuest=Date.now()+60000;}
  }});return accepted||!!questVisit;
 }
 function anniversary(){
  if(bot.teamPlan?.orderedHunt?.())return false; // serial monsterhunt first
  const s=state().anniversary;if(!w.anniversary||!s?.active||!s.live||!Number.isFinite(s.expires)||s.expires<Date.now()||s.available===false||!permittedMap(s.map)||!p.has('anniversary_can_visit')||!p.call('anniversary_can_visit')||!bot.economy)return false;
  const d={map:s.map,in:s.map,x:s.x,y:s.y};if(!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
  if(!bot.economy.travel(d,'Anniversary',55))return true;const before=JSON.stringify(p.c.anniversary??null),gifts=bot.count('anniversarygift');
  return bot.economy.perform('quest.anniversary',{guard:()=>bot.economy.at(d,80)&&p.call('anniversary_can_visit'),call:()=>p.call('anniversary_kiss'),observe:()=>bot.count('anniversarygift')>gifts||JSON.stringify(p.c.anniversary??null)!==before,details:{quest:'anniversary'},timeout:20000});
 }
 return {farmRejections:()=>[...rejectionEvidence.values()].filter(r=>r.until>Date.now()).slice(-4),plan,sample,targets,task,safeTarget,failActivity,canVisit,requestTask,travel,quest,anniversary,get busy(){return !!questVisit;},interruptQuest(){if(questVisit?.phase==='travel'){questVisit=null;nextQuest=Date.now()+60000;if(bot.movement.order?.owner==='quest'||bot.movement.townActive)bot.movement.stop();bot.event('quest.interrupted',{reason:'Eigene Aggro: Kampf/Erholung hat Vorrang'});}},permittedMap,status:()=>({task:task(),manual:manual?{...manual}:null,activity:activity?{...activity}:null,questVisit:questVisit?{...questVisit}:null,failedTargets:{...failed},learning:Object.keys(rates).length}),heartbeat:()=>activity?{...activity}:null,close(){activity=null;manual=null;questVisit=null;lastSample=null;plannedAt=0;}};
}
