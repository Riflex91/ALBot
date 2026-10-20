import {distance,xy,samePlace} from '../core/policy.mjs';
import {isNaturallyAggressive} from './aggression.mjs';
import {planOrbitalKite} from './orbital-kiting.mjs';
import {committedFarmTransit} from './transit-defense.mjs';

/**
 * Bounded dynamic local avoidance. The native smart_move retains authority
 * for static-world paths; this planner only chooses an immediately reachable
 * short step and tests the entire direct segment against known live threats.
 */
export function planHazardStep({character,goal,monsters=[],definitions={},canMove=()=>false,
 stepLengths=[75,50,30]}={}){
 if(!character||![character.x,character.y].every(Number.isFinite))return null;
 const dangerous=(monsters??[]).filter(m=>m?.hp>0&&!m.dead&&
   samePlace(character,m)&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&
   (m.target||isNaturallyAggressive({monsters:definitions},m)));
 if(!dangerous.length)return null;
 const here={x:character.x,y:character.y};
 const validGoal=goal&&samePlace(character,goal)&&
   Number.isFinite(goal.x)&&Number.isFinite(goal.y);
 let ax=0,ay=0;
 for(const m of dangerous){
  const dx=here.x-m.x,dy=here.y-m.y,d=Math.hypot(dx,dy)||1;
  const weight=(definitions[m.mtype]?.attack??m.attack??20)*
    (definitions[m.mtype]?.frequency??m.frequency??1)/Math.max(35,d*d/70);
  ax+=dx/d*weight;ay+=dy/d*weight;
 }
 const retreatHeading=Math.atan2(ay,ax);
 const targetHeading=validGoal?Math.atan2(goal.y-here.y,goal.x-here.x):retreatHeading;
 let best=null;
 for(const step of stepLengths){
  for(const deviation of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,
   Math.PI/2,-Math.PI/2,Math.PI]){
   const angle=targetHeading+deviation,x=here.x+Math.cos(angle)*step,
    y=here.y+Math.sin(angle)*step;
   if(!canMove(x,y))continue;
   let exposure=0,rejected=false,clearanceGain=0;
   for(const mob of dangerous){
    const before=Math.hypot(here.x-mob.x,here.y-mob.y),
     after=Math.hypot(x-mob.x,y-mob.y),
     radius=(mob.range??definitions[mob.mtype]?.range??30)+45;
    const dx=x-here.x,dy=y-here.y;
    const u=Math.max(0,Math.min(1,((mob.x-here.x)*dx+
     (mob.y-here.y)*dy)/Math.max(1,dx*dx+dy*dy)));
    const nearest=Math.hypot(here.x+dx*u-mob.x,here.y+dy*u-mob.y);
    // Never cut through an untouched danger zone; if already inside one,
    // accept only routes that do not push further into the attacker.
    if(before>=radius&&nearest<radius||before<radius&&after<before-3){
     rejected=true;break;
    }
    const attack=(definitions[mob.mtype]?.attack??mob.attack??20)*
     (definitions[mob.mtype]?.frequency??mob.frequency??1);
    exposure+=attack/Math.max(15,nearest)*100;
    clearanceGain+=(after-before)/Math.max(1,radius);
   }
   if(rejected)continue;
   const newGap=validGoal?Math.hypot(x-goal.x,y-goal.y):0;
   const oldGap=validGoal?distance(here,goal):0;
   if(validGoal&&newGap>oldGap+10&&clearanceGain<.2)continue;
   const score=exposure*10+newGap*.8-clearanceGain*80+
    (validGoal&&newGap>=oldGap-5?1000:0)+
    (step<50?8:0);
   if(!best||score<best.score)best={map:character.map,
    in:character.in??character.map,x,y,radius:8,score,
    exposure:+exposure.toFixed(2)};
  }
 }
 return best;
}

// Explicitly engaged monsters may be passive by species (for example when
// a ranger pulled them). Only actual SELF-aggro authorizes evasive movement.
// A verified speed advantage is necessary, but not sufficient to promise
// zero hits (ranged attacks, projectiles and lag still need consideration).
export function activeKiteEligibility(character,target,monsterMeta={}){
 if(!character||!target||target.dead||!(target.hp>0)||
    target.target!==character.name)return {allowed:false,reason:'no-live-self-aggro'};
 if(!['ranger','mage','priest'].includes(character.ctype))
  return {allowed:false,reason:'not-ranged-class'};
 if(!Number.isFinite(character.range)||character.range<80)
  return {allowed:false,reason:'insufficient-character-range'};
 const heroSpeed=character.speed,enemySpeed=Number.isFinite(target.speed)?
  target.speed:monsterMeta?.speed;
 if(!Number.isFinite(heroSpeed)||heroSpeed<=0||
    !Number.isFinite(enemySpeed)||enemySpeed<=0)
  return {allowed:false,reason:'speed-unverified'};
 if(heroSpeed<=enemySpeed)
  return {allowed:false,reason:'enemy-not-slower'};
 return {allowed:true,reason:'confirmed-self-aggro-speed-advantage',
  characterSpeed:heroSpeed,monsterSpeed:enemySpeed};
}
export function createCombatNavigation(bot){
 const blocked=new Map();let lastRangeMove=0,lastOrbit=null,orbitDirection=null,orbitReversals=0,orbitSteps=0,spiralSteps=0,orbitBlocked=0,lastKiteDenial='',lastKiteDenialAt=0;
 function safe(x,y){if(!bot.p.call('can_move_to',x,y))return false;const c=bot.p.c;return bot.monsters().every(m=>!m.target&&!isNaturallyAggressive(bot.p.G,m)||m.target&&bot.teamNames.includes(m.target)||Math.hypot(x-xy(m).x,y-xy(m).y)>(m.range??30)+30||distance(c,m)<Math.hypot(x-xy(m).x,y-xy(m).y));}
 function waypoint(target,retreat=false){const c=bot.p.c,a=xy(c),b=xy(target),plan=bot.teamPlan?.heartbeat(),anchor=plan&&samePlace(c,plan)?plan:a,reach=Math.max(35,Math.min(90,(c.speed??40)*1.5)),base=Math.atan2(a.y-b.y,a.x-b.x)+(retreat?0:Math.PI);let best=null;
  for(let n=0;n<16;n++){const angle=base+n*Math.PI/8,x=a.x+Math.cos(angle)*reach,y=a.y+Math.sin(angle)*reach;if(!safe(x,y))continue;const point={map:c.map,in:c.in??c.map,x,y,radius:6},threat=bot.monsters().filter(m=>m.target===c.name&&isNaturallyAggressive(bot.p.G,m)).reduce((v,m)=>v+1/Math.max(1,distance(point,m)),0),anchorDistance=distance(point,anchor),goalDistance=distance(point,target),score=(retreat?-threat*1000:-goalDistance)-Math.max(0,anchorDistance-(bot.cfg.farming.orbitRadius??220))*2;
   if(!best||score>best.score)best={...point,score};
  }return best;
 }
 // Genuine v3 Alpha31/Alpha33 orbital kiting: actively circle around an
 // engaged enemy within a safe firing band, including when already at range.
 // If too close, take a tangential spiral step; never stop attacking to kite.
 function hazardPoint(goal=null){
  const c=bot.p.c;
  const active=bot.monsters().filter(m=>m.hp>0&&!m.dead&&samePlace(c,m));
  return planHazardStep({character:c,goal,monsters:active,
   definitions:bot.p.G.monsters,canMove:(x,y)=>bot.p.call('can_move_to',x,y)});
 }
 function hazardEscape(goal=null){
  const owner=bot.movement.order?.owner;
  if(owner&&!['combat','farm','follow','kite','cohesion','world','regroup'].includes(owner))
   return false;
  const point=hazardPoint(goal);if(!point)return false;
  if(owner)bot.movement.stop();
  bot.movement.local(point.x,point.y,'kite');
  if(bot.movement.order?.owner!=='kite')return false;
  bot.event?.('combat.hazardDetour',{x:point.x,y:point.y,
   exposure:point.exposure,goal:goal?.name??null});
  return true;
 }
 function rangePosition(t){
  const c=bot.p.c;
  if(!bot.cfg.farming.kiting||!t||!samePlace(c,t))return false;
  // A road attacker is not a reason to cancel a verified smart_move to the
  // squad's spawn. Potions and Priest healing continue in the farmer loop.
  const routePlan=bot.teamPlan?.heartbeat?.()??bot.transport?.fresh?.(bot.leader)?.farmPlan;
  if(committedFarmTransit(c,bot.movement.order,routePlan))return false;
  // A distant engaged target needs a combat approach or team regroup, not
  // another orbit waypoint. The old unconditional orbit could strand Rangers
  // hundreds of units away from their firing band and from their Priest.
  const firingDistance=distance(c,t);
  if(firingDistance>Math.max(c.range+25,(t.range??0)+70)){
   if(bot.movement.order?.owner==='kite')bot.movement.stop();
   return false;
  }
  const eligibility=activeKiteEligibility(c,t,bot.p.G.monsters?.[t.mtype]);
  const now=Date.now();
  if(!eligibility.allowed){
   if(t.target===c.name&&(eligibility.reason!==lastKiteDenial||
      now-lastKiteDenialAt>=30000)){
    lastKiteDenial=eligibility.reason;lastKiteDenialAt=now;
    bot.event?.('combat.kiteDeferred',{target:t.id,reason:eligibility.reason});
   }
   return false;
  }
  if(now-lastRangeMove<650||bot.movement.order?.owner==='kite')return false;
  const owner=bot.movement.order?.owner;
  // Active incoming hits outrank ordinary team following and spawn travel;
  // value transactions, teleport channels and economy logistics still win.
  if(owner&&!['combat','follow','farm','world','cohesion'].includes(owner))
   return false;
  const plan=bot.teamPlan?.heartbeat?.();
  const healer=(t.target===c.name?
    (bot.farmers??[]).filter(n=>n!==c.name)
     .map(n=>bot.transport?.fresh?.(n)).find(h=>h?.class==='priest'&&
      h.running&&!h.rip&&samePlace(c,h)&&
      Number.isFinite(h.x)&&Number.isFinite(h.y)&&
      Number.isFinite(h.stats?.range)&&h.stats.range>50):null);
  const anchor=healer?xy(healer):
    plan&&samePlace(c,plan)&&Number.isFinite(plan.x)&&Number.isFinite(plan.y)?xy(plan):null;
  const anchorRadius=healer?
    Math.max(60,Math.min(bot.cfg.farming.orbitRadius??220,healer.stats.range-20)):
    bot.cfg.farming.orbitRadius??220;
  if(orbitDirection===null){
   let hash=0;for(const ch of String(c.name??'ranger'))hash=((hash*31)+ch.charCodeAt(0))|0;
   orbitDirection=Math.abs(hash)%2?1:-1;
  }
  const step=planOrbitalKite(c,t,bot.p.G.monsters?.[t.mtype],{
   direction:orbitDirection,anchor,anchorRadius,
   canMove:(x,y)=>safe(x,y)
  });
  if(!step){
   orbitBlocked++;
   if(orbitBlocked===1||orbitBlocked%30===0)bot.event?.('combat.orbitBlocked',{target:t.id,reason:'Kein sicherer erreichbarer Orbitweg; Angriffe laufen weiter'});
   return false;
  }
  if(step.direction!==orbitDirection){orbitReversals++;orbitDirection=step.direction;}
  // A tactical fighting waypoint may replace the old approach route but not
  // economy, team-follow, emergency recovery or independent travel ownership.
  if(owner)bot.movement.stop();
  bot.movement.local(step.x,step.y,'kite');
  if(bot.movement.order?.owner!=='kite')return false;
  lastRangeMove=now;orbitBlocked=0;
  if(step.mode==='spiral')spiralSteps++;else orbitSteps++;
  lastOrbit={mode:step.mode,at:now,target:t.id,direction:orbitDirection,
   x:step.x,y:step.y,step:step.step,angleStepDeg:step.angleStepDeg,
   distance:distance(c,t),afterDistance:step.afterDistance,
   hardSafeDistance:step.hardSafeDistance,desiredDistance:step.desiredDistance,
   maximumDistance:step.maximumDistance};
  bot.event?.(step.mode==='spiral'?'combat.spiralEscape':'combat.orbitStep',lastOrbit);
  return true;
 }
 return {waypoint,rangePosition,hazardPoint,hazardEscape,permitted(m){for(const [id,t] of blocked)if(t<Date.now())blocked.delete(id);return !blocked.has(m.id);},blocked(m){if(blocked.size>64)blocked.clear();blocked.set(m.id,Date.now()+15000);bot.event('navigation.targetBlocked',{target:m.id,reason:'Kein freier lokaler Umweg'});},orbit(t){if(!bot.cfg.farming.orbit||!t||t.target!==bot.me.name)return false;if(rangePosition(t))return true;const point=waypoint(t,true);if(!point)return false;if(bot.movement.order?.owner==='kite')return true;if(bot.movement.order?.owner&&!['combat','follow','farm','world','cohesion'].includes(bot.movement.order.owner))return false;if(bot.movement.order)bot.movement.stop();return bot.movement.local(point.x,point.y,'kite')!==false;},status:()=>({blocked:blocked.size,orbitSteps,spiralSteps,orbitReversals,orbitBlocked,lastOrbit})};
}
