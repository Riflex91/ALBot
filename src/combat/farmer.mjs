import {boundedInterceptPoint} from './intercept.mjs';
import {potionChannelPolicy,rankRecoveryPotion} from './recovery-policy.mjs';
import {distance,xy,samePlace,protectedItem,fingerprint} from '../core/policy.mjs';
import {isNaturallyAggressive,isOwnAggressiveThreat} from './aggression.mjs';
import {neutralPullReadiness,followerReassemblyDistance,followerCombatRendezvous,leaderAssignedFarmTarget} from './team-readiness.mjs';
import {assessQuestDetachment} from './quest-detachment.mjs';
import {farmingStoragePressure,defensiveFarmTarget} from './storage-backpressure.mjs';
import {preferUnreservedEngagedTarget,provisionalImpactDamage} from './impact-coordination.mjs';
import {roadAggroTravelDecision,committedFarmTransit,createTransitBlockObserver,verifiedTransitBlock} from './transit-defense.mjs';
import {mapGraph,mapHops} from '../world/knowledge.mjs';
import {inCaveInstance} from '../world/cave-team-coordination.mjs';
// A validated, already engaged team threat remains eligible for defensive
// focus fire after a safe farm-plan change. Unengaged off-plan spawns may
// never be pulled through this exception.
// Deterministic emergency focus prevents each Ranger from independently
// picking a different engaged attacker while a teammate is in danger.
// Incomplete patient data ranks LAST; it never becomes invented survivability.
// Non-lethal rally for a Ranger while a verified teammate is under
// attack. Keeps the destination outside the monster's observed attack
// radius; never authorizes a pull, attack or escape across the monster.
export function safeEmergencyRallyPoint(character,victim,monster,attackRange=0){
 if(!character||!victim||!monster||!samePlace(character,victim)||
    !samePlace(character,monster)||!samePlace(victim,monster)||
    ![character.x,character.y,victim.x,victim.y,monster.x,monster.y]
      .every(Number.isFinite))return null;
 const gap=distance(character,victim),safe=Math.max(155,
  Number.isFinite(attackRange)&&attackRange>=0?attackRange+90:155);
 if(gap<120||gap>850||distance(character,monster)<safe+25)return null;
 const dx=victim.x-monster.x,dy=victim.y-monster.y,
  length=Math.hypot(dx,dy);
 if(length<1)return null;
 const unitX=dx/length,unitY=dy/length,
  x=monster.x+unitX*Math.max(safe+20,length),
  y=monster.y+unitY*Math.max(safe+20,length);
 if(Math.hypot(character.x-x,character.y-y)<70)return null;
 // The straight-line corridor must stay outside the hostile radius.
 const vx=x-character.x,vy=y-character.y;
 const projection=Math.max(0,Math.min(1,
  ((monster.x-character.x)*vx+(monster.y-character.y)*vy)/
   Math.max(1,vx*vx+vy*vy)));
 if(Math.hypot(character.x+vx*projection-monster.x,
    character.y+vy*projection-monster.y)<safe+15)return null;
 return {map:character.map,in:character.in??character.map,x,y,radius:55};
}
// A bounded non-combat step toward a fresh team anchor.  Never use stale
// positions, cross instances, walk through an attacking monster or trade
// more than a tiny amount of hostile clearance for squad cohesion.
export function safeSquadConvergenceStep(character,anchor,monsters=[],canMove=()=>false,{
  now=Date.now(),realm=null,minimumGap=160
}={}){
 if(!character||!anchor||character.name===anchor.name||
    !anchor.running||anchor.rip||!samePlace(character,anchor)||
    realm!==null&&anchor.realm!==realm||
    !Number.isFinite(anchor.received)||anchor.received>now||
    now-anchor.received>4000||
    ![character.x,character.y,anchor.x,anchor.y].every(Number.isFinite))
   return null;
 const from=xy(character),to=xy(anchor),gap=distance(character,anchor);
 if(![from.x,from.y,to.x,to.y].every(Number.isFinite)||
    gap<=minimumGap)return null;
 const heading=Math.atan2(to.y-from.y,to.x-from.x);
 const active=(monsters??[]).filter(m=>m&&m.hp>0&&!m.dead&&
   samePlace(character,m)&&Number.isFinite(xy(m).x)&&Number.isFinite(xy(m).y));
 let best=null;
 for(const step of [80,55,35]){
  for(const offset of [0,-Math.PI/6,Math.PI/6,-Math.PI/3,Math.PI/3]){
   const x=from.x+Math.cos(heading+offset)*step;
   const y=from.y+Math.sin(heading+offset)*step;
   const nextGap=Math.hypot(to.x-x,to.y-y);
   if(nextGap>gap-12||!canMove(x,y))continue;
   const unsafe=active.some(m=>{
    const hostile=xy(m);
    const before=distance(character,m),after=Math.hypot(x-hostile.x,y-hostile.y);
    const clearance=Math.max(85,(Number.isFinite(m.range)?m.range:30)+50);
    // A current self-attacker must never be rewarded for driving us
    // deeper into its attack zone.
    if(m.target===character.name&&after<before-6)return true;
    if(after<Math.min(clearance,before-5))return true;
    // A direct movement segment cannot cut through a previously safe
    // hostile radius even if both endpoints are outside it.
    if(before>=clearance){
     const dx=x-character.x,dy=y-character.y;
     const fraction=Math.max(0,Math.min(1,
      ((hostile.x-from.x)*dx+(hostile.y-from.y)*dy)/
      Math.max(1,dx*dx+dy*dy)));
     if(Math.hypot(from.x+fraction*dx-hostile.x,
       from.y+fraction*dy-hostile.y)<clearance)return true;
    }
    return false;
   });
   if(unsafe)continue;
   if(!best||nextGap<best.gap)best={map:character.map,
    in:character.in??character.map,x,y,radius:8,gap:nextGap,
    anchor:anchor.name};
  }
 }
 return best;
}
export function chooseEmergencyFocus(monsters,members=[],definitions={}){
 const health=new Map((members??[]).filter(m=>m&&typeof m.name==='string'&&
  Number.isFinite(m.hp)&&Number.isFinite(m.max_hp)&&m.max_hp>0)
  .map(m=>[m.name,m.hp/m.max_hp]));
 return (monsters??[]).filter(m=>m?.id&&m.hp>0&&!m.dead&&
   health.has(m.target)).slice().sort((a,b)=>
   health.get(a.target)-health.get(b.target)||
   ((definitions?.[b.mtype]?.attack??b.attack??0)*
     (definitions?.[b.mtype]?.frequency??b.frequency??1)/Math.max(1,b.hp))-
   ((definitions?.[a.mtype]?.attack??a.attack??0)*
     (definitions?.[a.mtype]?.frequency??a.frequency??1)/Math.max(1,a.hp))||
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
// Narrow last-resort basic-fire permission during an ALREADY ENGAGED attack.
// This does not approve boss hunting, movement into a hazard, AoE, neutral
// pulls, stale entities or any attack when the defender is critically weak.
export function engagedEmergencyBasicDefense(character,monster,teamNames,{
 minimumHpRatio=.45,maximumDistance=300
}={}){
 if(!character||character.rip||!monster?.id||monster.type!=='monster'||
   !(monster.hp>0)||monster.dead||monster.invincible||
   !monster.target||!Array.isArray(teamNames)||!teamNames.includes(monster.target)||
   !samePlace(character,monster)||
   !Number.isFinite(character.hp)||!Number.isFinite(character.max_hp)||
   character.max_hp<=0||character.hp/character.max_hp<minimumHpRatio||
   !Number.isFinite(character.range)||character.range<=0||
   distance(character,monster)>Math.min(character.range,maximumDistance))return false;
 return true;
}
export function farmPlanOrTeamDefense(targets,monster,teamNames){
 return !!monster&&(targets??[]).includes(monster.mtype)||
  !!(monster?.target&&(teamNames??[]).includes(monster.target));
}
// A failed native can_attack despite nominal range usually means line-of-
// sight or a moving enemy. Try a tiny sideways correction, never a new pull.
// Pure, bounded and fail-closed: no stale geometry or unverified walk point.
export function safeFocusCorrectionPoint(character,target,monsters=[],canMove=()=>false,{
 step=34
}={}){
 if(!character||!target||!samePlace(character,target)||
   ![character.x,character.y,target.x,target.y].every(Number.isFinite)||
   !(character.hp>0)||!(character.max_hp>0)||
   character.hp/character.max_hp<.65||
   !Number.isFinite(step)||step<10||step>50)return null;
 const dx=target.x-character.x,dy=target.y-character.y,len=Math.hypot(dx,dy);
 if(len<10)return null;
 const vx=-dy/len,vy=dx/len;
 for(const sign of [1,-1]){
  const x=character.x+sign*vx*step,y=character.y+sign*vy*step;
  if(!canMove(x,y))continue;
  // Do not approach other active attackers or cross their melee zone.
  const exposed=(monsters??[]).some(m=>{
   if(!m||m.id===target.id||m.dead||!(m.hp>0)||
     !m.target||!samePlace(character,m)||
     !Number.isFinite(m.x)||!Number.isFinite(m.y))return false;
   const before=distance(character,m),after=Math.hypot(x-m.x,y-m.y);
   const clearance=Math.max(85,(Number.isFinite(m.range)?m.range:30)+35);
   return after<before-5||before>=clearance&&after<clearance;
  });
  if(!exposed)return {map:character.map,in:character.in??character.map,
    x,y,radius:7};
 }
 return null;
}
// Bounded Warrior movement toward a CURRENT team aggressor; not a pull.
export function warriorEmergencyInterceptPoint(character,monster,victim,
 range,canMove){
 if(character?.ctype!=='warrior'||!monster?.target||
    monster.target!==victim?.name||character.name===victim.name||
    !samePlace(character,monster)||!samePlace(victim,monster)||
    !(character.hp>0)||!(character.max_hp>0)||
    character.hp/character.max_hp<.7||
    !Number.isFinite(range)||range<=0||
    ![character.x,character.y,monster.x,monster.y,victim.x,victim.y]
     .every(Number.isFinite)||distance(character,monster)>400||
    distance(character,monster)<=range||typeof canMove!=='function')
   return null;
 const candidate=combatApproach(character,monster,Math.max(5,range-6),canMove);
 if(!candidate||!samePlace(candidate,character)||
    distance(character,candidate)>65||
    distance(candidate,monster)>=distance(character,monster)-4||
    canMove(candidate.x,candidate.y)!==true)return null;
 return candidate;
}
export function combatApproach(character,target,range,canMove){const a=xy(character),lead=boundedInterceptPoint(character,target,{range}),b=lead&&canMove(lead.x,lead.y)?lead:xy(target),d=Math.hypot(a.x-b.x,a.y-b.y),step=Math.min(60,Math.max(0,d-range+3)),x=a.x+(b.x-a.x)*step/(d||1),y=a.y+(b.y-a.y)*step/(d||1);
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
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastTravel=0,cohesion={key:'',progress:0,gap:Infinity,attempt:0},lastRedirect={key:'',at:0},lastEmergencyFocus={key:'',at:0},lastMarchHeal={key:'',at:0};
  const actionReason=x=>String(x?.reason??x?.message??x?.error??'');
  let lastRoadAggroAt=0,lastDefensiveShot={id:null,at:0},
   lastAssistBlock={id:null,at:0},lastAssistCorrection=0,
   lastAssistMissingAt=0;
  const observeTransitBlock=createTransitBlockObserver();
  let marchGraph=null,marchGraphG=null;
  const travelPlan=()=>bot.teamPlan?.heartbeat?.()??
    bot.transport?.fresh?.(bot.leader)?.farmPlan;
  const travelStatus=()=>observeTransitBlock(p.c,bot.movement?.order,
    travelPlan(),bot.monsters?.()??[]);
  const blockingMonster=()=>!travelPlan()?null:verifiedTransitBlock(p.c,travelPlan(),bot.monsters?.()??[],
   [{...p.c,running:bot.running,realm:p.realm(),received:Date.now(),travelBlock:travelStatus()},
    ...(bot.farmers??[]).filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n))]);
  const roadTravel=()=>roadAggroTravelDecision(p.c,bot.movement?.order,
    travelPlan(),bot.monsters?.()??[],bot.teamNames??bot.farmers??[],!!blockingMonster());
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
      const fallenTarget=bot.target?.mtype;
      const fatalTravelOwner=bot.movement?.order?.owner??null;
      const fatalDuringItinerary=bot.movement?.order?.mode==='hazard-itinerary';
      const dangerousPratMap=c.map==='level1'&&
        p.G?.monsters?.prat?.aggro>0&&
        p.G?.maps?.level1?.monsters?.some(m=>m.type==='prat');
      bot.target=null;bot.movement.stop();
      if(!deadSince){deadSince=now;bot.strategy?.failActivity?.('Tod während des Kampf-/Reiseziels',fallenTarget);deaths=deaths.filter(t=>now-t<cfg.farming.deathWindowMs);deaths.push(now);}
      // A fatal itinerary remains fatal even if an old farm plan has already
      // been discarded. Do not respawn straight into the same route loop.
      if(me.role==='farmer'&&(fatalDuringItinerary||dangerousPratMap)){
        if(deadSince===now)bot.event?.('combat.fatalTransitHalt',{
          map:c.map,owner:fatalTravelOwner,
          reason:fatalDuringItinerary?'death-during-verified-itinerary':
            'prat-map-fatality'});
        bot.pause?.('Tödlicher Transit: Farmer bis zur Routenprüfung angehalten');
        return true;
      }
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
    const potionChannel=()=>potionChannelPolicy(p.c,{threatened:bot.monsters().some(m=>m.target===c.name&&m.hp>0&&!m.dead)});
    if((resource||potionWanted)&&potionChannel().allowed&&!p.call('is_on_cooldown','use_hp')){
      let slot=-1;
      if(potionWanted&&!bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics.reserved)
        slot=c.items.map((i,slot)=>({i,slot,restore:p.G.items[i?.name]?.gives?.find(g=>g[0]===potionWanted)?.[1]??0}))
          .filter(r=>r.i&&!protectedItem(r.i)&&p.G.items[r.i.name]?.type==='pot'&&
            r.restore>0&&bot.consumable(r.i))
          .sort((a,b)=>rankRecoveryPotion(c,p.G.items[b.i.name].gives,potionWanted)-
            rankRecoveryPotion(c,p.G.items[a.i.name].gives,potionWanted))[0]?.slot??-1;
      if(slot>=0){
        const item=c.items[slot],fp=fingerprint(item),before=bot.count(item.name);
        exec.run('potion',['potion','inventory'],()=>!p.c.rip&&potionChannel().allowed&&!bot.inventoryBlocked&&!bot.logistics.reserved&&
          potionResource(p.c)===potionWanted&&
          fingerprint(p.c.items[slot])===fp&&bot.consumable(p.c.items[slot])&&
          !p.call('is_on_cooldown','use_hp'),()=>{
          for(const channel of potionChannel().interrupt){p.call('stop',channel);bot.event('potion.channelInterrupted',{channel,reason:'survival-before-channel'});}
          bot.event('inventory.intent',{kind:'consume',item:item.name,before,journaled:false});
          return p.call('equip',slot);
        },{delay:2000,value:true,observe:()=>bot.count(item.name)<before,
         onSettle:state=>{if(state==='confirmed'&&bot.count(item.name)<before)
            bot.event('potion.consumeConfirmed',{item:item.name,before,after:bot.count(item.name)});
           bot.event('inventory.result',{kind:'consume',result:state,journaled:false,valueActionsBlocked:false});}});
      }else if(resource){
        exec.run('regen',['potion'],()=>!p.c.rip&&p.c[resource]<p.c['max_'+resource]&&potionChannel().allowed&&!p.call('is_on_cooldown','use_hp'),
          ()=>p.call('use_skill','regen_'+resource),{delay:4000});
      }
    }
    if(c.hp/c.max_hp<cfg.farming.restBelow)rest=true;
    if(rest&&c.hp/c.max_hp>=cfg.farming.resumeAbove)rest=false;
    // Generated Cave floors have their OWN bound healer/defense executors.
    // Do not run overworld rest's retreat(), roadTravel() or
    // skills.rotation(null) here: all three can schedule ordinary farm
    // movement/skills before the Cave-only branch in tick() gets control.
    // Survival potions/regen above remain available, while a wounded Priest
    // can still reach the Cave-specific single-target healing executor.
    if(inCaveInstance(c)){
      if(rest){bot.target=null;bot.reason='Cave: Schonung und Teamheilung';}
      return false;
    }
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
  function emergencyConvergence(threat=null){
    if(!cfg.party.enabled||!cfg.party.waitForTeam||
       (bot.farmers??[]).length<2)return false;
    const c=p.c,now=Date.now(),peers=(bot.farmers??[])
      .filter(name=>name!==c.name).map(name=>bot.transport?.fresh?.(name))
      .filter(h=>h?.running&&!h.rip&&h.realm===p.realm()&&
        samePlace(c,h)&&Number.isFinite(h.received)&&
        h.received<=now&&now-h.received<=4000);
    // Rangers converge on the verified Priest.  The Priest converges on
    // the leader.  No independently selected monster/escape location.
    const priest=peers.find(h=>h.class==='priest');
    const leader=peers.find(h=>h.name===bot.leader);
    const anchor=priest??leader??peers.sort((a,b)=>
      a.name.localeCompare(b.name))[0];
    if(!anchor)return false;
    const existing=bot.movement.order;
    if(existing?.owner==='regroup'){
      if(distance(c,anchor)>Math.max(100,cfg.party.followDistance*.7)){
        bot.reason='Notfall-Sammeln bei '+anchor.name;return true;
      }
      bot.movement.stop();
    }
    if(!threat&&!bot.combatAssessment?.emergency?.().active)return false;
    const hostile=bot.monsters().filter(m=>m?.hp>0&&!m.dead&&
      (m.target&&bot.teamNames.includes(m.target)||
       isNaturallyAggressive(p.G,m)));
    const point=safeSquadConvergenceStep(c,anchor,hostile,
      (x,y)=>p.call('can_move_to',x,y),{
       now,realm:p.realm(),
       minimumGap:Math.max(120,Math.min(160,cfg.party.followDistance??160))
      })??bot.navigation?.hazardPoint?.(anchor);
    if(!point)return false;
    if(existing&&!['kite','follow','farm','combat','cohesion','world'].includes(
       existing.owner))return false;
    if(existing)bot.movement.stop();
    bot.movement.go(point,'regroup');
    if(bot.movement.order?.owner!=='regroup')return false;
    bot.target=null;bot.reason='Notfall-Sammeln bei '+anchor.name;
    bot.event?.('party.emergencyConvergence',{
      anchor:anchor.name,gap:Math.round(distance(c,anchor)),
      map:c.map,x:point.x,y:point.y,threat:threat?.id??null
    });
    return true;
  }
  function retreat(t){if(!isNaturallyAggressive(p.G,t)&&t?.target!==p.c.name)return false;const c=p.c,from=xy(c);
    if(emergencyConvergence(t))return true;
    // If the aggressive enemy has driven the patient out of the Priest's
    // reach, try a physically safe convergence step before fleeing farther.
    const healer=(bot.farmers??[]).filter(n=>n!==c.name)
      .map(n=>bot.transport?.fresh?.(n))
      .find(h=>h?.class==='priest'&&h.running&&!h.rip&&
        samePlace(c,h)&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&
        Number.isFinite(h.stats?.range)&&h.stats.range>50);
    const healRange=healer?Math.max(55,healer.stats.range-20):0;
    if(healer&&distance(c,healer)>healRange&&
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
    if(bot.navigation?.hazardEscape?.(healer??null))return true;
    if(bot.navigation?.orbit(t))return true;
    const threats=bot.monsters().filter(m=>isOwnAggressiveThreat(p.G,m,c.name));if(!threats.length)threats.push(t);let ax=0,ay=0;for(const enemy of threats.slice(0,8)){const d=distance(c,enemy)||1,v=xy(enemy),weight=1/Math.max(20,d);ax+=(from.x-v.x)/d*weight;ay+=(from.y-v.y)/d*weight;}const len=Math.hypot(ax,ay)||1,dx=ax/len,dy=ay/len,step=Math.max(35,Math.min(90,(c.speed??40)*1.5));for(const [x,y] of [[dx,dy],[-dy,dx],[dy,-dx]]){const nx=from.x+x*step,ny=from.y+y*step;if(p.call('can_move_to',nx,ny)){if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(nx,ny,'kite');return;}}bot.reason='Kein freier Rückzugsweg';}
  function helpEngagedTeamFight(leader){
  // Soft follow distance must not suppress safe, reachable assistance to an
  // EXISTING team fight. This path never pulls an unattached monster.
  if(!leader?.running||leader.rip||!samePlace(p.c,leader))return false;
  const range=Math.max(5,(p.c.range??0)-Math.min(cfg.farming.rangeBuffer??0,(p.c.range??0)*.25));
  const visible=bot.monsters();
  // A verified ongoing team fight may remain defensible after the ordinary
  // voluntary farm risk policy has changed. Never grant this to a neutral
  // pull or a monster attacking an outsider.
  const teamDefense=m=>!!m?.target&&bot.teamNames.includes(m.target)&&
    bot.combatAssessment?.canDefend(m)===true;
  const mayAssist=m=>bot.allowed(m)||teamDefense(m);
  const engaged=visible.filter(m=>m?.hp>0&&!m.dead&&m.target&&
    bot.teamNames.includes(m.target)&&mayAssist(m)&&
    (bot.strategy?.safeTarget?.(m.mtype,m)!==false||teamDefense(m))&&
    samePlace(p.c,m)&&
    distance(p.c,m)<=Math.max(range,cfg.party.followDistance*2)&&
    distance(leader,m)<=cfg.party.followDistance*2).sort((a,b)=>
    Number(b.id===leader.target)-Number(a.id===leader.target)||
    distance(p.c,a)-distance(p.c,b))[0];
  const plan=bot.teamPlan?.heartbeat?.()??
    (bot.teamPlan?.valid?.(leader.march?.anchor)?leader.march.anchor:null);
  const assigned=engaged?null:leaderAssignedFarmTarget(p.c,leader,visible,{
    plan,realm:p.realm(),teamNames:bot.teamNames,
    maxDistance:Math.max(range,cfg.party.followDistance*2)});
  const assignedSafe=assigned&&mayAssist(assigned)&&
    (bot.strategy?.safeTarget?.(assigned.mtype,assigned)!==false||
     bot.combatAssessment?.canDefend(assigned)===true);
  const shared=assignedSafe?assigned:null;
  const enemy=engaged??shared;
  if(!enemy){
    // Sample the exact blocked focus rather than inferring an empty monster
    // list from a null bot.target. This also catches lost local visibility.
    const now=Date.now();
    if(leader.target&&now-lastAssistMissingAt>=5000){
      lastAssistMissingAt=now;
      const focus=visible.find(m=>String(m?.id)===String(leader.target));
      bot.event?.('combat.assistUnavailable',{
        leader:bot.leader,focus:String(leader.target),
        reason:!focus?'leader-target-not-visible':
          !samePlace(p.c,focus)?'focus-not-local':
          focus.target&&!bot.teamNames.includes(focus.target)?'foreign-aggro':
          !plan?'plan-not-verified':
          !mayAssist(focus)?'target-not-admitted':
          'focus-safety-not-proven',
        plan:plan?.id??null,leaderPlan:leader.farmPlan?.id??
          leader.march?.plan??null,
        distance:focus?Math.round(distance(p.c,focus)):null,
        targetOwner:focus?.target??null,
        movement:bot.movement.order?.owner??null
      });
    }
    return false;
  }
  const neutralShared=enemy===shared&&!enemy.target;
  const stillAssigned=()=>{
    if(!neutralShared)return true;
    const current=leaderAssignedFarmTarget(p.c,bot.transport?.fresh?.(bot.leader),
      bot.monsters(),{plan:bot.teamPlan?.heartbeat?.()??
        (bot.teamPlan?.valid?.(leader.march?.anchor)?leader.march.anchor:null),
        realm:p.realm(),
      teamNames:bot.teamNames,maxDistance:Math.max(range,cfg.party.followDistance*2)});
    return current!=null&&String(current.id)===String(enemy.id);
  };
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
  const attackable=p.call('can_attack',enemy)===true;
  const cooldown=p.call('is_on_cooldown','attack')===true;
  const now=Date.now(),gap=distance(p.c,enemy);
  const block=reason=>{
    if(lastAssistBlock.id!==String(enemy.id)||
       now-lastAssistBlock.at>=4000){
      lastAssistBlock={id:String(enemy.id),at:now};
      bot.event?.('combat.assistBlocked',{leader:bot.leader,
       target:String(enemy.id),monster:enemy.mtype,plan:plan?.id??null,
       leaderPlan:leader.farmPlan?.id??leader.march?.plan??null,
       reason,gap:Math.round(gap),range:Math.round(range),
       canAttack:attackable,cooldown,order:bot.movement.order?.owner??null,
       focusType:neutralShared?'leader-assigned':'engaged-team'});
    }
  };
  if(!attackable){
    block('native-can-attack-false');
    if(!bot.journal&&!bot.inventoryBlocked&&!bot.recovering&&
       now-lastAssistCorrection>=3500&&
       (!bot.movement.order||['follow','farm','combat'].includes(
         bot.movement.order.owner))){
      const point=safeFocusCorrectionPoint(p.c,enemy,visible,
        (x,y)=>p.call('can_move_to',x,y)===true);
      if(point){
       if(['follow','farm'].includes(bot.movement.order?.owner))
        bot.movement.stop();
       if(bot.movement.local(point.x,point.y,'combat')){
        lastAssistCorrection=now;
        bot.event?.('combat.assistReposition',{target:String(enemy.id),
         leader:bot.leader,fromGap:Math.round(gap),
         x:point.x,y:point.y,reason:'native-can-attack-false'});
        bot.reason='Gruppenkampf: sichere Schussposition korrigieren';
       }
      }
    }
    bot.skills.rotation(enemy);
    return true;
  }
  bot.navigation?.rangePosition?.(enemy);
  bot.skills.rotation(enemy);
  if(p.c.target!==enemy.id)exec.run('target',['target'],()=>mayAssist(enemy)&&stillAssigned()&&
    (!!bot.entity(enemy.id)?.target||neutralShared),()=>p.call('change_target',enemy),{delay:500});
  if(cooldown){block('attack-cooldown');return true;}
  const attack=trackedAttack(enemy.id);
  const admitted=exec.run('attack',['attack','mana'],()=>{
    const live=bot.entity(enemy.id);
    return live&&(live.target&&bot.teamNames.includes(live.target)||neutralShared&&stillAssigned())&&
      mayAssist(live)&&(bot.strategy?.safeTarget?.(live.mtype,live)!==false||teamDefense(live))&&
      distance(p.c,live)<=range&&p.call('can_attack',live)===true&&
      !p.call('is_on_cooldown','attack');
  },attack.invoke,{delay:100,onSettle:attack.settle});
  if(!admitted)block('attack-admission-denied');
  else if(lastAssistBlock.id!==String(enemy.id)||now-lastAssistBlock.at>5000){
    lastAssistBlock={id:String(enemy.id),at:now};
    bot.event?.('combat.assistAttackAdmitted',{target:String(enemy.id),
      leader:bot.leader,monster:enemy.mtype,plan:plan?.id??null});
  }
  return true;
}
// The leader owns the approved FARM PLAN, never a monopoly on attacks.
// Followers own distinct local neutral targets once they reach the plan.
// A strictly bounded short/one-hit proof is preferred, but it is no longer
// the sole gateway: live low-threat admission is independently available.
let lastFollowerSpawnAudit=0;
function independentSpawnEngagement(){
 if(me.name===bot.leader||!cfg.party.enabled)return false;
 const plan=bot.teamPlan?.heartbeat?.();
 const engagedFarm=plan&&plan.realm===p.realm()&&
   samePlace(p.c,plan)&&distance(p.c,plan)<225;
 const diagnostic=(code,visible=[])=>{
   const now=Date.now();
   if(!engagedFarm||now-lastFollowerSpawnAudit<10000)return;
   lastFollowerSpawnAudit=now;
   const evidence=visible.slice(0,5).map(m=>{
     const a=bot.encounter?.sharedSpawnAssessment?.(m);
     const pos=a?.position??(a?.actorGap!==undefined?a:null);
     const fmt=n=>Number.isFinite(n)?Math.round(n):'unknown';
     return {id:m.id,reason:a?.reason??'unavailable',
       targetRange:fmt(distance(p.c,m)),
       actorArea:fmt(pos?.actorGap),leaderArea:fmt(pos?.leaderGap),
       monsterArea:fmt(pos?.targetGap),teamGap:fmt(pos?.teamGap),
       actorSource:pos?.actor?.source??null,
       leaderSource:pos?.leader?.source??null,
       monsterSource:pos?.monster?.source??null,
       areaKind:pos?.areaKind??null,
       adjacentKey:pos?.adjacentKey??null,
       primaryTargetGap:fmt(pos?.primaryTargetGap),
       adjacentCount:pos?.adjacentCount??null,
       raw:pos?.monsterRaw??null,real:pos?.monsterReal??null};
   });
   bot.event?.('combat.followerSpawnAudit',{
     code,plan:plan.id,monster:plan.target,
     movement:bot.movement.order?.owner??null,
     available:visible.length,
     samples:evidence.map(e=>e.id+':'+e.reason+
       ':distance='+e.targetRange+':area='+e.monsterArea+
       ':actorArea='+e.actorArea+':leaderArea='+e.leaderArea+
       ':teamGap='+e.teamGap).join('|'),
     geometry:evidence.length?JSON.stringify(evidence[0]):''
   });
 };
 if(bot.strategy?.busy||bot.movement.order||bot.recovering||
    bot.journal||bot.inventoryBlocked||bot.logistics?.reserved){
   diagnostic('operational-hold');
   return false;
 }
 const range=Math.max(5,(p.c.range??0)-
   Math.min(cfg.farming.rangeBuffer??0,(p.c.range??0)*.25));
 const reserved=()=>new Set((bot.farmers??[])
   .filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n)?.target)
   .filter(x=>x!=null).map(String));
 const claimed=reserved();
 const proof=m=>bot.encounter?.soloOneShot?.(m)||
   bot.encounter?.soloBoundedSpawn?.(m)||
   bot.encounter?.soloSharedSpawn?.(m);
 const visible=bot.monsters().filter(m=>m?.hp>0&&!m.dead&&
   !m.target&&m.mtype===plan?.target);
 const eligible=m=>m?.id!=null&&!claimed.has(String(m.id))&&
   distance(p.c,m)<=range&&proof(m)&&
   bot.allowed(m)&&p.call('can_attack',m)&&
   !p.call('is_on_cooldown','attack');
 const candidate=visible.filter(eligible)
   .sort((a,b)=>distance(p.c,a)-distance(p.c,b)||
     String(a.id).localeCompare(String(b.id)))[0];
 if(!candidate){
  diagnostic(visible.length?'no-admitted-in-range-target':'no-visible-neutral-spawn',visible);
  return false;
 }
 const id=candidate.id,check=()=>{
   const live=bot.entity(id);
   return !!live&&!reserved().has(String(id))&&
     distance(p.c,live)<=range&&
     proof(live)&&bot.allowed(live)&&
     p.call('can_attack',live)&&!p.call('is_on_cooldown','attack');
 };
 const exact=!!bot.encounter?.soloOneShot?.(candidate);
 const bounded=!exact&&!!bot.encounter?.soloBoundedSpawn?.(candidate);
 bot.target=candidate;
 bot.reason='Eigener sicherer Spawnkampf: '+candidate.mtype;
 bot.skills.rotation(null);
 if(p.c.target!==id)
   exec.run('target',['target'],()=>{
     const live=bot.entity(id);
     return !!live&&proof(live)&&bot.allowed(live)&&
       !reserved().has(String(id));
   },()=>p.call('change_target',bot.entity(id)),{delay:500});
 const attack=trackedAttack(id);
 if(exec.run('attack',['attack','mana'],check,attack.invoke,{
   delay:100,onSettle:attack.settle}))
  bot.event?.(exact?'combat.independentOneShot':
    bounded?'combat.independentBoundedSpawn':'combat.independentSharedSpawn',{
    target:id,monster:candidate.mtype,
    mode:exact?'one-shot':bounded?'short-bounded':'shared-low-threat',
    plan:plan?.id,range:Math.round(distance(p.c,candidate)),
    areaKind:bot.encounter?.sharedSpawnAssessment?.(candidate)?.position?.areaKind??'primary',
    adjacentKey:bot.encounter?.sharedSpawnAssessment?.(candidate)?.position?.adjacentKey??null});
 else diagnostic('attack-dispatch-denied',[candidate]);
 return true;
}
function recoverCohesion(now){
  if(me.name!==bot.leader)return false;
  const away=(bot.farmers??[]).filter(n=>n!==me.name).map(n=>{
    const h=bot.transport.fresh(n);
    return h?.running&&!h.rip&&!h.questVisit&&h.realm===p.realm()&&samePlace(p.c,h)?
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
    // Cave maps are generated instances, never ordinary farmspawns.
    // Keep urgent life support, but isolate overworld combat and movement.
    // Only dedicated, fully run-bound Cave executors may act here.
    if(inCaveInstance(p.c)){
      // Stop an already active direct Cave step when its exact evidence
      // expires or a monster appears. Never fall through to smart_move.
      if(bot.movement?.order?.owner==='cave'&&
         bot.caveDirect?.status?.({forDispatch:true})?.ready!==true)
       bot.movement.stop();
      // A running emergency hop has an independent, monster-bound proof.
      // Losing that proof stops native movement before any other Cave work.
      if(bot.movement?.order?.owner==='cave-evade'&&
         bot.caveEmergency?.status?.({forDispatch:true})?.ready!==true)
       bot.movement.stop();
      // Priest support steps have their own immutable healer/run admission.
      if(bot.movement?.order?.owner==='cave-priest'&&
         bot.cavePriestSupport?.status?.({forDispatch:true})?.ready!==true)
       bot.movement.stop();
      if(['farm','follow','cohesion','combat','world','regroup',
          'quest-escort'].includes(bot.movement?.order?.owner))
       bot.movement.stop();
      bot.target=null;
      const evidence=bot.caveTeam?.status?.();
      const criticalResponse=bot.caveCriticalResponse?.status?.();
      const held=criticalResponse?.holdOffense===true;
      // No Cave movement owner has a safe multi-aggro escape route.
      // Abort an already active direct hop on a critical or disputed
      // current-team snapshot; do NOT suppress urgent Priest healing.
      if(held&&['cave','cave-evade','cave-priest']
        .includes(bot.movement?.order?.owner))bot.movement.stop();
      // Only the dedicated Ranger basic-defense executor may issue an
      // instance attack. It refuses neutral mobs, movement and skills and
      // revalidates the exact team/monster at network dispatch.
      const healed=bot.cavePriest?.tick?.()===true;
      if(healed&&bot.movement?.order?.owner==='cave-priest')
       bot.movement.stop();
      // Healing outranks positioning; a short support step may follow.
      const positioned=!healed&&!held&&(
       bot.movement?.order?.owner==='cave-priest'||
       bot.cavePriestSupport?.tick?.()===true);
      // Guarded local separation outranks Ranger attacks, not Priest
      // healing. A running emergency hop also blocks new attacks.
      const evasive=!healed&&!held&&!positioned&&(
       bot.movement?.order?.owner==='cave-evade'||
       bot.caveEmergency?.tick?.()===true);
      const defended=!healed&&!held&&!positioned&&!evasive&&bot.caveCombat?.tick?.()===true;
      const cohesion=!healed&&!held&&!positioned&&!evasive&&!defended&&bot.caveDirect?.tick?.()===true;
      bot.reason=healed?'Cave: gezielte Priest-Heilung angefordert':
       held?'Cave: kritische Mehrfachaggro – Offensive und Bewegung gesperrt':
       positioned?'Cave: Priest sichert Heilerreichweite per Direktschritt':
       evasive?'Cave: abgesicherter Direktschritt aus Nahkampfdruck':
       defended?'Cave: bestätigte Teamverteidigung angefordert':
       cohesion?'Cave: sicherer Direktschritt zum Priest angefordert':
       'Cave-Gruppe: '+(evidence?.reason??'Instanz gesperrt');
      return;
    }
    const c=p.c,now=Date.now();
    const detachment=assessQuestDetachment(bot);
    const questVisitor=(bot.farmers??[]).find(n=>n!==me.name&&
      bot.transport?.fresh?.(n)?.questVisit===true);
    // Cancel an ALREADY QUEUED follower/escort route as soon as the NPC
    // visitor appears. Otherwise native smart_move may continue to Daisy
    // even though no new escort is being scheduled.
    if(questVisitor&&['follow','quest-escort','cohesion'].includes(
      bot.movement.order?.owner))bot.movement.stop();

    // While a Ranger follows an approved native farm route, hostile road
    // aggro must not turn the trip into random spiral/orbit manoeuvres.
    // Keep potion consumption and Priest healing active. This policy does
    // not apply after arrival, to the Merchant, or to unrelated travel.
    const road=me.role==='farmer'?roadTravel():null;
    const emergency=bot.combatAssessment?.emergency?.();
    const endangeredPeer=emergency?.critical?.some(h=>
     h?.name!==c.name&&h?.threats>0);
    // A rare live attacker must preempt ordinary march/follow short-circuits.
    const urgentRareAggro=bot.monsters().some(m=>m.hp>0&&!m.dead&&
     (bot.farmers??[]).includes(m.target)&&isNaturallyAggressive(p.G,m)&&
     (m.mtype==='greenjr'||p.G.monsters?.[m.mtype]?.boss===true));
    const marchLeader=bot.transport?.fresh?.(bot.leader);
    // A live personal Monsterhunt errand owns the Priest's route until
    // Daisy confirms it or the emergency handler deliberately interrupts it.
    // All follower-march returns below must be unreachable during the visit.
    const marchDestination=!bot.strategy?.busy&&me.role==='farmer'&&cfg.farming.enabled!==false&&
     cfg.party.enabled&&bot.leader&&me.name!==bot.leader?
     sharedFarmMarchDestination(c,marchLeader,p.realm()):null;
    const actualBlock=blockingMonster();
    if(marchDestination&&!samePlace(c,marchLeader)&&!actualBlock&&!endangeredPeer&&!urgentRareAggro){
     if(marchGraphG!==p.G){marchGraphG=p.G;marchGraph=mapGraph(p.G);}
     const ownHops=mapHops(marchGraph,c.map,marchDestination.map),
      leadHops=mapHops(marchGraph,marchLeader.map,marchDestination.map);
     if(Number.isFinite(ownHops)&&ownHops<leadHops){
      if(bot.movement.order?.owner==='follow')bot.movement.stop();
      bot.target=null;bot.reason='Gruppenreise: am Portal auf Leader warten';
      bot.skills?.rotation?.(null);return;
     }
    }
    // Followers ahead of a waiting leader stop at the leash, rather than
    // completing the entire cross-map route independently.
    if(marchDestination&&samePlace(c,marchLeader)&&samePlace(c,marchDestination)&&
       distance(c,marchLeader)>Math.max(100,cfg.party.followDistance??180)&&
       distance(c,marchDestination)+60<distance(marchLeader,marchDestination)&&
       !actualBlock&&!endangeredPeer&&!urgentRareAggro){
     if(bot.movement.order?.owner==='follow')bot.movement.stop();
     bot.target=null;bot.reason='Gruppenreise: auf Leader warten';
     bot.skills?.rotation?.(null);return;
    }
    if(marchDestination&&samePlace(c,marchLeader)&&
       distance(c,marchLeader)>Math.max(100,cfg.party.followDistance??180)&&
       !actualBlock&&!endangeredPeer&&!urgentRareAggro){
     const order=bot.movement.order;
     if(order?.owner==='follow'&&(!order.dest||!samePlace(order.dest,marchLeader)||distance(order.dest,marchLeader)>80))bot.movement.stop();
     if(!bot.movement.order)bot.movement.go({...marchLeader,radius:65},'follow');
     bot.target=null;bot.reason='Gruppenreise: zum Leader aufschließen';
     bot.skills?.rotation?.(null);return;
    }
    // A healthy Priest whose route was cancelled by the old range gate must
    // resume the trusted march, instead of feeding the same gate forever.
    if(marchDestination&&!bot.movement.order&&!bot.strategy?.busy&&
       !actualBlock&&!endangeredPeer&&!urgentRareAggro&&c.hp/c.max_hp>=.6&&
       bot.monsters().some(m=>m.hp>0&&!m.dead&&(bot.teamNames??[]).includes(m.target))){
     bot.target=null;bot.movement.go(marchDestination,'follow');
     bot.skills?.rotation?.(null);return;
    }
    // An active, physically progressing farm route owns movement even when
    // an endangered peer triggers the emergency assessor. Previously this
    // condition dropped out on endangeredPeer and the assessed lethal bigbird
    // was attacked in place instead of maintaining the native escape route.
    if(road?.continueRoute&&!actualBlock&&!urgentRareAggro){
      if(c.ctype==='priest'&&cfg.party.healing){
       const peers=(bot.farmers??[]).filter(n=>n!==c.name)
        .map(n=>bot.transport?.fresh?.(n));
       const patient=selectMarchHealingPatient(c,peers,{realm:p.realm(),now});
       const visible=patient&&bot.entity?.(patient.name);
       const range=p.G.skills?.heal?.range??c.range;
       if(visible&&samePlace(c,visible)&&distance(c,visible)<=range-10)
        bot.skills?.rescue?.(visible);
      }
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
    if(emergency?.active&&rescueTeam(emergency))return;
    const threat=bot.monsters().filter(m=>isOwnAggressiveThreat(p.G,m,c.name)).sort((a,b)=>distance(c,a)-distance(c,b))[0];
    const rescueRoster=(bot.farmers??[]).map(name=>name===c.name?c:
      bot.transport?.fresh?.(name)).filter(Boolean);
    const rescueFocus=chooseEmergencyFocus(emergency?.monsters??[],rescueRoster,p.G.monsters);
    const blocker=blockingMonster();
    if(blocker&&['farm','follow'].includes(bot.movement.order?.owner))bot.movement.stop();
    const danger=blocker??rescueFocus??threat;
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
      // A verified transit obstruction is a navigation/survival problem,
      // never permission for stationary defensive fire or combat pursuit.
      // Preserve healing and potions, and only evade verified self-aggro.
      const plan=travelPlan();
      if(me.role==='farmer'&&plan&&
         (!samePlace(c,plan)||distance(c,plan)>85)&&
         !inCaveInstance(c)){
       bot.target=null;
       bot.reason='Gefährliche Weg-Aggro: sichere Flucht statt Kampf';
       if(blocker){
        bot.recovering=true;
        if(blocker.target===c.name)retreat(blocker);
        else emergencyConvergence(blocker);
       }
       bot.skills?.rotation?.(null);
       if(now-lastRoadAggroAt>=10000){lastRoadAggroAt=now;
        bot.event?.('combat.transitOffenseSuppressed',{
         monster:danger.mtype,monsterId:danger.id,
         blocked:!!blocker,owner:bot.movement.order?.owner??null});
       }
       return;
      }
      const assessment=bot.combatAssessment?.assess(danger);
      // A verified rare attacker can threaten a farmer even when its TTK
      // forecast forbids a normal fight. Redirect that ALREADY engaged mob
      // with native taunt or take a short local intercept step.
      if(assessment?.reason==='insufficient-time-to-kill'&&
         c.ctype==='warrior'&&isNaturallyAggressive(p.G,danger)&&
         danger.target!==c.name&&(bot.farmers??[]).includes(danger.target)&&
         !bot.monsters().some(m=>m.id!==danger.id&&m.target===c.name&&m.hp>0&&!m.dead)){
       if(bot.skills?.emergencyTaunt?.(danger)){
        bot.reason='Notfall-Taunt: '+danger.mtype;
        bot.event?.('combat.emergencyTaunt',{monster:danger.mtype,
         monsterId:danger.id,victim:danger.target});
        return;
       }
       const patient=bot.transport?.fresh?.(danger.target),clock=Date.now();
       if(patient?.running&&!patient.rip&&patient.realm===p.realm()&&
          Number.isFinite(patient.received)&&patient.received<=clock&&
          clock-patient.received<=4000&&
          !bot.inventoryBlocked&&!bot.journal&&
          ['farm','follow','combat',undefined].includes(bot.movement.order?.owner)){
        const skillRange=p.G.skills?.taunt?.range??c.range;
        const point=warriorEmergencyInterceptPoint(c,danger,patient,
         skillRange,(x,y)=>p.call('can_move_to',x,y)===true);
        if(point){
         if(['farm','follow'].includes(bot.movement.order?.owner))
          bot.movement.stop();
         if(!bot.movement.order)bot.movement.go(point,'combat');
         if(bot.movement.order?.owner==='combat'){
          bot.reason='Notfall-Abfangen: '+danger.mtype;
          bot.target=danger;
          bot.event?.('combat.emergencyIntercept',{monster:danger.mtype,
           monsterId:danger.id,victim:danger.target,
           x:point.x,y:point.y});
          return;
         }
        }
       }
      }
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
          if(p.c.target!==danger.id)exec.run('target',['target'],()=>!inCaveInstance(p.c)&&bot.allowed(danger),
            ()=>p.call('change_target',danger),{delay:500});
          const attack=trackedAttack(danger.id);
          exec.run('attack',['attack','mana'],()=>{
            const live=bot.entity(danger.id);
            return !inCaveInstance(p.c)&&live&&bot.combatAssessment?.canDefend(live)===true&&
              bot.allowed(live)&&distance(p.c,live)<=range&&
              p.call('can_attack',live)&&!p.call('is_on_cooldown','attack');
          },attack.invoke,{delay:100,onSettle:attack.settle});
        }
        return;
      }
      // When a verified aggressive mob is ALREADY striking the team, the
      // TTK forecast cannot prohibit all defensive fire: the victim would
      // otherwise absorb hits while healthy nearby farmers stand idle.
      // Basic single-target attacks only; the regular viability gate still
      // owns voluntary boss pulls, all offensive skills and unsafe chases.
      if(assessment?.reason==='insufficient-time-to-kill'&&
         isNaturallyAggressive(p.G,danger)&&
         engagedEmergencyBasicDefense(c,danger,bot.farmers??[])&&
         !bot.monsters().some(m=>m.id!==danger.id&&m.target===c.name&&m.hp>0&&!m.dead)&&
         p.call('can_attack',danger)&&!p.call('is_on_cooldown','attack')){
       bot.target=danger;
       bot.reason='Notwehr: Teammitglied vor '+danger.mtype+' schützen';
       bot.skills.rotation(null);
       const shot=trackedAttack(danger.id);
       exec.run('attack',['attack','mana'],()=>{
        const live=bot.entity(danger.id);
        return live&&isNaturallyAggressive(p.G,live)&&
         engagedEmergencyBasicDefense(p.c,live,bot.farmers??[])&&
         !bot.monsters().some(m=>m.id!==live.id&&m.target===p.c.name&&m.hp>0&&!m.dead)&&
         p.call('can_attack',live)&&!p.call('is_on_cooldown','attack');
       },shot.invoke,{delay:100,onSettle:shot.settle});
       if(lastDefensiveShot.id!==danger.id||now-lastDefensiveShot.at>=12000){
        lastDefensiveShot={id:danger.id,at:now};
        bot.event?.('combat.emergencyBasicDefense',{
         monster:danger.mtype,monsterId:danger.id,victim:danger.target,
         reason:'already-engaged-insufficient-time-to-kill'});
       }
       return;
      }
      // Regroup toward the endangered Priest without rushing into an
      // unverified kill. This also escapes the normal "group march paused"
      // standstill. Combat remains forbidden until fresh evidence passes.
      if(['ranger','priest','mage'].includes(c.ctype)&&(blocker??rescueFocus)?.target&&
         (assessment?.reason==='insufficient-time-to-kill'||
          assessment?.reason==='party-not-in-combat-support-range'||
          assessment?.decision==='regroup'||
          assessment?.unavailableMembers?.length>0)){
       const patient=bot.transport?.fresh?.((blocker??rescueFocus).target);
       const rally=safeEmergencyRallyPoint(c,patient,danger,
        p.G.monsters?.[danger.mtype]?.range);
       if(rally&&p.call('can_move_to',rally.x,rally.y)){
        bot.target=null;
        bot.recovering=true;
        bot.reason='Gruppenrettung: sicher zum angegriffenen '+patient.name;
        const order=bot.movement.order;
        if(order?.owner==='combat'&&order.dest&&
           distance(order.dest,rally)<80)return;
        if(order&&['farm','follow','combat','world'].includes(order.owner))
         bot.movement.stop();
        if(!bot.movement.order)bot.movement.go(rally,'combat');
        bot.event?.('combat.emergencyRally',{
         victim:patient.name,monster:danger.mtype,
         range:Math.round(distance(c,danger))});
        return;
       }
       // A verified selected peer on another map cannot help this fight
       // locally. Rejoin without stealing movement from a self-defender.
       const leaderPeer=bot.transport?.fresh?.(bot.leader);
       const anchor=patient?.running&&!patient.rip?patient:
        leaderPeer?.running&&!leaderPeer.rip?leaderPeer:null;
       if(anchor&&anchor.realm===p.realm()&&!samePlace(c,anchor)&&
          danger.target!==c.name&&Number.isFinite(anchor.x)&&
          Number.isFinite(anchor.y)&&!bot.monsters().some(m=>m.target===c.name)){
        const order=bot.movement.order;
        if(order?.owner==='combat'&&order.dest&&
           samePlace(order.dest,anchor)&&distance(order.dest,anchor)<100){
         bot.reason='Gruppenverteidigung: zum Team zurückkehren';
         return;
        }
        if(order&&['kite','farm','follow','combat','world'].includes(order.owner))
         bot.movement.stop();
        if(!bot.movement.order){
         bot.movement.go({...anchor,radius:75},'combat');
         bot.event?.('combat.teamRegroup',{member:anchor.name,
          source:'separated-support',monster:danger.mtype});
        }
        bot.target=null;bot.reason='Gruppenverteidigung: zum Team zurückkehren';
        return;
       }
      }
      bot.target=null;bot.reason='Gefährliche Aggro: '+(assessment?.reason??'unverified');
      bot.recovering=true;bot.strategy?.interruptQuest?.();
      if(threat){if(!emergencyConvergence(threat))retreat(threat);}
      else if(emergencyConvergence(danger))return;
      else if(['farm','combat','follow','kite'].includes(bot.movement.order?.owner))
        bot.movement.stop();
      bot.skills.rotation(null);
      return;
    }
    if(emergency?.active){
      if(emergencyConvergence())return;
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
    // Keep existing emergency/engaged-team defense unblocked, but do not
    // start another voluntary neutral pull while nearby chests accumulate.
    if(bot.lootBacklog?.shouldYieldPull?.()){
      bot.target=null;
      bot.reason='Beute-Rückstand abbauen';
      if(['farm','follow'].includes(bot.movement.order?.owner))
        bot.movement.stop();
      bot.skills.rotation(null);
      return;
    }
    // Assistance to the leader's current fight takes precedence over a new
    // independent neutral pull (including aimed Ranger AoE). Otherwise a
    // follower can steal attack cadence from the already engaged team focus.
    const escortLeader=bot.transport.fresh(bot.leader);
    if(cfg.party.enabled&&me.name!==bot.leader&&escortLeader?.running&&
       helpEngagedTeamFight(escortLeader))return;
    // A healthy follower may then clear its own separately verified spawn.
    if(!storageHold&&bot.skills?.independentOneShotAoE?.())return;
    if(!storageHold&&independentSpawnEngagement())return;
    if(bot.strategy?.travel()){bot.skills.rotation(null);return;}
    if(questVisitor&&!detachment){waitSafely('Monsterhunt-NPC-Besuch: Farmanker halten; kein sicherer Zweier-Pull');return;}
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
      if(!detachment&&(!samePlace(c,leader)||distance(c,leader)>followerReassemblyDistance(cfg))){
       if(helpEngagedTeamFight(leader))return;
       bot.target=null;bot.reason='Folge '+bot.leader;
       if(['combat','farm','kite'].includes(bot.movement.order?.owner))bot.movement.stop();
       bot.movement.go({...leader,radius:Math.min(cfg.party.followDistance/2,
        Math.max(20,followerReassemblyDistance(cfg)/2))},'follow');
       bot.skills.rotation(null);return;
      }
      if(!detachment&&(leader.questVisit===true||leader.squadQuestVisit===true)){waitSafely('Monsterhunt-NPC-Besuch: am Farmanker bleiben');return;}
    }
    if(cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&n!==detachment?.visitor&&(!bot.transport.fresh(n)?.running||!samePlace(c,bot.transport.fresh(n))||bot.transport.fresh(n)?.realm!==p.realm()||distance(c,bot.transport.fresh(n))>cfg.party.followDistance*2))){if(leader?.running&&helpEngagedTeamFight(leader))return;if(recoverCohesion(now)){bot.skills.rotation(null);return;}waitSafely('Warte auf Gruppe');return;}if(bot.movement.order?.owner==='cohesion')bot.movement.stop();
    // The leader's first neutral pull is admitted only after all selected
    // farmers have actually assembled at this spawn. Engaged-team defense
    // stays available even if a member has fallen behind.
    if(me.name===(detachment?.puller??bot.leader)&&!bot.monsters().some(m=>m.target&&bot.teamNames.includes(m.target))){
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
    if(c.target!==target.id)exec.run('target',['target'],()=>!inCaveInstance(p.c)&&bot.allowed(target),()=>p.call('change_target',target),{delay:500});
    const attack=trackedAttack(target.id);
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return !inCaveInstance(p.c)&&t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},attack.invoke,{delay:100,onSettle:attack.settle});
  }
  return {tick,retreat,travelStatus,safety(){bot.recovering=false;if(recover()){bot.recovering=true;return true;}
    // The emergency scheduler executes BEFORE normal farmer.tick. Honor the
    // same verified road-route exception here or its preflight will trigger
    // an orbit/retreat before the main combat loop can preserve the route.
    if(me.role==='farmer'&&roadTravel().continueRoute)return false;
    if(me.role==='farmer'&&blockingMonster())return false;
    const threat=bot.monsters().find(m=>isOwnAggressiveThreat(p.G,m,p.c.name));if(threat&&(me.role==='merchant'||bot.strategy?.safeTarget?.(threat.mtype,threat)===false)){bot.recovering=true;bot.strategy?.interruptQuest?.();bot.strategy?.failActivity?.('Gefährliche Aggro',threat.mtype);bot.target=null;retreat(threat);bot.skills.rotation(null);return true;}return false;}};
}
