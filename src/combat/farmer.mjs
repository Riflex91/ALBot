import {distance,xy,samePlace,protectedItem,fingerprint} from '../core/policy.mjs';
export function createFarmer(bot){
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastLoot=0,lastTravel=0;
  const actionReason=x=>String(x?.reason??x?.message??x?.error??'');
  async function tolerate(key,expected,invoke,onTransient=()=>{}){try{const value=await invoke();if(actionReason(value)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}return value;}catch(e){if(actionReason(e)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}throw e;}}
  function recover(){
    const c=p.c,now=Date.now();
    if(c.rip){
      bot.target=null;bot.movement.stop();if(!deadSince){deadSince=now;deaths=deaths.filter(t=>now-t<cfg.farming.deathWindowMs);deaths.push(now);}
      bot.reason='Tot';if(deaths.length>=cfg.farming.maxDeaths){bot.pause('Todesgrenze erreicht');return true;}
      if(cfg.farming.respawn&&now-deadSince>=cfg.farming.respawnDelayMs)exec.run('respawn',['lifecycle'],()=>p.c.rip,()=>p.call('respawn'),{delay:15000});return true;
    }
    deadSince=0;
    const resource=c.hp/c.max_hp<cfg.farming.hpBelow?'hp':c.mp/c.max_mp<cfg.farming.mpBelow?'mp':null;
    if(resource&&!p.call('is_on_cooldown','use_hp')){
      let slot=-1;
      if(cfg.farming.potions&&!bot.inventoryBlocked&&!bot.logistics.reserved)slot=c.items.findIndex(i=>i&&!protectedItem(i)&&p.G.items[i.name]?.type==='pot'&&(p.G.items[i.name]?.gives??[]).some(g=>g[0]===resource)&&bot.consumable(i));
      if(slot>=0){
        const item=c.items[slot],fp=fingerprint(item),before=bot.count(item.name);
        exec.run('potion',['potion','inventory'],()=>!bot.inventoryBlocked&&!bot.logistics.reserved&&fingerprint(c.items[slot])===fp&&bot.consumable(c.items[slot])&&!p.call('is_on_cooldown','use_hp'),()=>{bot.beginValue({kind:'consume',item:item.name,before});return p.call('equip',slot);},{delay:2000,value:true,observe:()=>bot.count(item.name)<before,onSettle:s=>bot.endValue(s)});
      }else exec.run('regen',['potion'],()=>!p.call('is_on_cooldown','use_hp'),()=>p.call('use_skill','regen_'+resource),{delay:4000});
    }
    if(c.hp/c.max_hp<cfg.farming.restBelow)rest=true;
    if(rest&&c.hp/c.max_hp>=cfg.farming.resumeAbove)rest=false;
    if(rest){bot.reason='Erholung';bot.target=null;const threats=bot.monsters().filter(e=>e.target===c.name).sort((a,b)=>distance(c,a)-distance(c,b));if(threats[0])retreat(threats[0]);else bot.movement.stop();bot.skills.rotation(null);return true;}
    return false;
  }
  function retreat(t){const c=p.c,d=distance(c,t)||1,from=xy(c),toward=xy(t),dx=(from.x-toward.x)/d,dy=(from.y-toward.y)/d;for(const [x,y] of [[dx,dy],[-dy,dx],[dy,-dx]]){const nx=from.x+x*45,ny=from.y+y*45;if(p.call('can_move_to',nx,ny)){if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(nx,ny,'kite');return;}}bot.reason='Kein freier Rückzugsweg';}
  function tick(){
    if(recover())return;
    const c=p.c,now=Date.now();
    if(cfg.farming.loot&&!bot.inventoryBlocked&&!bot.logistics.reserved&&bot.free()>cfg.farming.freeSlots&&now-lastLoot>=cfg.farming.lootEveryMs){lastLoot=now;exec.run('loot',['inventory'],()=>bot.free()>cfg.farming.freeSlots,()=>tolerate('loot','openning',()=>p.call('loot')),{delay:cfg.farming.lootEveryMs});}
    if(me.role==='merchant'){bot.reason=bot.inventoryBlocked?'Inventar ungeklärt':'Merchant bereit';return;}
    if(!cfg.farming.enabled){bot.reason='Farmen ausgeschaltet';bot.skills.rotation(null);return;}
    if(p.parent.is_pvp||p.G.maps[c.map]?.pvp){bot.pause('Live A farmt nicht auf PvP-Karten');return;}
    if(bot.free()<cfg.farming.freeSlots){bot.reason='Inventarreserve erreicht';bot.target=null;bot.skills.rotation(null);return;}
    const leader=bot.transport.fresh(bot.leader);
    if(cfg.party.enabled&&bot.leader!==me.name){
      if(!leader?.running||leader.realm!==p.realm()||leader.rip){bot.reason='Warte auf Kampf-Leader';bot.target=null;bot.skills.rotation(null);return;}
      if(!samePlace(c,leader)||distance(c,leader)>cfg.party.followDistance){bot.target=null;bot.reason='Folge '+bot.leader;bot.movement.go({...leader,radius:cfg.party.followDistance/2},'follow');bot.skills.rotation(null);return;}
    }
    if(cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||!samePlace(c,bot.transport.fresh(n))||bot.transport.fresh(n)?.realm!==p.realm()||distance(c,bot.transport.fresh(n))>cfg.party.followDistance*2))){bot.reason='Warte auf Gruppe';bot.target=null;bot.skills.rotation(null);return;}
    const mobs=bot.monsters().filter(bot.allowed);
    const focus=cfg.party.enabled&&cfg.party.focusFire&&leader?.target?mobs.find(e=>e.id===leader.target):null;
    const previous=bot.target&&mobs.find(e=>e.id===bot.target.id);
    bot.target=focus??previous??mobs.sort((a,b)=>(a.target===c.name?-10000:0)+distance(c,a)-((b.target===c.name?-10000:0)+distance(c,b)))[0]??null;
    const target=bot.target;
    bot.skills.rotation(target);
    if(!target){bot.reason='Suche Farmziel';if(cfg.farming.autoTravel&&now-lastTravel>=10000&&!bot.movement.order){lastTravel=now;const d=bot.movement.farmLocation(bot.targets()[0]);if(d)bot.movement.go(d,'farm');else bot.reason='Kein öffentlicher Spawn für Farmziel';}return;}
    bot.reason='Kampf: '+target.mtype;
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    const range=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer,c.range*.25)),d=distance(c,target);
    if(cfg.farming.kiting&&target.target===c.name&&c.range>(target.range??20)+25&&d<Math.min(range,(target.range??20)+35))retreat(target);
    else if(d>range&&!bot.movement.order){const a=xy(c),b=xy(target),step=Math.min(60,d-range+3);bot.movement.go({map:c.map,in:c.in??c.map,x:a.x+(b.x-a.x)*step/d,y:a.y+(b.y-a.y)*step/d,radius:6},'combat');}
    if(c.target!==target.id)exec.run('target',['target'],()=>bot.allowed(target),()=>p.call('change_target',target),{delay:500});
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},()=>tolerate('attack','not_there',()=>p.call('attack',bot.entity(target.id)),()=>{bot.target=null;}),{delay:100});
  }
  return {tick};
}
