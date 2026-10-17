import {distance,xy,samePlace} from '../core/policy.mjs';
import {isNaturallyAggressive} from './aggression.mjs';
import {planOrbitalKite} from './orbital-kiting.mjs';
export function createCombatNavigation(bot){
 const blocked=new Map();let lastRangeMove=0,lastOrbit=null,orbitDirection=null,orbitReversals=0,orbitSteps=0,spiralSteps=0,orbitBlocked=0;
 function safe(x,y){if(!bot.p.call('can_move_to',x,y))return false;const c=bot.p.c;return bot.monsters().every(m=>!m.target&&!isNaturallyAggressive(bot.p.G,m)||m.target&&bot.teamNames.includes(m.target)||Math.hypot(x-xy(m).x,y-xy(m).y)>(m.range??30)+30||distance(c,m)<Math.hypot(x-xy(m).x,y-xy(m).y));}
 function waypoint(target,retreat=false){const c=bot.p.c,a=xy(c),b=xy(target),plan=bot.teamPlan?.heartbeat(),anchor=plan&&samePlace(c,plan)?plan:a,reach=Math.max(35,Math.min(90,(c.speed??40)*1.5)),base=Math.atan2(a.y-b.y,a.x-b.x)+(retreat?0:Math.PI);let best=null;
  for(let n=0;n<16;n++){const angle=base+n*Math.PI/8,x=a.x+Math.cos(angle)*reach,y=a.y+Math.sin(angle)*reach;if(!safe(x,y))continue;const point={map:c.map,in:c.in??c.map,x,y,radius:6},threat=bot.monsters().filter(m=>m.target===c.name&&isNaturallyAggressive(bot.p.G,m)).reduce((v,m)=>v+1/Math.max(1,distance(point,m)),0),anchorDistance=distance(point,anchor),goalDistance=distance(point,target),score=(retreat?-threat*1000:-goalDistance)-Math.max(0,anchorDistance-(bot.cfg.farming.orbitRadius??220))*2;
   if(!best||score>best.score)best={...point,score};
  }return best;
 }
 // Genuine v3 Alpha31/Alpha33 orbital kiting: actively circle around an
 // engaged enemy within a safe firing band, including when already at range.
 // If too close, take a tangential spiral step; never stop attacking to kite.
 function rangePosition(t){
  const c=bot.p.c;
  if(!bot.cfg.farming.kiting||!['ranger','mage','priest'].includes(c.ctype)||
     !t||!isNaturallyAggressive(bot.p.G,t)||t.dead||t.hp<=0||!samePlace(c,t)||!Number.isFinite(c.range)||c.range<80||
     t.target&&t.target!==c.name)return false;
  const now=Date.now();
  if(now-lastRangeMove<650||bot.movement.order&&!['kite','combat'].includes(bot.movement.order.owner))return false;
  if(bot.movement.order?.owner==='kite')return false;
  const plan=bot.teamPlan?.heartbeat?.();
  const healer=(c.hp/c.max_hp<.85&&t.target===c.name?
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
  if(bot.movement.order?.owner==='combat')bot.movement.stop();
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
 return {waypoint,rangePosition,permitted(m){for(const [id,t] of blocked)if(t<Date.now())blocked.delete(id);return !blocked.has(m.id);},blocked(m){if(blocked.size>64)blocked.clear();blocked.set(m.id,Date.now()+15000);bot.event('navigation.targetBlocked',{target:m.id,reason:'Kein freier lokaler Umweg'});},orbit(t){if(!bot.cfg.farming.orbit||!t||t.target!==bot.me.name||!isNaturallyAggressive(bot.p.G,t))return false;if(rangePosition(t))return true;const point=waypoint(t,true);if(!point)return false;if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(point.x,point.y,'kite');return true;},status:()=>({blocked:blocked.size,orbitSteps,spiralSteps,orbitReversals,orbitBlocked,lastOrbit})};
}
