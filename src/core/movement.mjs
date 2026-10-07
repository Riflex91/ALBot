import {arrived,samePlace,distance,xy} from './policy.mjs';
export function createMovement(bot){
  const {p,exec}=bot;let order=null,blockedUntil=0;
  const stop=()=>{if(order||p.root.smart?.moving||p.c?.moving){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}order=null;exec.cancelResource('movement');};
  function go(d,owner){
    if(!bot.running||Date.now()<blockedUntil||!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
    if(bot.cfg?.world?.excludedMaps.includes(d.map)||p.G.maps[d.map]?.pvp&&!bot.cfg?.farming?.pvp)return false;
    if(arrived(p.c,{...d,radius:d.radius??20}))return true;
    if(order)return false;
    if(p.c.stand){exec.run('stand.close',['stand'],()=>bot.running&&!!p.c.stand,()=>p.call('close_stand'),{delay:1000});return false;}
    const dest={...d,radius:d.radius??20};
    // Smart movement can enter public maps; never attempt somebody else's instance.
    if(!samePlace(p.c,d)&&p.G.maps[d.map]?.instance){bot.reason='Zielinstanz nicht erreichbar';return false;}
    const started=Date.now();order={dest,owner,started,progress:started,last:xy(p.c),map:p.c.map};const token=order;
    const local=samePlace(p.c,d)&&p.has('can_move_to')&&p.call('can_move_to',d.x,d.y);
    token.mode=local?'move':'smart_move';
    const accepted=exec.run('move',['movement'],()=>bot.running&&!p.c.rip,()=>p.call(token.mode,...(local?[d.x,d.y]:[{map:d.map,x:d.x,y:d.y}])),{timeout:120000,delay:500,onSettle(state,error){if(order!==token)return;if(state==='rejected'||state==='timeout'){stop();blockedUntil=Date.now()+3000;bot.reason='Weg fehlgeschlagen; neuer Versuch in 3 Sekunden';bot.event?.('movement.failed',{owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,reason:error?.reason??error?.message??state});}}});
    if(accepted)bot.event?.('movement.request',{owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,radius:dest.radius});
    if(!accepted)order=null;return false;
  }
  function poll(){if(!order)return;const now=Date.now();if(samePlace(p.c,order.dest)&&distance(p.c,order.dest)<=order.dest.radius){bot.event?.('movement.arrived',{owner:order.owner,map:p.c.map,x:xy(p.c).x,y:xy(p.c).y});stop();return;}if(p.c.map!==order.map||distance(p.c,order.last)>3){order.progress=now;order.last=xy(p.c);order.map=p.c.map;}
    const searching=order.mode==='smart_move'&&p.root.smart?.moving&&p.root.smart?.searching&&!p.root.smart?.found;
    if(!searching&&now-order.progress>12000){const failed=order;stop();blockedUntil=now+3000;bot.reason='Weg ohne Fortschritt; neuer Versuch in 3 Sekunden';bot.event?.('movement.failed',{owner:failed.owner,mode:failed.mode,map:failed.dest.map,x:failed.dest.x,y:failed.dest.y,reason:'no_progress'});}
  }
  return {go,poll,stop,get order(){return order;},status:()=>order?{owner:order.owner,mode:order.mode,destination:{...order.dest},started:order.started}:null,
    local(x,y,owner){if(order&&order.owner!==owner)return false;if(!p.call('can_move_to',x,y))return false;return go({map:p.c.map,in:p.c.in??p.c.map,x,y,radius:8},owner);},
    farmLocation(type){const candidates=[];for(const [map,data] of Object.entries(p.G.maps)){if(data.ignore||data.instance||data.pvp)continue;for(const pack of data.monsters??[]){if(pack.type!==type)continue;const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[]);for(const [m,x1,y1,x2,y2] of ranges)candidates.push({map:m,in:m,x:(x1+x2)/2,y:(y1+y2)/2,radius:45});}}return candidates.sort((a,b)=>(a.map===p.c.map?-100000:0)+distance(p.c,a)-((b.map===p.c.map?-100000:0)+distance(p.c,b)))[0];}
  };
}
