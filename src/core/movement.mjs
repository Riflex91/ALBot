import {arrived,samePlace,distance,xy} from './policy.mjs';
export function createMovement(bot){
  const {p,exec}=bot;let order=null,blockedUntil=0;
  const stop=()=>{if(order||p.root.smart?.moving||p.c?.moving){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}order=null;exec.cancelResource('movement');};
  function go(d,owner){
    if(!bot.running||Date.now()<blockedUntil||!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
    if(arrived(p.c,{...d,radius:d.radius??20}))return true;
    if(order)return false;
    const dest={...d,radius:d.radius??20};
    // Smart movement can enter public maps; never attempt somebody else's instance.
    if(!samePlace(p.c,d)&&p.G.maps[d.map]?.instance){bot.reason='Zielinstanz nicht erreichbar';return false;}
    const started=Date.now();order={dest,owner,started,progress:started,last:xy(p.c),map:p.c.map};
    const local=samePlace(p.c,d)&&p.has('can_move_to')&&p.call('can_move_to',d.x,d.y);
    const accepted=exec.run('move',['movement'],()=>bot.running&&!p.c.rip,()=>p.call(local?'move':'smart_move',...(local?[d.x,d.y]:[{map:d.map,x:d.x,y:d.y}])),{timeout:120000,delay:500});
    if(!accepted)order=null;return false;
  }
  function poll(){if(!order)return;const now=Date.now();if(arrived(p.c,order.dest)){order=null;return;}if(p.c.map!==order.map||distance(p.c,order.last)>3){order.progress=now;order.last=xy(p.c);order.map=p.c.map;}
    if(now-order.progress>12000||now-order.started>120000){stop();blockedUntil=now+10000;bot.reason='Weg ohne Fortschritt; neuer Versuch in 10 Sekunden';}
  }
  return {go,poll,stop,get order(){return order;},
    local(x,y,owner){if(order&&order.owner!==owner)return false;if(!p.call('can_move_to',x,y))return false;return go({map:p.c.map,in:p.c.in??p.c.map,x,y,radius:8},owner);},
    farmLocation(type){const candidates=[];for(const [map,data] of Object.entries(p.G.maps)){if(data.ignore||data.instance||data.pvp)continue;for(const pack of data.monsters??[]){if(pack.type!==type)continue;const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[]);for(const [m,x1,y1,x2,y2] of ranges)candidates.push({map:m,in:m,x:(x1+x2)/2,y:(y1+y2)/2,radius:45});}}return candidates.sort((a,b)=>(a.map===p.c.map?-100000:0)+distance(p.c,a)-((b.map===p.c.map?-100000:0)+distance(p.c,b)))[0];}
  };
}
