import {distance,samePlace,xy} from '../core/policy.mjs';
import {materialDrops} from '../production/materials.mjs';
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
 const {p,cfg,me,exec}=bot,w=cfg.world;let activity=null,manual=null,plannedAt=0,lastG=null,lastSample=null,rates={},ranked=[],rankedAt=0,rankedG=null;
 const explicitTargets=()=>me.farmTargets.length?me.farmTargets:cfg.farming.targets;
 const state=()=>p.root.S??p.parent.S??{};
 const task=()=>manual?.task??(activity?.kind==='boss'?'boss':activity?.kind==='event'?'event':me.role==='merchant'?'supply':'farm');
 const permittedMap=map=>!!p.G.maps?.[map]&&!w.excludedMaps.includes(map)&&(!p.G.maps[map].pvp||cfg.farming.pvp);
 function safeMonster(id){const m=p.G.monsters?.[id];if(!m)return false;
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
  if(bot.journal||bot.logistics.reserved)return false;
  manual={task:kind,id:id??null,until:Date.now()+ttlMs};activity=null;bot.target=null;bot.movement.stop();plannedAt=0;bot.event('strategy.request',{task:value,ttlMs});return true;
 }
 function encounter(kind,id){
  const live=state()[id],meta=p.G.events?.[id];if(!live||typeof live!=='object'||!(live.live||live.active)||live.live===false||live.active===false)return null;
  const type=live.type&&p.G.monsters?.[live.type]?live.type:p.G.monsters?.[id]?id:null;
  if(!type||!safeMonster(type))return null;
  const map=live.map??meta?.map;if(!permittedMap(map))return null;
  const target=bot.monsters().find(m=>m.mtype===type),x=live.x??target?.x,y=live.y??target?.y;
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {kind,id,target:type,map,x,y,in:map,expires:Date.now()+Math.max(10000,w.cacheTtlMs*2)};
 }
 function validActivity(a){return a&&['boss','event'].includes(a.kind)&&typeof a.id==='string'&&Number.isFinite(a.expires)&&a.expires>Date.now()&&a.expires<Date.now()+Math.max(120000,w.cacheTtlMs*3)&&permittedMap(a.map)&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&(a.kind==='boss'?w.bosses&&w.allowedBosses.includes(a.id):w.events&&w.allowedEvents.includes(a.id))&&(!a.target||p.G.monsters[a.target]&&safeMonster(a.target));}
 function plan(){
  const now=Date.now();if(manual?.until<=now){manual=null;activity=null;bot.target=null;bot.movement.stop();}
  if(lastG!==p.G){lastG=p.G;plannedAt=0;rates={};}
  if(now-plannedAt<w.cacheTtlMs)return;plannedAt=now;
  if(me.role==='merchant')return;
  if(cfg.party.enabled&&me.name!==bot.leader){const leader=bot.transport.fresh(bot.leader);activity=validActivity(leader?.activity)?{...leader.activity}:null;return;}
  let next=null;
  if(manual&&['boss','event'].includes(manual.task))next=encounter(manual.task,manual.id);
  else if(!manual){for(const id of w.events?w.allowedEvents:[]){next=encounter('event',id);if(next)break;}if(!next)for(const id of w.bosses?w.allowedBosses:[]){next=encounter('boss',id);if(next)break;}}
  if(activity?.id!==next?.id){bot.target=null;if(bot.movement.order?.owner==='farm'||bot.movement.order?.owner==='world')bot.movement.stop();bot.event('strategy.activity',{kind:next?.kind??'farm',id:next?.id??null});}activity=next;
 }
 function sample(){
  if(!w.learning||me.role!=='farmer')return;const now=Date.now(),id=bot.target?.mtype??targets()[0],xp=p.c.xp??0,gold=p.c.gold??0;
  if(lastSample&&id===lastSample.id&&now-lastSample.at>=10000&&!bot.journal&&xp>=lastSample.xp&&gold>=lastSample.gold){const observed=(xp-lastSample.xp)*1000/(now-lastSample.at),old=rates[id]??{xp:observed,samples:0,factor:1};old.xp=old.xp*.8+observed*.2;old.samples=Math.min(100,old.samples+1);old.factor=old.samples<3?1:Math.max(.5,Math.min(2,observed/Math.max(1,old.xp)));rates[id]=old;rates=Object.fromEntries(Object.entries(rates).slice(-32));lastSample=null;}
  if(!lastSample||lastSample.id!==id||now-lastSample.at>60000)lastSample={id,at:now,xp,gold};
 }
 function targets(){if(activity?.target)return [activity.target];if(manual?.task==='farm'&&manual.id)return [manual.id];const material=bot.production?.farmTargets();if(material)return material;
  if(rankedG!==p.G||Date.now()-rankedAt>=w.cacheTtlMs){rankedG=p.G;rankedAt=Date.now();ranked=rankFarmTargets(p.G,p.c,explicitTargets(),cfg.farming.mode,rates,w.learning?w.learningWeight:0);}return ranked;
 }
 function travel(){
  if(me.role==='merchant'&&manual?.task==='bank'){bot.bank.ready();return true;}
  if(me.role!=='farmer'||!activity)return false;
  if(!samePlace(p.c,activity)){if(activity.kind==='event'&&p.G.events?.[activity.id]&&p.has('join'))return exec.run('event.join',['movement'],()=>bot.running&&!bot.journal,()=>p.call('join',activity.id),{delay:30000,timeout:20000});
   bot.movement.go({...activity,radius:70},'world');return true;}
  if(!bot.target&&distance(p.c,activity)>100){bot.movement.go({...activity,in:p.c.in??p.c.map,radius:70},'world');return true;}return false;
 }
 function quest(){
  if(manual||!w.quests||me.role!=='farmer'||activity||bot.journal||bot.logistics.reserved)return false;
  const q=p.c.s?.monsterhunt;if(q?.c>0){if(explicitTargets().includes(q.id)&&!manual)manual={task:'farm',id:q.id,until:Date.now()+Math.min(600000,q.ms??600000)};return false;}
  if(!p.has('use_skill')||!bot.economy)return false;const d=bot.economy.destination('monsterhunter');if(!d)return false;
  if(!bot.economy.travel(d,'Monsterhunt',70))return true;const before=JSON.stringify(q??null);
  return bot.economy.perform('quest.monsterhunt',{guard:()=>bot.economy.at(d),call:()=>p.call('use_skill','monsterhunt'),observe:()=>JSON.stringify(p.c.s?.monsterhunt??null)!==before,details:{quest:'monsterhunt'},timeout:20000});
 }
 function anniversary(){
  const s=state().anniversary;if(manual||!w.anniversary||!s?.active||!s.live||!Number.isFinite(s.expires)||s.expires<Date.now()||s.available===false||!permittedMap(s.map)||!p.has('anniversary_can_visit')||!p.call('anniversary_can_visit')||!bot.economy)return false;
  const d={map:s.map,in:s.map,x:s.x,y:s.y};if(!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
  if(!bot.economy.travel(d,'Anniversary',55))return true;const before=JSON.stringify(p.c.anniversary??null),gifts=bot.count('anniversarygift');
  return bot.economy.perform('quest.anniversary',{guard:()=>bot.economy.at(d,80)&&p.call('anniversary_can_visit'),call:()=>p.call('anniversary_kiss'),observe:()=>bot.count('anniversarygift')>gifts||JSON.stringify(p.c.anniversary??null)!==before,details:{quest:'anniversary'},timeout:20000});
 }
 return {plan,sample,targets,task,requestTask,travel,quest,anniversary,permittedMap,status:()=>({task:task(),manual:manual?{...manual}:null,activity:activity?{...activity}:null,learning:Object.keys(rates).length}),heartbeat:()=>activity?{...activity}:null,close(){activity=null;manual=null;lastSample=null;plannedAt=0;}};
}
