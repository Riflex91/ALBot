import {distance} from '../core/policy.mjs';
import {knowledgeFingerprint} from '../world/knowledge.mjs';
export function createEncounter(bot){
 const key='albot:pull:'+bot.me.name;let profiles=bot.p.read(key)??{},active=null,phase='RECOVER',capacity=1,context='',lastSave=0;
 function members(){return bot.farmers.map(n=>n===bot.me.name?{name:n,running:bot.running,hp:bot.p.c.hp,max_hp:bot.p.c.max_hp,mp:bot.p.c.mp,max_mp:bot.p.c.max_mp,gear:bot.gear?.snapshot(),capabilities:bot.capabilities?.snapshot()}:bot.transport.fresh(n)).filter(h=>h?.running&&!h.rip);}
 function complete(failed){if(!active)return;const row=profiles[active.key]??{samples:0,seconds:0,xp:0,failures:0};row.samples++;row.seconds+=(Date.now()-active.at)/1000;row.xp+=Math.max(0,(bot.p.c.xp??0)-active.xp);row.failures+=failed?1:0;bot.adaptive?.episode({target:active.target,contextKey:active.adaptiveContext,seconds:(Date.now()-active.at)/1000,reward:Math.max(0,(bot.p.c.xp??0)-active.xp),failed});row.at=Date.now();profiles[active.key]=row;active=null;profiles=Object.fromEntries(Object.entries(profiles).sort((a,b)=>b[1].at-a[1].at).slice(0,96));if(Date.now()-lastSave>30000){lastSave=Date.now();bot.p.write(key,profiles);}}
 function tick(){const ms=members(),target=bot.strategy?.heartbeat?.()?.target??bot.teamPlan?.target(),mobs=bot.monsters().filter(m=>bot.teamNames.includes(m.target)),healthy=ms.length===bot.farmers.length&&ms.every(h=>h.hp/h.max_hp>=(bot.cfg.farming.pullHp??.8)&&h.mp/Math.max(1,h.max_mp)>=(bot.cfg.farming.pullMp??.5));
  context=knowledgeFingerprint([ms.map(h=>[h.name,h.gear?.slots,h.gear?.stats]),target,bot.p.G.monsters?.[target]]);
  const aoe=ms.flatMap(h=>h.capabilities?.aoe??[]),max=bot.cfg.party.aoe&&aoe.length?Math.min(bot.cfg.farming.maxAggro,bot.cfg.party.aoeMaxTargets,Math.max(...aoe.map(s=>s.capacity))):1;
  capacity=1;for(let size=1;size<=max;size++){const row=profiles[context+':'+size];if(row?.failures&&row.failures/row.samples>.1)break;const prev=profiles[context+':'+capacity],rate=row?.xp/Math.max(1,row?.seconds??0),previous=prev?.xp/Math.max(1,prev?.seconds??0);if(size===1||row?.samples>=3&&rate>previous*1.05)capacity=size;else if(size===capacity+1&&healthy&&(prev?.samples??0)>=1&&!(prev?.failures)&&bot.cfg.farming.adaptivePull!==false){capacity=size;break;}}
  if(bot.recovering||bot.p.c.rip||active&&ms.length!==bot.farmers.length||ms.some(h=>h.hp/h.max_hp<(bot.cfg.farming.restBelow??.3)||h.mp/Math.max(1,h.max_mp)<.15)){phase=mobs.length?'ABORT':'RECOVER';if(active)complete(true);}else if(!mobs.length){if(active)complete(false);phase=healthy?'BUILD':'RECOVER';}else if(!healthy)phase='HOLD';else if(mobs.length<capacity)phase='BUILD';else phase=mobs.every(m=>m.hp<(bot.p.c.attack??1)*2)?'FINISH':'BURN';
  if(active&&mobs.length)active.key=context+':'+Math.max(Number(active.key.split(':').at(-1)),Math.min(max,mobs.length));if(mobs.length&&!active)active={target,adaptiveContext:bot.adaptive?.context(),key:context+':'+Math.max(1,Math.min(max,mobs.length)),at:Date.now(),xp:bot.p.c.xp??0};
 }
 function permit(m){
  if(m.target)return true;
  if(bot.me.name!==bot.leader&&bot.cfg.party.enabled)return false;
  const engaged=bot.monsters().filter(x=>x.target&&bot.teamNames.includes(x.target)).length;
  const planned=m.mtype&&m.mtype===bot.teamPlan?.target();
  if(planned&&bot.teamPlan?.wantsCombat?.()===false)return false;
  if(phase==='BUILD')return engaged<capacity;
  // Party-wide 50% MP is a *multi-pull* readiness threshold, not a
  // veto on every basic solo attack. When a member is regenerating mana
  // above the emergency floor, continue safely with ONE neutral mob.
  // Never relax this for injured teams, existing aggro or an active retreat.
  if(phase==='RECOVER'&&!bot.recovering&&engaged===0){
    const team=members();
    const hpFloor=Math.max(bot.cfg.farming.pullHp??.8,bot.cfg.farming.restBelow??.4);
    return team.length===bot.farmers.length&&team.every(h=>
      h.hp/Math.max(1,h.max_hp)>=hpFloor&&
      h.mp/Math.max(1,h.max_mp)>=.15);
  }
  return false;
 }
 function pull(){
  if(bot.me.name!==bot.leader||phase!=='BUILD'||capacity<2||!bot.teamPlan?.target()||!bot.teamPlan.wantsCombat())return false;
  const engaged=bot.monsters().filter(m=>m.target&&bot.teamNames.includes(m.target));
  if(!engaged.length||engaged.length>=capacity||bot.recovering)return false;
  if(bot.capabilities?.available(bot.me.name,'agitate')){
   const range=bot.p.G.skills.agitate?.range??320,near=bot.monsters().filter(m=>distance(bot.p.c,m)<=range);
   if(near.length>=2&&near.length<=capacity&&near.every(m=>m.mtype===bot.teamPlan.target()&&(!m.target||bot.teamNames.includes(m.target))&&bot.strategy.safeTarget(m.mtype,m))&&bot.skills.use('agitate',null,.35,2000))return true;
  }
  // Rangers cannot use agitate. Pull ONE additional explicitly selected, safe
  // spawn mob with the normal attack; teammates can then use 3shot/5shot.
  const range=Math.max(5,(bot.p.c.range??0)-Math.min(bot.cfg.farming.rangeBuffer??0,(bot.p.c.range??0)*.25));
  const candidate=bot.monsters().filter(m=>!m.target&&m.mtype===bot.teamPlan.target()&&distance(bot.p.c,m)<=range&&bot.allowed(m)&&bot.strategy.safeTarget(m.mtype,m)).sort((a,b)=>distance(bot.p.c,a)-distance(bot.p.c,b))[0];
  if(!candidate)return false;
  const guard=()=>{
   const m=bot.entity(candidate.id);
   return bot.running&&phase==='BUILD'&&capacity>1&&bot.teamPlan.target()===candidate.mtype&&m&&!m.target&&
    bot.monsters().filter(t=>t.target&&bot.teamNames.includes(t.target)).length<capacity&&
    bot.allowed(m)&&bot.strategy.safeTarget(m.mtype,m)&&distance(bot.p.c,m)<=range&&
    bot.p.call('can_attack',m)&&!bot.p.call('is_on_cooldown','attack');
  };
  return bot.exec.run('attack',['attack','mana'],guard,()=>bot.p.call('attack',bot.entity(candidate.id)),{delay:250});
 }
 return {tick,permit,pull,status:()=>({phase,capacity,context,profiles:Object.keys(profiles).length}),close(){complete(phase==='ABORT');bot.p.write(key,profiles);}};
}
