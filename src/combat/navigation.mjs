import {distance,xy,samePlace} from '../core/policy.mjs';
export function createCombatNavigation(bot){
 const blocked=new Map();
 function safe(x,y){if(!bot.p.call('can_move_to',x,y))return false;const c=bot.p.c;return bot.monsters().every(m=>!m.target&&!bot.p.G.monsters[m.mtype]?.aggro||m.target&&bot.teamNames.includes(m.target)||Math.hypot(x-xy(m).x,y-xy(m).y)>(m.range??30)+30||distance(c,m)<Math.hypot(x-xy(m).x,y-xy(m).y));}
 function waypoint(target,retreat=false){const c=bot.p.c,a=xy(c),b=xy(target),plan=bot.teamPlan?.heartbeat(),anchor=plan&&samePlace(c,plan)?plan:a,reach=Math.max(35,Math.min(90,(c.speed??40)*1.5)),base=Math.atan2(a.y-b.y,a.x-b.x)+(retreat?0:Math.PI);let best=null;
  for(let n=0;n<16;n++){const angle=base+n*Math.PI/8,x=a.x+Math.cos(angle)*reach,y=a.y+Math.sin(angle)*reach;if(!safe(x,y))continue;const point={map:c.map,in:c.in??c.map,x,y,radius:6},threat=bot.monsters().filter(m=>m.target===c.name).reduce((v,m)=>v+1/Math.max(1,distance(point,m)),0),anchorDistance=distance(point,anchor),goalDistance=distance(point,target),score=(retreat?-threat*1000:-goalDistance)-Math.max(0,anchorDistance-(bot.cfg.farming.orbitRadius??220))*2;
   if(!best||score>best.score)best={...point,score};
  }return best;
 }
 return {waypoint,permitted(m){for(const [id,t] of blocked)if(t<Date.now())blocked.delete(id);return !blocked.has(m.id);},blocked(m){if(blocked.size>64)blocked.clear();blocked.set(m.id,Date.now()+15000);bot.event('navigation.targetBlocked',{target:m.id,reason:'Kein freier lokaler Umweg'});},orbit(t){if(!bot.cfg.farming.orbit||!t||t.target!==bot.me.name)return false;const point=waypoint(t,true);if(!point)return false;if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(point.x,point.y,'kite');return true;},status:()=>({blocked:blocked.size})};
}
