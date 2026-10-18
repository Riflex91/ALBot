import {distance,xy,samePlace,protectedItem,fingerprint} from '../core/policy.mjs';
import {isNaturallyAggressive,isOwnAggressiveThreat} from './aggression.mjs';
import {neutralPullReadiness,followerReassemblyDistance,followerCombatRendezvous} from './team-readiness.mjs';
import {farmingStoragePressure,defensiveFarmTarget} from './storage-backpressure.mjs';
import {preferUnreservedEngagedTarget,provisionalImpactDamage} from './impact-coordination.mjs';
import {roadAggroTravelDecision,committedFarmTransit} from './transit-defense.mjs';
// A validated, already engaged team threat remains eligible for defensive
// focus fire after a safe farm-plan change. Unengaged off-plan spawns may
// never be pulled through this exception.
// Deterministic emergency focus prevents each Ranger from independently
// picking a different engaged attacker while a teammate is in danger.
// Incomplete patient data ranks LAST; it never becomes invented survivability.
export function chooseEmergencyFocus(monsters,members=[]){
 const health=new Map((members??[]).filter(m=>m&&typeof m.name==='string'&&
  Number.isFinite(m.hp)&&Number.isFinite(m.max_hp)&&m.max_hp>0)
  .map(m=>[m.name,m.hp/m.max_hp]));
 return (monsters??[]).filter(m=>m?.id&&m.hp>0&&!m.dead&&
   health.has(m.target)).slice().sort((a,b)=>
   health.get(a.target)-health.get(b.target)||
   a.hp-b.hp||String(a.id).localeCompare(String(b.id)))[0]??null;
}
// Every transit tick can choose a nearby, fresh, injured teammate,
// independently of whether an aggro emergency was raised.
// A shared endpoint, not a moving heartbeat coordinate, keeps all Farmers
// traveling continuously on the same native navigation route.
export function sharedFarmMarchDestination(follower,leader,realm){
 // Full plans can be dropped to satisfy the transport size limit. Only
 // the selected leader's fresh compact march endpoint is a safe fallback;
 // this is escort navigation, NOT permission to farm an unapproved target.
 const compact=leader?.march;
 const plan=leader?.farmPlan??(compact?.plan?{
  id:compact.plan,realm:compact.realm,map:compact.map,
  in:compact.in??compact.map,x:compact.x,y:compact.y,
  target:compact.target
 }:null);
 if(!leader?.running||leader.rip||leader.questVisit===true||leader.squadQuestVisit===true||leader.realm!==realm||
    !plan||plan.realm!==realm||!Number.isFinite(plan.x)||
    !Number.isFinite(plan.y)||typeof plan.map!=='string')return null;
 const followerEnRoute=!samePlace(follower,plan)||distance(follower,plan)>75;
 const leaderEnRoute=!samePlace(leader,plan)||distance(leader,plan)>85;
 return followerEnRoute||leaderEnRoute?{...plan,radius:65}:null;
}
export function selectMarchHealingPatient(character,roster,{realm,now=Date.now(),
 threshold=.85}={}){
 if(character?.ctype!=='priest'||!Array.isArray(roster))return null;
 return roster.filter(h=>h?.name&&h.name!==character.name&&
  h.running&&!h.rip&&h.realm===realm&&samePlace(character,h)&&
  Number.isFinite(h.received)&&h.received<=now&&now-h.received<=4000&&
  Number.isFinite(h.hp)&&Number.isFinite(h.max_hp)&&h.max_hp>0&&
  h.hp>0&&h.hp/h.max_hp<threshold).sort((a,b)=>
   a.hp/a.max_hp-b.hp/b.max_hp||a.name.localeCompare(b.name))[0]??null;
}
export function farmPlanOrTeamDefense(targets,monster,teamNames){
 return !!monster&&(targets??[]).includes(monster.mtype)||
  !!(monster?.target&&(teamNames??[]).includes(monster.target));
}
export function combatApproach(character,target,range,canMove){const a=xy(character),b=xy(target),d=distance(character,target),step=Math.min(60,Math.max(0,d-range+3)),x=a.x+(b.x-a.x)*step/(d||1),y=a.y+(b.y-a.y)*step/(d||1);
 return canMove(x,y)?{map:character.map,in:character.in??character.map,x,y,radius:6}:{map:target.map??character.map,in:target.in??character.in??character.map,...b,radius:range};
}
export function recoveryHpThreshold(rest,hpBelow,resumeAbove,preparing,pullHp){
 return rest?Math.max(hpBelow,resumeAbove):(preparing?(pullHp??hpBelow):hpBelow);
}
// Potion activation uses absolute missing resource, not a percent of max.
// At precisely 300 missing HP/MP no potion is consumed.
export function potionResource(c,threshold=300){
 const hp=Math.max(0,(c.max_hp??0)-(c.hp??0));
 const mp=Math.max(0,(c.max_mp??0)-(c.mp??0));
 return hp>threshold?'hp':mp>threshold?'mp':null;
}
export function createFarmer(bot){
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastLoot=0,lastTravel=0,cohesion={key:'',progress:0,gap:Infinity,attempt:0},lastRedirect={key:'',at:0},lastEmergencyFocus={key:'',at:0},lastMarchHeal={key:'',at:0};
  const actionReason=x=>String(x?.reason??x?.message??x?.error??'');
  let lastRoadAggroAt=0;
  const travelPlan=()=>bot.teamPlan?.heartbeat?.()??
    bot.transport?.fresh?.(bot.leader)?.farmPlan;
  const roadTravel=()=>roadAggroTravelDecision(p.c,bot.movement?.order,
    travelPlan(),bot.monsters?.()??[],bot.teamNames??bot.farmers??[]);
  async function tolerate(key,expected,invoke,onTransient=()=>{}){try{const value=await invoke();if(actionReason(value)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}return value;}catch(e){if(actionReason(e)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}throw e;}}
  // Observe real outgoing basic attacks in addition to skill casts. Failed
  // or no-target results invalidate provisional damage immediately.
  function trackedAttack(id){
   let intent=null;
   return {
    invoke:()=>tolerate('attack','not_there',()=>{
     const live=bot.entity(id);
     const called=p.call('attack',live);
     const amount=provisionalImpactDamage(p.c,live);
     if(amount>0)intent=bot.impactIntents?.launched('attack',[id],{
      kind:'damage',damage:{[id]:amount}
     })??null;
     return called;
    },()=>{bot.target=null;}),
    settle:(state,result)=>{if(intent)bot.impactIntents?.settle(intent,
     result?.transient?'rejected':state);}
   };
  }
  function coordinatedTarget(base,mobs,range){
   if(!base||me.role!=='farmer'||!cfg.party.enabled||
      p.G.monsters?.[base.mtype]?.boss)return base;
   const currentTime=Date.now();
   const sources=[{name:me.name,session:bot.session,realm:p.realm(),
    received:currentTime,running:true,rip:!!p.c.rip,
    impactIntents:bot.impactIntents?.heartbeat()??[]},
    ...bot.farmers.filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n))
     .filter(Boolean)];
   const chosen=preferUnreservedEngagedTarget({
    selected:base,candidates:mobs,character:p.c,roster:bot.farmers,
    realm:p.realm(),now:currentTime,sources,maxRange:range
   });
   if(chosen.changed){
    const key=chosen.from+':'+chosen.to;
    if(key!==lastRedirect.key||currentTime-lastRedirect.at>1000){
     lastRedirect={key,at:currentTime};
     bot.event?.('combat.overkillRedirect',{
      from:chosen.from,to:chosen.to,conservativePending:chosen.reserved,
      currentHp:base.hp,mode:'engaged-only',source:'bounded-intents'
     });
    }
   }
   return chosen.target??base;
  }
  function recover(){
    const c=p.c,now=Date.now();
    if(c.rip){
      const fallenTarget=bot.target?.mtype;bot.target=null;bot.movement.stop();if(!deadSince){deadSince=now;bot.strategy?.failActivity?.('Tod während des Kampf-/Reiseziels',fallenTarget);deaths=deaths.filter(t=>now-t<cfg.farming.deathWindowMs);deaths.push(now);}
      bot.reason='Tot';if(deaths.length>=cfg.farming.maxDeaths){bot.pause('Todesgrenze erreicht');return true;}
      if(cfg.farming.respawn&&now-deadSince>=cfg.farming.respawnDelayMs)exec.run('respawn',['lifecycle'],()=>p.c.rip,()=>p.call('respawn'),{delay:15000});return true;
    }
    deadSince=0;
    const preparing=me.role==='farmer'&&!bot.monsters().some(m=>m.target===c.name)&&bot.encounter?.status().phase==='RECOVER';
    // Once recovery begins, heal all the way to resumeAbove. Checking only
    // hpBelow leaves a character stranded between the two thresholds.
    const hpTrigger=recoveryHpThreshold(rest,cfg.farming.hpBelow,
      cfg.farming.resumeAbove,preparing,cfg.farming.pullHp);
    const resource=c.hp/c.max_hp<hpTrigger?'hp':
      c.mp/c.max_mp<(preparing?(cfg.farming.pullMp??cfg.farming.mpBelow):cfg.farming.mpBelow)?'mp':null;
    const potionWanted=cfg.farming.potions?potionResource(c):null;
    if((resource||potionWanted)&&!p.call('is_on_cooldown','use_hp')){
      let slot=-1;
      if(potionWanted&&!bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics.reserved)
        slot=c.items.map((i,slot)=>({i,slot,restore:p.G.items[i?.name]?.gives?.find(g=>g[0]===potionWanted)?.[1]??0}))
          .filter(r=>r.i&&!protectedItem(r.i)&&p.G.items[r.i.name]?.type==='pot'&&
            r.restore>0&&bot.consumable(r.i))
          .sort((a,b)=>Math.abs(a.restore-(c['max_'+potionWanted]-c[potionWanted]))-
            Math.abs(b.restore-(c['max_'+potionWanted]-c[potionWanted])))[0]?.slot??-1;
      if(slot>=0){
        const item=c.items[slot],fp=fingerprint(item),before=bot.count(item.name);
        exec.run('potion',['potion','inventory'],()=>!bot.inventoryBlocked&&!bot.logistics.reserved&&
          potionResource(c)===potionWanted&&
          fingerprint(c.items[slot])===fp&&bot.consumable(c.items[slot])&&
          !p.call('is_on_cooldown','use_hp'),()=>{
          bot.event('inventory.intent',{kind:'consume',item:item.name,before,journaled:false});
          return p.call('equip',slot);
        },{delay:2000,value:true,observe:()=>bot.count(item.name)<before,
         onSettle:state=>{if(state==='confirmed'&&bot.count(item.name)<before)
            bot.event('potion.consumeConfirmed',{item:item.name,before,after:bot.count(item.name)});
           bot.event('inventory.result',{kind:'consume',result:state,journaled:false,valueActionsBlocked:false});}});
      }else if(resource){
        exec.run('regen',['potion'],()=>!p.call('is_on_cooldown','use_hp'),
          ()=>p.call('use_skill','regen_'+resource),{delay:4000});
      }
    }
    if(c.hp/c.max_hp<cfg.farming.restBelow)rest=true;
    if(rest&&c.hp/c.max_hp>=cfg.farming.resumeAbove)rest=false;
    // A Ranger already following a valid farm route can drink while moving.
    // Stopping that route at 40% HP to orbit a roadside bigbird repeatedly
    // separated both Rangers from the healer in captured live traces.
    if(rest&&me.role==='farmer'&&roadTravel().continueRoute){
      bot.reason='Erholung unterwegs: Route beibehalten, Trank/Heiler aktiv';
      bot.skills?.rotation?.(null);return true;
    }
    if(rest){bot.reason='Erholung';bot.target=null;const threats=bot.monsters().filter(e=>e?.target===c.name&&e.hp>0&&!e.dead).sort((a,b)=>distance(c,a)-distance(c,b));if(threats[0])retreat(threats[0]);else bot.movement.stop();bot.skills.rotation(null);return true;}
    return false;
  }
  function retreat(t){if(!isNaturallyAggressive(p.G,t)&&t?.target!==p.c.name)return false;if(bot.navigation?.orbit(t))return true;const c=p.c,from=xy(c);
    // If the aggressive enemy has driven the patient out of the Priest's
    // reach, try a physically safe convergence step before fleeing farther.
    const healer=(bot.farmers??[]).filter(n=>n!==c.name)
      .map(n=>bot.transport?.fresh?.(n))
      .find(h=>h?.class==='priest'&&h.running&&!h.rip&&
        samePlace(c,h)&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&
        Number.isFinite(h.stats?.range)&&h.stats.range>50);
    const healRange=healer?Math.max(55,healer.stats.range-20):0;
    if(healer&&c.hp/c.max_hp<.85&&distance(c,healer)>healRange&&
       distance(c,healer)<550){
      const dx=healer.x-from.x,dy=healer.y-from.y,len=Math.hypot(dx,dy);
      const step=Math.max(25,Math.min(85,(c.speed??40)*1.4));
      const x=from.x+dx/len*step,y=from.y+dy/len*step;
      if(p.call('can_move_to',x,y)&&
         bot.monsters().every(m=>m.target!==c.name||
           distance({x,y},m)>=distance(c,m)-8)){
        if(bot.movement.order?.owner!=='kite')bot.movement.stop();
        bot.movement.local(x,y,'kite');
        bot.event?.('combat.healerTether',{healer:healer.name,
          gap:Math.round(len),range:healRange,step:Math.round(step)});
        return true;
      }
    }
    const threats=bot.monsters().filter(m=>isOwnAggressiveThreat(p.G,m,c.name));if(!threats.length)threats.push(t);let ax=0,ay=0;for(const enemy of threats.slice(0,8)){const d=distance(c,enemy)||1,v=xy(enemy),weight=1/Math.max(20,d);ax+=(from.x-v.x)/d*weight;ay+=(from.y-v.y)/d*weight;}const len=Math.hypot(ax,ay)||1,dx=ax/len,dy=ay/len,step=Math.max(35,Math.min(90,(c.speed??40)*1.5));for(const [x,y] of [[dx,dy],[-dy,dx],[dy,-dx]]){const nx=from.x+x*step,ny=from.y+y*step;if(p.call('can_move_to',nx,ny)){if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(nx,ny,'kite');return;}}bot.reason='Kein freier Rückzugsweg';}
  function helpEngagedTeamFight(leader){
  // Soft follow distance must not suppress safe, reachable assistance to an
  // EXISTING team fight. This path never pulls an unattached monster.
  if(!leader?.running||leader.rip||!samePlace(p.c,leader))return false;
  const range=Math.max(5,(p.c.range??0)-Math.min(cfg.farming.rangeBuffer??0,(p.c.range??0)*.25));
  const enemy=bot.monsters().filter(m=>m?.hp>0&&!m.dead&&m.target&&
    bot.teamNames.includes(m.target)&&bot.allowed(m)&&
    (bot.strategy?.safeTarget?.(m.mtype,m)!==false||bot.combatAssessment?.canDefend(m)===true)&&
    samePlace(p.c,m)&&
    distance(p.c,m)<=Math.max(range,cfg.party.followDistance*2)&&
    distance(leader,m)<=cfg.party.followDistance*2).sort((a,b)=>
    Number(b.id===leader.target)-Number(a.id===leader.target)||
    distance(p.c,a)-distance(p.c,b))[0];
  if(!enemy)return false;
  bot.target=enemy;bot.reason='Sichere Gruppenhilfe: '+enemy.mtype;
  if(distance(p.c,enemy)>range){
   // Keep the admitted combat route until it finishes; repeated replanning
   // every farmer tick would otherwise abort every smart_move immediately.
   if(bot.movement.order?.owner==='combat')return true;
   if(['follow','farm'].includes(bot.movement.order?.owner))
    bot.movement.stop();
   bot.reason='Gruppenkampf unterstützen: '+enemy.mtype;
   bot.movement.go(combatApproach(p.c,enemy,range,(x,y)=>p.call('can_move_to',x,y)),'combat');
   bot.skills.rotation(null);
   return true;
  }
  bot.navigation?.rangePosition?.(enemy);
  bot.skills.rotation(enemy);
  if(p.c.target!==enemy.id)exec.run('target',['target'],()=>bot.allowed(enemy)&&
    !!bot.entity(enemy.id)?.target,()=>p.call('change_target',enemy),{delay:500});
  const attack=trackedAttack(enemy.id);
  exec.run('attack',['attack','mana'],()=>{
    const live=bot.entity(enemy.id);
    return live&&live.target&&bot.teamNames.includes(live.target)&&
      bot.allowed(live)&&(bot.strategy?.safeTarget?.(live.mtype,live)!==false||bot.combatAssessment?.canDefend(live)===true)&&
      distance(p.c,live)<=range&&p.call('can_attack',live)&&
      !p.call('is_on_cooldown','attack');
  },attack.invoke,{delay:100,onSettle:attack.settle});
  return true;
}
function recoverCohesion(now){
  if(me.name!==bot.leader)return false;
  const away=(bot.farmers??[]).filter(n=>n!==me.name).map(n=>{
    const h=bot.transport.fresh(n);
    return h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,h)?
      {name:n,h,distance:distance(p.c,h)}:null;
  }).filter(r=>r&&r.distance>cfg.party.followDistance*2)
    .sort((a,b)=>b.distance-a.distance||a.name.localeCompare(b.name));
  if(!away.length){cohesion.key='';return false;}
  const target=away[0],key=target.name+':'+target.h.map+':'+(target.h.in??target.h.map);
  if(cohesion.key!==key){cohesion={key,progress:now,gap:target.distance,attempt:cohesion.attempt};return false;}
  if(target.distance<cohesion.gap-20){cohesion.progress=now;cohesion.gap=target.distance;}
  if(bot.movement.order?.owner==='cohesion'){bot.reason='Gruppe sammeln: '+target.name;return true;}
  if(now-cohesion.progress<45000||now-cohesion.attempt<120000)return false;
  if(bot.monsters().some(m=>m.target&&bot.teamNames.includes(m.target))||
     bot.strategy?.canVisit?.(target.h)===false)return false;
  const from=xy(p.c),to=xy(target.h),mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2};
  if(!Number.isFinite(mid.x)||!Number.isFinite(mid.y)||
     !p.call('can_move_to',mid.x,mid.y))return false;
  cohesion.attempt=now;bot.target=null;bot.reason='Gruppenblockade lösen: '+target.name;
  bot.movement.go({map:p.c.map,in:p.c.in??p.c.map,...mid,radius:Math.max(30,cfg.party.followDistance/2)},'cohesion');
  bot.event?.('party.cohesion-recovery',{peer:target.name,gap:Math.round(target.distance),reason:'45 Sekunden ohne Annäherung'});
  return true;
}
function waitSafely(reason){bot.reason=reason;bot.target=null;const threat=bot.monsters().find(m=>isOwnAggressiveThreat(p.G,m,p.c.name));if(threat){bot.recovering=true;
  // Ordinary incoming aggro while assembling is not proof that the entire
  // shared spawn is unsafe. Quarantine only the actually rejected monster.
  if(bot.strategy?.safeTarget?.(threat.mtype,threat)===false)
   bot.strategy?.failActivity?.('Gefährliche Aggro beim Sammeln',threat.mtype);
  retreat(threat);
 }else if(['combat','farm','follow','kite','world'].includes(bot.movement.order?.owner))bot.movement.stop();bot.skills.rotation(null);}
  function rescueTeam(emergency){
    if(p.c.ctype!=='priest'||!cfg.party.enabled||!cfg.party.healing||
       !emergency?.critical?.length)return false;
    const endangered=emergency.critical.filter(h=>h.name!==p.c.name)
     .sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp)[0];
    if(!endangered||!samePlace(p.c,endangered))return false;
    const range=p.G.skills?.heal?.range??p.c.range;
    if(!Number.isFinite(range)||range<50)return true;
    const visible=bot.entity(endangered.name),d=distance(p.c,endangered);
    if(visible&&distance(p.c,visible)<=range-10){
      bot.reason='Notfallheilung: '+endangered.name;
      bot.target=null;bot.skills.rescue?.(visible);
      return true;
    }
    if(d>600||!Number.isFinite(d))return false;
    const point=combatApproach(p.c,endangered,Math.max(40,range-25),
      (x,y)=>p.call('can_move_to',x,y)&&
       bot.monsters().every(m=>m.target!==endangered.name||
        distance({x,y},m)>=Math.max(70,(m.range??20)+25)));
    const current=bot.movement.order;
    if(current&&current.owner!=='kite'&&
      (current.owner!=='combat'||!current.dest||distance(current.dest,point)>40))
      bot.movement.stop();
    if(!bot.movement.order)bot.movement.go(point,'combat');
    bot.reason='Heiler nähert sich '+endangered.name;
    bot.target=null;
    return true;
  }
  function tick(){
    bot.recovering=false;
    if(bot.logistics.handoffActive){bot.reason='Itemübergabe bestätigen';bot.movement.stop();return;}
    if(bot.gold?.reserved||bot.journal?.kind?.startsWith("gold.")){bot.reason="Goldübergabe bestätigen";bot.movement.stop();return;}
    if(recover()){bot.recovering=true;return;}
    const c=p.c,now=Date.now();
    // While a Ranger follows an approved native farm route, hostile road
    // aggro must not turn the trip into random spiral/orbit manoeuvres.
    // Keep potion consumption and Priest healing active. This policy does
    // not apply after arrival, to the Merchant, or to unrelated travel.
    const road=me.role==='farmer'?roadTravel():null;
    if(road?.continueRoute&&(c.ctype!=='priest'||
       bot.monsters().some(m=>m?.target===c.name))){
      bot.target=null;
      bot.reason='Gruppenreise trotz Weg-Aggro: Route halten, Tränke und Heiler';
      if(now-lastRoadAggroAt>=10000){lastRoadAggroAt=now;
       bot.event?.('combat.roadAggroRouteHeld',{hostiles:road.hostileCount,
        destination:travelPlan()?.key??null,owner:bot.movement.order?.owner,
        hpRatio:c.hp/Math.max(1,c.max_hp)});}
      bot.skills?.rotation?.(null);return;
    }
    // Navigation is not coupled to farm-plan selection or the monster's
    // natural-aggro flag. A passive monster becomes a REAL self-threat once
    // it attacks this farmer; kite before follow/travel/team-defense returns.
    // The navigation layer checks range, actual speed advantage, terrain,
    // movement ownership and preserves attacks/skills in this same tick.
    if(me.role==='farmer'&&cfg.farming.kiting){
      const selfAggro=bot.monsters().filter(m=>m?.target===c.name&&
        m.hp>0&&!m.dead&&samePlace(c,m)).sort((a,b)=>distance(c,a)-distance(c,b));
      if(selfAggro.length)bot.navigation?.rangePosition?.(selfAggro[0]);
    }
    const emergency=bot.combatAssessment?.emergency?.();
    if(emergency?.active&&rescueTeam(emergency))return;
    const threat=bot.monsters().filter(m=>isOwnAggressiveThreat(p.G,m,c.name)).sort((a,b)=>distance(c,a)-distance(c,b))[0];
    const rescueRoster=(bot.farmers??[]).map(name=>name===c.name?c:
      bot.transport?.fresh?.(name)).filter(Boolean);
    const rescueFocus=chooseEmergencyFocus(emergency?.monsters??[],rescueRoster);
    const danger=rescueFocus??threat;
    if(rescueFocus&&rescueFocus.id!==threat?.id){
      const key=rescueFocus.id+':'+rescueFocus.target;
      if(lastEmergencyFocus.key!==key||now-lastEmergencyFocus.at>=12000){
       lastEmergencyFocus={key,at:now};
       bot.event?.('combat.emergencyFocus',{selected:rescueFocus.id,
        victim:rescueFocus.target,ownThreat:threat?.id??null,
        source:'fresh-lowest-hp-teammate'});
      }
    }
    if(danger){
      const assessment=bot.combatAssessment?.assess(danger);
      if(assessment?.viable&&bot.allowed(danger)){
        bot.target=danger;bot.reason='Teamverteidigung: '+danger.mtype;
        bot.skills.rotation(danger);
        // The aggro owner must continue avoiding hits even while the
        // threat-capability model permits a defensive kill.
        if(danger.target===c.name)bot.navigation?.rangePosition?.(danger);
        const range=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer,c.range*.25));
        if(distance(c,danger)>range){
          if(!bot.movement.order)bot.movement.go(
           combatApproach(c,danger,range,(x,y)=>p.call('can_move_to',x,y)),'combat');
        }else{
          if(p.c.target!==danger.id)exec.run('target',['target'],()=>bot.allowed(danger),
            ()=>p.call('change_target',danger),{delay:500});
          const attack=trackedAttack(danger.id);
          exec.run('attack',['attack','mana'],()=>{
            const live=bot.entity(danger.id);
            return live&&bot.combatAssessment?.canDefend(live)===true&&
              bot.allowed(live)&&distance(p.c,live)<=range&&
              p.call('can_attack',live)&&!p.call('is_on_cooldown','attack');
          },attack.invoke,{delay:100,onSettle:attack.settle});
        }
        return;
      }
      bot.target=null;bot.reason='Gefährliche Aggro: '+(assessment?.reason??'unverified');
      bot.recovering=true;bot.strategy?.interruptQuest?.();
      if(threat)retreat(threat);
      else if(['farm','combat','follow','kite'].includes(bot.movement.order?.owner))
        bot.movement.stop();
      bot.skills.rotation(null);
      return;
    }
    if(emergency?.active){
      bot.target=null;bot.reason='Gruppe retten: keine neuen Farm-Pulls';
      if(['farm','combat'].includes(bot.movement.order?.owner))bot.movement.stop();
      bot.skills.rotation(null);
      return;
    }
    // A dangerous-looking roaming monster is not evidence of incoming
    // combat. Do not flee or quarantine the farm plan merely because its
    // definition has high damage or it wandered inside an arbitrary radius.
    // A retreat is only warranted after an autonomously aggressive species
    // actually targets THIS character (see isOwnAggressiveThreat above).
    // The existing safety branch below still handles that confirmed threat.
    if(threat&&(me.role==='merchant'||bot.strategy?.safeTarget?.(threat.mtype,threat)===false)){bot.recovering=true;bot.strategy?.interruptQuest?.();bot.strategy?.failActivity?.('Gefährlicher Gegner greift an',threat.mtype);bot.target=null;bot.reason='Rückzug: '+threat.mtype;retreat(threat);bot.skills.rotation(null);return;}
    if(me.role==='merchant'){if(bot.inventoryBlocked)bot.reason=bot.journal?.kind==='exchange'?'Exchange-Buchung wird anhand von Inventar und Gold geprüft':'Offene Werttransaktion wird geprüft';return;}
    if(bot.account&&!bot.account.active()){bot.reason='Bereitschaft: andere Farmer gewählt';bot.target=null;return;}
    if(bot.strategy?.busy&&bot.monsters().some(m=>m.target===c.name))bot.strategy.interruptQuest?.();
    if(bot.strategy?.busy||bot.movement.order?.owner==='economy'){bot.skills.rotation(null);return;}
    if(cfg.farming.loot&&!bot.inventoryBlocked&&!bot.logistics.reserved&&bot.free()>cfg.farming.freeSlots&&now-lastLoot>=cfg.farming.lootEveryMs){lastLoot=now;exec.run('loot',['inventory'],()=>bot.free()>cfg.farming.freeSlots,()=>tolerate('loot','openning',()=>p.call('loot')),{delay:cfg.farming.lootEveryMs});}
    if(!cfg.farming.enabled){bot.reason='Farmen ausgeschaltet';bot.skills.rotation(null);return;}
    if((p.parent.is_pvp||p.G.maps[c.map]?.pvp)&&!cfg.farming.pvp){bot.pause('PvP-Karte nicht freigegeben');return;}
    // Loot requires strictly MORE than the configured free-slot reserve.
    // Continuing to pull exactly at the reserve would produce uncollectable
    // drops indefinitely. A fresh Merchant pressure signal also pauses
    // optional pulls while its own hysteretic capacity controller recovers.
    // A traveling Priest does not merely chase the leader: actively heal any
    // injured squad member before following the next march waypoint.
    if(c.ctype==='priest'&&cfg.party.enabled&&cfg.party.healing){
     const route=bot.teamPlan?.heartbeat?.(),lead=bot.transport?.fresh?.(bot.leader);
     const travelling=route&&(!samePlace(c,route)||distance(c,route)>85)||
      ['follow','farm','cohesion'].includes(bot.movement.order?.owner)||
      lead?.farmPlan&&(!samePlace(c,lead.farmPlan)||distance(c,lead.farmPlan)>85);
     if(travelling){
      const peers=(bot.farmers??[]).filter(n=>n!==c.name)
       .map(n=>bot.transport?.fresh?.(n));
      const patient=selectMarchHealingPatient(c,peers,{realm:p.realm(),now});
      if(patient){
       const range=p.G.skills?.heal?.range??c.range,visible=bot.entity?.(patient.name);
       if(visible&&samePlace(c,visible)&&distance(c,visible)<=range-10){
        if(bot.skills.rescue?.(visible)){
         bot.reason='Gruppenmarsch: Notfallheilung '+patient.name;
         bot.event?.('party.marchHeal',{patient:patient.name,
          hpRatio:patient.hp/patient.max_hp,distance:Math.round(distance(c,patient))});
         return;
        }
       }else if(Number.isFinite(range)&&range>50&&distance(c,patient)<650){
        const key=patient.name;
        if(bot.movement.order?.owner!=='combat'){
         if(['follow','farm','cohesion'].includes(bot.movement.order?.owner))bot.movement.stop();
         bot.movement.go({...patient,radius:Math.max(45,range-25)},'combat');
        }
        if(lastMarchHeal.key!==key||now-lastMarchHeal.at>12000){
         lastMarchHeal={key,at:now};
         bot.event?.('party.marchHealApproach',{patient:patient.name,
          distance:Math.round(distance(c,patient)),hpRatio:patient.hp/patient.max_hp});
        }
        bot.reason='Gruppenmarsch: Heiler nähert sich '+patient.name;
        bot.skills.rotation(null);return;
       }
      }
     }
    }
    const merchantHeartbeat=bot.transport?.fresh?.(cfg.party?.merchant);
    const storageHold=farmingStoragePressure({
      free:bot.free(),reserve:cfg.farming.freeSlots,
      merchant:merchantHeartbeat,realm:p.realm()
    });
    const engaged=bot.monsters().some(m=>defensiveFarmTarget(m,bot.teamNames));
    const sharedDest=bot.teamPlan?.heartbeat?.();
    const leaderEnRoute=cfg.party.enabled&&me.name===bot.leader&&
      sharedDest&&(!samePlace(c,sharedDest)||distance(c,sharedDest)>85);
    if(storageHold&&!engaged&&!leaderEnRoute){
      // Storage backpressure forbids new pulls, NOT the noncombat escort.
      // Previously this returned before the follower could even follow the
      // Leader; both Rangers and Priest stopped at the same unvisited map.
      const escort=cfg.party.enabled&&me.name!==bot.leader?
        bot.transport?.fresh?.(bot.leader):null;
      const march=escort?.running&&!escort.rip&&escort.realm===p.realm()&&
        escort.farmPlan&&(!samePlace(escort,escort.farmPlan)||
         distance(escort,escort.farmPlan)>85);
      if(march&&(!samePlace(c,escort)||distance(c,escort)>50)){
       if(['combat','kite'].includes(bot.movement.order?.owner))bot.movement.stop();
       bot.target=null;
       bot.reason='Gruppenmarsch trotz Lagerdruck: Folge '+bot.leader;
       if(!bot.movement.order)bot.movement.go({...escort,radius:35},'follow');
       bot.skills.rotation(null);return;
      }
      bot.reason=storageHold==='MERCHANT_CAPACITY'?
        'Lagerdruck beim Merchant: freiwillige Farm-Pulls pausiert':
        'Inventarreserve erreicht: neue Farm-Pulls pausiert';
      bot.target=null;
      if(['combat','farm','kite'].includes(bot.movement.order?.owner))bot.movement.stop();
      bot.skills.rotation(null);
      return;
    }
    // Equip a carried compatible weapon before resuming the farm plan.
    // gear.equip keeps game-class, equipment and value-journal guards.
    if(!c.slots?.mainhand&&cfg.production?.gear&&bot.gear?.equip&&!bot.journal&&!bot.inventoryBlocked){
      const hands=p.G.classes?.[c.ctype],candidate=c.items
        .map((item,slot)=>({item,slot,meta:p.G.items?.[item?.name]}))
        .filter(({item,meta})=>item&&meta&&
          (meta.type==='weapon'||meta.type==='tool')&&
          (Object.hasOwn(hands?.mainhand??{},meta.wtype??meta.type)||
           Object.hasOwn(hands?.doublehand??{},meta.wtype??meta.type)))
        .sort((a,b)=>(b.item.level??0)-(a.item.level??0))[0];
      if(candidate){
       const rule={enabled:true,name:'Kampfbereitschaft: Waffe anlegen',
        item:candidate.item.name,action:'equip',slot:'mainhand',
        keep:0,teamReserve:0,maxActions:0,goldBudget:0,lossBudget:0};
       if(bot.gear.equip(candidate.slot,rule)){
        bot.reason='Kampfwaffe anlegen: '+candidate.item.name;return;
       }
      }
    }
    // Help an existing teammate fight BEFORE the ordinary shared farm march.
    // Otherwise the follower can walk away along the new endpoint while an
    // ally is still engaged. This never authorizes a new neutral pull.
    const escortLeader=bot.transport.fresh(bot.leader);
    if(cfg.party.enabled&&me.name!==bot.leader&&escortLeader?.running&&
       helpEngagedTeamFight(escortLeader))return;
    if(bot.strategy?.travel()){bot.skills.rotation(null);return;}
    const leader=escortLeader;
    if(cfg.party.enabled&&bot.leader!==me.name){
      if(!leader?.running||leader.realm!==p.realm()||leader.rip){waitSafely('Warte auf Kampf-Leader');return;}
      // All selected Farmers use the Leader's ACTUAL farm endpoint,
      // not its moving heartbeat snapshots. Native pathfinding can keep
      // going without a stop at every intermediate 50-70 unit radius.
      const destination=sharedFarmMarchDestination(c,leader,p.realm());
      if(destination){
       const marchPlan=leader.farmPlan??{
        id:leader.march?.plan,target:leader.march?.target??'Farmspawn',
        key:leader.march?.plan
       },order=bot.movement.order;
       const oldFollow=order?.owner==='follow'&&(
        !samePlace(order.dest,destination)||
        distance(order.dest,destination)>100);
       if(oldFollow)bot.movement.stop();
       if(!bot.movement.order&&bot.movement.go(destination,'follow')&&
          bot.movement.order?.owner==='follow'){
        bot.event?.('party.sharedMarchRoute',{plan:marchPlan.id,
         destination:marchPlan.key,reason:'continuous-shared-farm-destination'});
       }
       bot.target=null;
       bot.reason='Gruppenmarsch: durchgehend zu '+marchPlan.target;
       bot.skills.rotation(null);return;
      }
      if(!samePlace(c,leader)||distance(c,leader)>followerReassemblyDistance(cfg)){
       if(helpEngagedTeamFight(leader))return;
       bot.target=null;bot.reason='Folge '+bot.leader;
       if(['combat','farm','kite'].includes(bot.movement.order?.owner))bot.movement.stop();
       bot.movement.go({...leader,radius:Math.min(cfg.party.followDistance/2,
        Math.max(20,followerReassemblyDistance(cfg)/2))},'follow');
       bot.skills.rotation(null);return;
      }
      if(leader.questVisit===true||leader.squadQuestVisit===true){waitSafely('Monsterhunt-NPC-Besuch: bei der Gruppe bleiben');return;}
    }
    if(cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||!samePlace(c,bot.transport.fresh(n))||bot.transport.fresh(n)?.realm!==p.realm()||distance(c,bot.transport.fresh(n))>cfg.party.followDistance*2))){if(leader?.running&&helpEngagedTeamFight(leader))return;if(recoverCohesion(now)){bot.skills.rotation(null);return;}waitSafely('Warte auf Gruppe');return;}if(bot.movement.order?.owner==='cohesion')bot.movement.stop();
    // The leader's first neutral pull is admitted only after all selected
    // farmers have actually assembled at this spawn. Engaged-team defense
    // stays available even if a member has fallen behind.
    if(me.name===bot.leader&&!bot.monsters().some(m=>m.target&&bot.teamNames.includes(m.target))){
     const ready=neutralPullReadiness(bot);
     if(!ready.ready){waitSafely('Gruppe sammeln: '+(ready.peer??ready.reason));return;}
    }
    if(me.name!==bot.leader&&leader?.running&&helpEngagedTeamFight(leader))return;
    const planned=bot.teamPlan?.target(),visible=planned?bot.monsters().filter(m=>m.mtype===planned):[];if(me.name===bot.leader&&visible.length&&visible.every(m=>bot.strategy?.safeTarget(planned,m,true)===false)){
     // Species baseline HP is already applied by strategy.risk(). Rejection
     // here therefore represents REAL danger, e.g. high current attack,
     // rather than the old monster's accumulated hit points alone.
     bot.strategy.failActivity('Sichtbare Gegner stärker als Farmplan; neues sicheres Ziel wählen',planned);bot.reason='Farmziel neu bewerten: sichtbare Gegner zu stark';return;}if(!storageHold&&bot.encounter?.pull()){bot.reason='Kontrollierter Team-Mehrfachpull';return;}
    const mobs=bot.monsters().filter(m=>bot.allowed(m)&&
      (!storageHold||defensiveFarmTarget(m,bot.teamNames)));
    const focus=cfg.party.enabled&&cfg.party.focusFire&&leader?.target&&(!bot.teamPlan||leader.farmPlan?.id===bot.teamPlan.heartbeat()?.id||leader.activity)?mobs.find(e=>e.id===leader.target):null;
    const previous=bot.target&&mobs.find(e=>e.id===bot.target.id);
    const proposed=focus??previous??mobs.sort((a,b)=>(a.target===c.name?-10000:0)+distance(c,a)-((b.target===c.name?-10000:0)+distance(c,b)))[0]??null;
    // Never redirect to a neutral spawn. This changes only an already
    // admissible engaged target, preserving 3shot's exact-three requirement.
    const coordinatedRange=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer??0,c.range*.25));
    bot.target=coordinatedTarget(proposed,mobs,coordinatedRange);
    const target=bot.target;
    bot.skills.rotation(target);
    if(!target){
      if(!storageHold&&cfg.party.enabled&&me.name!==bot.leader&&
         leader?.running&&samePlace(c,leader)){
        const current=bot.movement.order,queued=current?.owner==='follow';
        const rally=followerCombatRendezvous(c,leader,{
         followDistance:cfg.party.followDistance,
         hasEligibleTarget:false,storageHeld:!!storageHold,
         hasActiveMovement:!!current
        });
        if(queued){bot.reason='Teamziel in Sichtweite bringen: '+bot.leader;return;}
        if(rally.move&&now-lastTravel>=4000){
         // Do not cancel kite, combat, quest, logistics or team regrouping.
         // This is a short leader rendezvous only, never a new monster pull.
         lastTravel=now;
         if(bot.movement.go({...leader,radius:rally.radius},'follow')||
            bot.movement.order?.owner==='follow'){
           bot.reason='Teamziel in Sichtweite bringen: '+bot.leader;
           bot.event?.('farm.followTargetRecovery',{leader:bot.leader,
            gap:Math.round(rally.distance),radius:rally.radius,
            reason:'Follower hat kein freigegebenes Ziel trotz Leader-Kampf'});
           return;
         }
        }
        if(leader.target&&rally.reason==='already-near-leader'){
         bot.reason='Teamziel abwarten: '+bot.leader;return;
        }
      }
      bot.reason=storageHold?'Lagerdruck: keine neuen Farm-Pulls':'Suche Farmziel';
      if(!storageHold&&cfg.farming.autoTravel&&(!cfg.party.enabled||me.name===bot.leader)&&now-lastTravel>=10000&&!bot.movement.order){
       lastTravel=now;const d=bot.movement.farmLocation(bot.targets()[0]);
       if(d)bot.movement.go(d,'farm');else bot.reason='Kein öffentlicher Spawn für Farmziel';
      }
      return;
    }
    bot.reason='Kampf: '+target.mtype;
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    const range=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer,c.range*.25)),d=distance(c,target);
    // Ranged v3 spacing is proactive and nonexclusive: attack/skills still run
    // in this tick, and passive mobs are not treated as emergency threats.
    if(d<=range&&cfg.farming.kiting)bot.navigation?.rangePosition?.(target);
    if(d>range){bot.reason='Unterwegs zu '+target.mtype;if(!bot.movement.order){const reachable=p.call('can_move_to',xy(target).x,xy(target).y),detour=!reachable&&bot.navigation?.waypoint(target);if(!reachable&&bot.navigation&&!detour){bot.navigation.blocked(target);bot.target=null;return;}bot.movement.go(detour||combatApproach(c,target,range,(x,y)=>p.call('can_move_to',x,y)),'combat');}}
    if(c.target!==target.id)exec.run('target',['target'],()=>bot.allowed(target),()=>p.call('change_target',target),{delay:500});
    const attack=trackedAttack(target.id);
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},attack.invoke,{delay:100,onSettle:attack.settle});
  }
  return {tick,retreat,safety(){bot.recovering=false;if(recover()){bot.recovering=true;return true;}
    // The emergency scheduler executes BEFORE normal farmer.tick. Honor the
    // same verified road-route exception here or its preflight will trigger
    // an orbit/retreat before the main combat loop can preserve the route.
    if(me.role==='farmer'&&roadTravel().continueRoute)return false;
    const threat=bot.monsters().find(m=>isOwnAggressiveThreat(p.G,m,p.c.name));if(threat&&(me.role==='merchant'||bot.strategy?.safeTarget?.(threat.mtype,threat)===false)){bot.recovering=true;bot.strategy?.interruptQuest?.();bot.strategy?.failActivity?.('Gefährliche Aggro',threat.mtype);bot.target=null;retreat(threat);bot.skills.rotation(null);return true;}return false;}};
}
