import {arrived,samePlace,distance,xy} from './policy.mjs';
export function createMovement(bot){
  const {p,exec}=bot;let order=null,blockedUntil=0,townMs=5000,lastTown=0,townQueued=false;
  const stop=()=>{if(townQueued||p.c?.c?.town){try{Promise.resolve(p.call('stop','town')).catch(()=>{});}catch{}}townQueued=false;if(order||p.root.smart?.moving||p.c?.moving){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}order=null;exec.cancelResource('movement');};
  function go(d,owner){
    if(!bot.running||Date.now()<blockedUntil||!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
    if(bot.cfg?.world?.excludedMaps.includes(d.map)||p.G.maps[d.map]?.pvp&&!bot.cfg?.farming?.pvp)return false;
    if(arrived(p.c,{...d,radius:d.radius??20}))return true;
    if(order||townQueued||exec.pending.has('travel.town'))return false;
    if(p.c.stand){exec.run('stand.close',['stand'],()=>bot.running&&!!p.c.stand,()=>p.call('close_stand'),{delay:1000});return false;}
    const dest={...d,radius:d.radius??20};
    // Smart movement can enter public maps; never attempt somebody else's instance.
    if(!samePlace(p.c,d)&&p.G.maps[d.map]?.instance){bot.reason='Zielinstanz nicht erreichbar';return false;}
    const spawn=p.G.maps[p.c.map]?.spawns?.[0];if(bot.me?.role==='merchant'&&bot.cfg.merchant.townTravel!==false&&samePlace(p.c,d)&&Array.isArray(spawn)&&p.has('town')&&!p.c.c?.town&&Date.now()-lastTown>30000&&!bot.monsters().some(m=>m.target===p.c.name)){const speed=Math.max(1,p.c.speed??40),walk=distance(p.c,d)/speed*1000,town=townMs+Math.hypot(spawn[0]-d.x,spawn[1]-d.y)/speed*1000;bot.event?.('travel.compare',{owner,walkMs:Math.round(walk),townMs:Math.round(town),savedMs:Math.round(walk-town),threshold:bot.cfg.merchant.townMinSavingsMs??3000,reason:'Town-Kanal plus Restweg gegen direkten Laufweg'});if(walk-town>(bot.cfg.merchant.townMinSavingsMs??3000)){let at=0;townQueued=true;const accepted=exec.run('travel.town',['movement'],()=>bot.running&&!bot.monsters().some(m=>m.target===p.c.name),()=>{lastTown=Date.now();at=lastTown;if(p.c.moving||p.root.smart?.moving)p.call('stop','move');bot.event?.('travel.town',{owner,map:p.c.map,reason:'Town spart Reisezeit; laufenden Weg vor Kanal beenden'});return p.call('town');},{priority:['logistics','gold'].includes(owner)?850:400,timeout:15000,delay:30000,waitForObservation:true,observe:()=>samePlace(p.c,d)&&!p.c.c?.town&&Math.hypot(xy(p.c).x-spawn[0],xy(p.c).y-spawn[1])<60,onSettle(result){townQueued=false;if(result==='confirmed')townMs=(townMs+Date.now()-at)/2;}});if(!accepted)townQueued=false;return false;}}
    const started=Date.now();order={dest,owner,started,progress:started,last:xy(p.c),map:p.c.map,origin:p.c.map};const token=order;
    const local=samePlace(p.c,d)&&p.has('can_move_to')&&p.call('can_move_to',d.x,d.y);
    token.mode=local?'move':'smart_move';
    const accepted=exec.run('move',['movement'],()=>bot.running&&!p.c.rip,()=>p.call(token.mode,...(local?[d.x,d.y]:[{map:d.map,x:d.x,y:d.y}])),{priority:owner==='kite'?1100:['logistics','gold'].includes(owner)?850:400,timeout:120000,delay:500,onSettle(state,error){if(order!==token)return;if(state==='rejected'||state==='timeout'||state==='superseded'){stop();blockedUntil=Date.now()+3000;bot.reason='Weg fehlgeschlagen; neuer Versuch in 3 Sekunden';bot.event?.('movement.failed',{owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,reason:error?.reason??error?.message??state});}}});
    if(accepted)bot.event?.('movement.request',{owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,radius:dest.radius});
    if(!accepted)order=null;return false;
  }
  function poll(){if(!order)return;const now=Date.now();if(samePlace(p.c,order.dest)&&distance(p.c,order.dest)<=order.dest.radius){bot.observations?.travel(order.origin,p.c.map,now-order.started);bot.event?.('movement.arrived',{owner:order.owner,map:p.c.map,x:xy(p.c).x,y:xy(p.c).y});stop();return;}if(p.c.map!==order.map||distance(p.c,order.last)>3){order.progress=now;order.last=xy(p.c);order.map=p.c.map;}
    if(now-order.progress>12000||now-order.started>120000){stop();blockedUntil=now+10000;bot.reason='Weg ohne Fortschritt; neuer Versuch in 10 Sekunden';}
  }
  return {go,poll,stop,get order(){return order;},status:()=>order?{owner:order.owner,mode:order.mode,destination:{...order.dest},started:order.started}:null,
    local(x,y,owner){if(order&&order.owner!==owner)return false;if(!p.call('can_move_to',x,y))return false;return go({map:p.c.map,in:p.c.in??p.c.map,x,y,radius:8},owner);},
    farmLocation(type){const candidates=[];for(const [map,data] of Object.entries(p.G.maps)){if(data.ignore||data.instance||data.pvp)continue;for(const pack of data.monsters??[]){if(pack.type!==type)continue;const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[]);for(const [m,x1,y1,x2,y2] of ranges)candidates.push({map:m,in:m,x:(x1+x2)/2,y:(y1+y2)/2,radius:45});}}return candidates.sort((a,b)=>(a.map===p.c.map?-100000:0)+distance(p.c,a)-((b.map===p.c.map?-100000:0)+distance(p.c,b)))[0];}
  };
}
