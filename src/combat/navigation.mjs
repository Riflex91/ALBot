import {distance,xy,samePlace} from '../core/policy.mjs';
import {isNaturallyAggressive} from './aggression.mjs';
export function createCombatNavigation(bot){
 const blocked=new Map();let lastRangeMove=0;
 function safe(x,y){if(!bot.p.call('can_move_to',x,y))return false;const c=bot.p.c;return bot.monsters().every(m=>!m.target&&!isNaturallyAggressive(bot.p.G,m)||m.target&&bot.teamNames.includes(m.target)||Math.hypot(x-xy(m).x,y-xy(m).y)>(m.range??30)+30||distance(c,m)<Math.hypot(x-xy(m).x,y-xy(m).y));}
 function waypoint(target,retreat=false){const c=bot.p.c,a=xy(c),b=xy(target),plan=bot.teamPlan?.heartbeat(),anchor=plan&&samePlace(c,plan)?plan:a,reach=Math.max(35,Math.min(90,(c.speed??40)*1.5)),base=Math.atan2(a.y-b.y,a.x-b.x)+(retreat?0:Math.PI);let best=null;
  for(let n=0;n<16;n++){const angle=base+n*Math.PI/8,x=a.x+Math.cos(angle)*reach,y=a.y+Math.sin(angle)*reach;if(!safe(x,y))continue;const point={map:c.map,in:c.in??c.map,x,y,radius:6},threat=bot.monsters().filter(m=>m.target===c.name&&isNaturallyAggressive(bot.p.G,m)).reduce((v,m)=>v+1/Math.max(1,distance(point,m)),0),anchorDistance=distance(point,anchor),goalDistance=distance(point,target),score=(retreat?-threat*1000:-goalDistance)-Math.max(0,anchorDistance-(bot.cfg.farming.orbitRadius??220))*2;
   if(!best||score>best.score)best={...point,score};
  }return best;
 }
 // Adapted from Bot v3 BasicKitingPolicy and alpha20.12/alpha24 orbital
 // range positioning: maintain a firing band before contact, without requiring
 // an incoming hit, and keep the normal attack cycle independent of movement.
 function rangePosition(t){
  const c=bot.p.c;
  if(!bot.cfg.farming.kiting||!['ranger','mage','priest'].includes(c.ctype)||
     !t||t.dead||t.hp<=0||!samePlace(c,t)||!Number.isFinite(c.range)||c.range<80||
     t.target&&t.target!==c.name)return false;
  const now=Date.now(),cooldown=650;
  if(now-lastRangeMove<cooldown||bot.movement.order&&!['kite','combat'].includes(bot.movement.order.owner))return false;
  if(bot.movement.order?.owner==='kite')return false;
  const d=distance(c,t),enemy=bot.p.G.monsters?.[t.mtype]??{};
  const monsterRange=Number.isFinite(t.range)?t.range:Number.isFinite(enemy.range)?enemy.range:25;
  const desired=Math.min(c.range*.92,c.range-8);
  if(desired<=monsterRange+8||d>=Math.min(desired-4,Math.max(c.range*.84,monsterRange+20)))return false;
  const a=xy(c),b=xy(t);
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(b.x)||!Number.isFinite(b.y)||d<.001)return false;
  const step=Math.min(Math.max(0,desired-d),Math.max(20,Math.min(c.range*.4,Math.max(1,c.speed??40)*1.25)));
  if(step<3)return false;
  const heading=Math.atan2(a.y-b.y,a.x-b.x);
  // v3 terrain offsets; accept only a point that actually increases range
  // and does not enter another autonomous aggressor's close envelope.
  for(const offset of [0,18,-18,36,-36,54,-54,72,-72,90,-90]){
   const angle=heading+offset*Math.PI/180,x=a.x+Math.cos(angle)*step,y=a.y+Math.sin(angle)*step;
   if(Math.hypot(x-b.x,y-b.y)<d+3||!safe(x,y))continue;
   if(bot.movement.order?.owner==='combat')bot.movement.stop();
   bot.movement.local(x,y,'kite');
   if(bot.movement.order?.owner==='kite'){
    lastRangeMove=now;
    bot.event?.('combat.rangePosition',{target:t.id,range:Math.round(c.range),distance:Math.round(d),desired:Math.round(desired),step:Math.round(step),offset});
    return true;
   }
  }
  bot.event?.('combat.rangeBlocked',{target:t.id,reason:'Kein erreichbarer seitlicher Schritt; Angriff bleibt aktiv'});
  return false;
 }
 return {waypoint,rangePosition,permitted(m){for(const [id,t] of blocked)if(t<Date.now())blocked.delete(id);return !blocked.has(m.id);},blocked(m){if(blocked.size>64)blocked.clear();blocked.set(m.id,Date.now()+15000);bot.event('navigation.targetBlocked',{target:m.id,reason:'Kein freier lokaler Umweg'});},orbit(t){if(!bot.cfg.farming.orbit||!t||t.target!==bot.me.name||!isNaturallyAggressive(bot.p.G,t))return false;const point=waypoint(t,true);if(!point)return false;if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(point.x,point.y,'kite');return true;},status:()=>({blocked:blocked.size})};
}
