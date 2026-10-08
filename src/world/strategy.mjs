import {distance,samePlace,xy} from '../core/policy.mjs';
import {materialDrops} from '../production/materials.mjs';
import {assessCombat} from './risk.mjs';
export function rankFarmTargets(G,character,targets,mode='balanced',learned={},weight=0){
 return targets.filter(id=>G.monsters?.[id]).map((id,index)=>{
  const m=G.monsters[id],seconds=Math.max(1,(m.hp??100)/Math.max(1,(character.attack??1)*(character.frequency??1))),xp=(m.xp??1)/seconds;
  const gold=materialDrops(G,G.drops?.monsters?.[id]).filter(d=>d.item==='gold').reduce((n,d)=>n+d.chance*d.quantity,0)/seconds;
  const risk=1+Math.max(0,(m.attack??0)/Math.max(1,character.max_hp??1))*10;
  const base=(mode==='xp'?xp:mode==='gold'?gold:mode==='materials'?1:Math.sqrt(Math.max(1,xp)*Math.max(1,gold)))/risk;
  const adjust=1+Math.max(-weight,Math.min(weight,(learned[id]?.factor??1)-1));return {id,index,score:base*adjust};
 }).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.id);
}
export function createStrategy(bot){
 const {p,cfg,me,exec}=bot,w=cfg.world;let activity=null,manual=null,plannedAt=0,lastG=null,lastSample=null,rates={},ranked=[],rankedAt=0,rankedG=null,questVisit=null,nextQuest=0;
 const full=cfg.general.testLogging!==undefined,riskKey='albot:risk:'+me.name;let failed=p.read?.(riskKey)??{},lastRisk=new Map();
 const explicitTargets=()=>me.farmTargets.length?me.farmTargets:cfg.farming.targets;
 const state=()=>p.root.S??p.parent.S??{};
 const task=()=>manual?.task??(activity?.kind==='boss'?'boss':activity?.kind==='event'?'event':activity?.kind==='quest'?'quest':me.role==='merchant'?'supply':'farm');
 const permittedMap=map=>!!p.G.maps?.[map]&&!w.excludedMaps.includes(map)&&(!p.G.maps[map].pvp||cfg.farming.pvp);
 function members(){return [p.c,...(bot.farmers??[]).filter(n=>n!==me.name).map(n=>bot.transport.fresh(n)).filter(h=>h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,h)&&distance(p.c,h)<=cfg.party.followDistance*2).map(h=>({...h,...h.stats,...h.gear?.stats,hp:h.hp,max_hp:h.max_hp}))].filter(c=>c.name!==cfg.party.merchant);}
 function risk(id,live){return assessCombat({...p.G.monsters?.[id],...live,hp:Math.max(p.G.monsters?.[id]?.hp??0,live?.max_hp??live?.hp??0)},members(),w.risk,cfg.farming.maxAggro);}
 function safeTarget(id,live){if(!full)return true;if(failed[id]>Date.now())return false;const result=risk(id,live);if(!result.safe&&lastRisk.get(id)!==result.reason){if(lastRisk.size>64)lastRisk.clear();lastRisk.set(id,result.reason);bot.event('strategy.riskRejected',{target:id,...result});}return result.safe;}
 function failActivity(reason,id=activity?.target??bot.target?.mtype){if(!full||!id||failed[id]>Date.now())return;failed=Object.fromEntries(Object.entries(failed).filter(([,until])=>until>Date.now()).slice(-31));failed[id]=Date.now()+cfg.farming.deathWindowMs;p.write?.(riskKey,failed);activity=null;manual=null;plannedAt=0;bot.target=null;bot.movement.stop();bot.event('strategy.failedTarget',{target:id,reason,retryAfter:failed[id]});}
 function canVisit(h){if(!full)return true;if(bot.recovering||h.threats>0||h.rip||h.hp/h.max_hp<cfg.farming.resumeAbove)return false;
  if(h.activity?.target){const m=p.G.monsters?.[h.activity.target];if(!m||!Number.isFinite(m.attack)||!(m.frequency>0)||m.attack*m.frequency>p.c.max_hp*.03)return false;}
  for(const spawn of p.G.maps?.[h.map]?.monsters??[]){const m=p.G.monsters?.[spawn.type],b=spawn.boundary;if(!(m?.aggro>0)||!Array.isArray(b)||b.length!==4)continue;const margin=(m.range??30)+120;if(h.x>=b[0]-margin&&h.x<=b[2]+margin&&h.y>=b[1]-margin&&h.y<=b[3]+margin&&m.attack*m.frequency>p.c.max_hp*.03)return false;}
  return true;
 }
 function safeMonster(id){if(full)return safeTarget(id);const m=p.G.monsters?.[id];if(!m)return false;
  const limit={conservative:.12,balanced:.25,aggressive:.4}[w.risk],members=bot.allies().filter(x=>!x.rip),hp=Math.max(p.c.max_hp??0,...members.map(x=>x.max_hp??0));
  return Number.isFinite(m.attack)&&m.attack<=hp*limit;
 }
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
  let live=state()[id];const meta=p.G.events?.[id],visible=bot.monsters().find(m=>m.mtype===id&&p.G.monsters[id]?.boss);
  if(!live&&visible)live={live:true,type:id,map:visible.map,x:visible.real_x??visible.x,y:visible.real_y??visible.y};
  if(!live||typeof live!=='object'||!(live.live||live.active)||live.live===false||live.active===false||Number.isFinite(live.hp)&&live.hp<=0||Number.isFinite(live.expires)&&live.expires<Date.now())return null;
  const type=live.type&&p.G.monsters?.[live.type]?live.type:p.G.monsters?.[id]?id:null;
  if(!type||!safeMonster(type))return null;
  const map=live.map??meta?.map;if(!permittedMap(map))return null;
  const target=bot.monsters().find(m=>m.mtype===type);let x=live.x??target?.real_x??target?.x,y=live.y??target?.real_y??target?.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)){const spawn=p.G.maps[map]?.monsters?.find(m=>m.type===type),b=spawn?.boundary;if(Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)){x=(b[0]+b[2])/2;y=(b[1]+b[3])/2;}}
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {kind,id,target:type,map,x,y,in:map,expires:Date.now()+Math.max(10000,w.cacheTtlMs*2)};
 }
 function validActivity(a){return a&&['boss','event','quest'].includes(a.kind)&&typeof a.id==='string'&&Number.isFinite(a.expires)&&a.expires>Date.now()&&a.expires<Date.now()+Math.max(120000,w.cacheTtlMs*3)&&permittedMap(a.map)&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&(a.kind==='quest'?w.quests&&w.questTargets:a.kind==='boss'?w.bosses&&w.allowedBosses.includes(a.id):w.events&&w.allowedEvents.includes(a.id))&&(!a.target||p.G.monsters[a.target]&&safeMonster(a.target));}
 function plan(){
  if(questVisit)return;
  const now=Date.now();if(manual?.until<=now){manual=null;activity=null;bot.target=null;bot.movement.stop();}
  if(lastG!==p.G){lastG=p.G;plannedAt=0;rates={};}
  if(activity){const live=state()[activity.id],visible=bot.monsters().some(m=>m.mtype===activity.target),questGone=activity.kind==='quest'&&me.name===bot.leader&&(!(p.c.s?.monsterhunt?.c>0)||p.c.s.monsterhunt.id!==activity.id);if(activity.expires<=now||questGone||activity.kind!=='quest'&&(live&&(live.live===false||live.active===false||live.hp===0)||!live&&!visible)||!safeMonster(activity.target)){activity=null;plannedAt=0;bot.target=null;bot.movement.stop();bot.event('strategy.return',{reason:'Aktivität beendet, nicht mehr beobachtet oder Risiko geändert'});}}
  if(me.role==='merchant')return;
  if(cfg.party.enabled&&me.name!==bot.leader){const leader=bot.transport.fresh(bot.leader);activity=leader?.running&&leader.realm===p.realm()&&!leader.rip&&validActivity(leader.activity)?{...leader.activity}:null;return;}
  if(now-plannedAt<w.cacheTtlMs)return;plannedAt=now;
  let next=null;
  if(manual&&['boss','event'].includes(manual.task))next=encounter(manual.task,manual.id);
  else if(!manual){for(const id of w.events?w.allowedEvents:[]){next=encounter('event',id);if(next)break;}if(!next)for(const id of w.bosses?w.allowedBosses:[]){next=encounter('boss',id);if(next)break;}}
  if(!next&&!manual&&w.quests&&w.questTargets&&p.c.s?.monsterhunt?.c>0){const id=p.c.s.monsterhunt.id,d=safeMonster(id)&&bot.movement.farmLocation?.(id);if(d&&permittedMap(d.map))next={...d,kind:'quest',id,target:id,expires:now+Math.max(10000,w.cacheTtlMs*2)};}
  if(activity?.id!==next?.id){bot.target=null;if(bot.movement.order?.owner==='farm'||bot.movement.order?.owner==='world')bot.movement.stop();bot.event('strategy.activity',{kind:next?.kind??'farm',id:next?.id??null});}activity=next;
 }
 function sample(){
  if(!w.learning||me.role!=='farmer')return;const now=Date.now(),id=bot.target?.mtype??targets()[0],xp=p.c.xp??0,gold=p.c.gold??0;
  if(lastSample&&id===lastSample.id&&now-lastSample.at>=10000&&!bot.journal&&xp>=lastSample.xp&&gold>=lastSample.gold){const observed=(xp-lastSample.xp)*1000/(now-lastSample.at),old=rates[id]??{xp:observed,samples:0,factor:1};old.xp=old.xp*.8+observed*.2;old.samples=Math.min(100,old.samples+1);old.factor=old.samples<3?1:Math.max(.5,Math.min(2,observed/Math.max(1,old.xp)));rates[id]=old;rates=Object.fromEntries(Object.entries(rates).slice(-32));lastSample=null;}
  if(!lastSample||lastSample.id!==id||now-lastSample.at>60000)lastSample={id,at:now,xp,gold};
 }
 function targets(){if(activity?.target)return [activity.target].filter(id=>safeTarget(id));if(manual?.task==='farm'&&manual.id)return [manual.id].filter(id=>safeTarget(id));const material=bot.production?.farmTargets();if(material)return material.filter(id=>safeTarget(id));
  if(rankedG!==p.G||Date.now()-rankedAt>=w.cacheTtlMs){rankedG=p.G;rankedAt=Date.now();ranked=rankFarmTargets(p.G,p.c,explicitTargets(),cfg.farming.mode,rates,w.learning?w.learningWeight:0);}return ranked.filter(id=>safeTarget(id));
 }
 function travel(){
  if(me.role==='merchant'&&manual?.task==='bank'){bot.bank.ready();return true;}
  if(me.role!=='farmer'||!activity)return false;
  if(full&&cfg.party.enabled&&cfg.party.waitForTeam&&me.name===bot.leader&&(bot.farmers??[]).some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.rip||bot.transport.fresh(n)?.realm!==p.realm()||!samePlace(p.c,bot.transport.fresh(n))||distance(p.c,bot.transport.fresh(n))>cfg.party.followDistance*2))){bot.reason='Warte auf Gruppe vor Aktivitätsreise';if(bot.movement.order?.owner==='world')bot.movement.stop();return true;}
  if(!samePlace(p.c,activity)){if(activity.kind==='event'&&p.G.events?.[activity.id]&&p.has('join'))return exec.run('event.join',['movement'],()=>bot.running&&!bot.journal,()=>p.call('join',activity.id),{delay:30000,timeout:20000});
   bot.movement.go({...activity,radius:70},'world');return true;}
  if(!bot.target&&distance(p.c,activity)>100){bot.movement.go({...activity,in:p.c.in??p.c.map,radius:70},'world');return true;}return false;
 }
 function quest(){
  if(questVisit){
   if(JSON.stringify(p.c.s?.monsterhunt??null)!==questVisit.before&&questVisit.phase==='observing'){bot.event('quest.confirmed',{quest:'monsterhunt',reason:'Aktueller Queststatus hat sich geändert'});questVisit=null;nextQuest=Date.now()+60000;plannedAt=0;return false;}
   if(Date.now()>questVisit.until){const phase=questVisit.phase;questVisit=null;nextQuest=Date.now()+60000;bot.event('quest.timeout',{phase});if(phase==='observing')bot.pause('Monsterhunt ungeklärt: Queststatus prüfen');return true;}
   if(questVisit.phase==='observing'){bot.reason='Monsterhunt-Antwort bestätigen';return true;}
  }
  if(!w.quests||me.role!=='farmer'||cfg.party.enabled&&me.name!==bot.leader||activity||bot.journal||bot.logistics.reserved)return false;
  const q=p.c.s?.monsterhunt;if(q?.c>0)return false;
  if(Date.now()<nextQuest||!p.has('interact')||!bot.economy)return false;const d=bot.economy.destination('monsterhunter');if(!d)return false;
  if(!questVisit){questVisit={phase:'travel',before:JSON.stringify(q??null),until:Date.now()+120000};bot.target=null;bot.movement.stop();bot.event('quest.visit',{quest:'monsterhunt',reason:'Leader nimmt Auftrag an oder holt abgeschlossenen Auftrag ab'});}
  if(!bot.economy.at(d,70)){bot.reason='Unterwegs: Monsterhunt';bot.movement.go({...d,radius:60},'quest');return true;}
  const visit=questVisit;
  const accepted=exec.run('quest.monsterhunt',['quest'],()=>bot.running&&!bot.journal&&!bot.logistics.reserved&&bot.economy.at(d,70),()=>{visit.phase='observing';visit.until=Date.now()+15000;return p.call('interact','monsterhunt');},{timeout:10000,delay:60000,observe:()=>JSON.stringify(p.c.s?.monsterhunt??null)!==visit.before,onSettle:(result,error)=>{
   if(questVisit!==visit)return;if(result==='confirmed'){bot.event('quest.confirmed',{quest:'monsterhunt',reason:'Beobachteter Queststatus'});questVisit=null;nextQuest=Date.now()+60000;plannedAt=0;}
   else if(result==='rejected'){bot.event('quest.rejected',{reason:error?.reason??error?.message??'Server lehnt Interaktion ab'});questVisit=null;nextQuest=Date.now()+60000;}
  }});return accepted||!!questVisit;
 }
 function anniversary(){
  const s=state().anniversary;if(!w.anniversary||!s?.active||!s.live||!Number.isFinite(s.expires)||s.expires<Date.now()||s.available===false||!permittedMap(s.map)||!p.has('anniversary_can_visit')||!p.call('anniversary_can_visit')||!bot.economy)return false;
  const d={map:s.map,in:s.map,x:s.x,y:s.y};if(!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
  if(!bot.economy.travel(d,'Anniversary',55))return true;const before=JSON.stringify(p.c.anniversary??null),gifts=bot.count('anniversarygift');
  return bot.economy.perform('quest.anniversary',{guard:()=>bot.economy.at(d,80)&&p.call('anniversary_can_visit'),call:()=>p.call('anniversary_kiss'),observe:()=>bot.count('anniversarygift')>gifts||JSON.stringify(p.c.anniversary??null)!==before,details:{quest:'anniversary'},timeout:20000});
 }
 return {plan,sample,targets,task,safeTarget,failActivity,canVisit,requestTask,travel,quest,anniversary,get busy(){return !!questVisit;},interruptQuest(){if(questVisit?.phase==='travel'){questVisit=null;nextQuest=Date.now()+60000;if(bot.movement.order?.owner==='quest')bot.movement.stop();bot.event('quest.interrupted',{reason:'Eigene Aggro: Kampf/Erholung hat Vorrang'});}},permittedMap,status:()=>({task:task(),manual:manual?{...manual}:null,activity:activity?{...activity}:null,questVisit:questVisit?{...questVisit}:null,failedTargets:{...failed},learning:Object.keys(rates).length}),heartbeat:()=>activity?{...activity}:null,close(){activity=null;manual=null;questVisit=null;lastSample=null;plannedAt=0;}};
}
