import {distance,xy,samePlace,protectedItem,fingerprint} from '../core/policy.mjs';
export function combatApproach(character,target,range,canMove){const a=xy(character),b=xy(target),d=distance(character,target),step=Math.min(60,Math.max(0,d-range+3)),x=a.x+(b.x-a.x)*step/(d||1),y=a.y+(b.y-a.y)*step/(d||1);
 return canMove(x,y)?{map:character.map,in:character.in??character.map,x,y,radius:6}:{map:target.map??character.map,in:target.in??character.in??character.map,...b,radius:range};
}
export function createFarmer(bot){
  const {p,cfg,exec,me}=bot;let deadSince=0,deaths=[],rest=false,lastLoot=0,lastTravel=0;
  const actionReason=x=>String(x?.reason??x?.message??x?.error??'');
  async function tolerate(key,expected,invoke,onTransient=()=>{}){try{const value=await invoke();if(actionReason(value)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}return value;}catch(e){if(actionReason(e)===expected){onTransient();bot.event?.('action.transient',{key,reason:expected});return {success:true,transient:expected};}throw e;}}
  function recover(){
    const c=p.c,now=Date.now();
    if(c.rip){
      const fallenTarget=bot.target?.mtype;bot.target=null;bot.movement.stop();if(!deadSince){deadSince=now;bot.strategy?.failActivity?.('Tod während des Kampf-/Reiseziels',fallenTarget);deaths=deaths.filter(t=>now-t<cfg.farming.deathWindowMs);deaths.push(now);}
      bot.reason='Tot';if(deaths.length>=cfg.farming.maxDeaths){bot.pause('Todesgrenze erreicht');return true;}
      if(cfg.farming.respawn&&now-deadSince>=cfg.farming.respawnDelayMs)exec.run('respawn',['lifecycle'],()=>p.c.rip,()=>p.call('respawn'),{delay:15000});return true;
    }
    deadSince=0;
    const preparing=me.role==='farmer'&&!bot.monsters().some(m=>m.target===c.name)&&bot.encounter?.status().phase==='RECOVER';const resource=c.hp/c.max_hp<(preparing?(cfg.farming.pullHp??cfg.farming.hpBelow):cfg.farming.hpBelow)?'hp':c.mp/c.max_mp<(preparing?(cfg.farming.pullMp??cfg.farming.mpBelow):cfg.farming.mpBelow)?'mp':null;
    if(resource&&!p.call('is_on_cooldown','use_hp')){
      let slot=-1;
      if(cfg.farming.potions&&!bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics.reserved)slot=c.items.map((i,slot)=>({i,slot,restore:p.G.items[i?.name]?.gives?.find(g=>g[0]===resource)?.[1]??0})).filter(r=>r.i&&!protectedItem(r.i)&&p.G.items[r.i.name]?.type==='pot'&&r.restore>0&&bot.consumable(r.i)&&(cfg.farming.potionUtilization===undefined||c.hp/c.max_hp<cfg.farming.restBelow||(c['max_'+resource]-c[resource])/r.restore>=(cfg.farming.potionUtilization??.65))).sort((a,b)=>Math.abs(a.restore-(c['max_'+resource]-c[resource]))-Math.abs(b.restore-(c['max_'+resource]-c[resource])))[0]?.slot??-1;
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
  function retreat(t){if(bot.navigation?.orbit(t))return;const c=p.c,from=xy(c),threats=bot.monsters().filter(m=>m.target===c.name);if(!threats.length)threats.push(t);let ax=0,ay=0;for(const enemy of threats.slice(0,8)){const d=distance(c,enemy)||1,v=xy(enemy),weight=1/Math.max(20,d);ax+=(from.x-v.x)/d*weight;ay+=(from.y-v.y)/d*weight;}const len=Math.hypot(ax,ay)||1,dx=ax/len,dy=ay/len,step=Math.max(35,Math.min(90,(c.speed??40)*1.5));for(const [x,y] of [[dx,dy],[-dy,dx],[dy,-dx]]){const nx=from.x+x*step,ny=from.y+y*step;if(p.call('can_move_to',nx,ny)){if(bot.movement.order?.owner!=='kite')bot.movement.stop();bot.movement.local(nx,ny,'kite');return;}}bot.reason='Kein freier Rückzugsweg';}
  function waitSafely(reason){bot.reason=reason;bot.target=null;const threat=bot.monsters().find(m=>m.target===p.c.name);if(threat){bot.recovering=true;bot.strategy?.failActivity?.('Gruppe nicht kampfbereit unter Beschuss',threat.mtype);retreat(threat);}else if(['combat','farm','follow','kite','world'].includes(bot.movement.order?.owner))bot.movement.stop();bot.skills.rotation(null);}
  function tick(){
    bot.recovering=false;
    if(bot.gold?.reserved||bot.journal?.kind?.startsWith("gold.")){bot.reason="Goldübergabe bestätigen";bot.movement.stop();return;}
    if(recover()){bot.recovering=true;return;}
    const c=p.c,now=Date.now();
    const threat=bot.monsters().filter(m=>m.target===c.name).sort((a,b)=>distance(c,a)-distance(c,b))[0];
    if(threat&&(me.role==='merchant'||bot.strategy?.safeTarget?.(threat.mtype,threat)===false)){bot.recovering=true;bot.strategy?.interruptQuest?.();bot.strategy?.failActivity?.('Gefährlicher Gegner greift an',threat.mtype);bot.target=null;bot.reason='Rückzug: '+threat.mtype;retreat(threat);bot.skills.rotation(null);return;}
    if(me.role==='merchant'){if(bot.inventoryBlocked)bot.reason='Inventar ungeklärt';return;}
    if(bot.account&&!bot.account.active()){bot.reason='Bereitschaft: andere Farmer gewählt';bot.target=null;return;}
    if(bot.strategy?.busy&&bot.monsters().some(m=>m.target===c.name))bot.strategy.interruptQuest?.();
    if(bot.strategy?.busy||bot.movement.order?.owner==='economy'){bot.skills.rotation(null);return;}
    if(cfg.farming.loot&&!bot.inventoryBlocked&&!bot.logistics.reserved&&bot.free()>cfg.farming.freeSlots&&now-lastLoot>=cfg.farming.lootEveryMs){lastLoot=now;exec.run('loot',['inventory'],()=>bot.free()>cfg.farming.freeSlots,()=>tolerate('loot','openning',()=>p.call('loot')),{delay:cfg.farming.lootEveryMs});}
    if(!cfg.farming.enabled){bot.reason='Farmen ausgeschaltet';bot.skills.rotation(null);return;}
    if((p.parent.is_pvp||p.G.maps[c.map]?.pvp)&&!cfg.farming.pvp){bot.pause('PvP-Karte nicht freigegeben');return;}
    if(bot.free()<cfg.farming.freeSlots){bot.reason='Inventarreserve erreicht';bot.target=null;bot.skills.rotation(null);return;}
    if(bot.strategy?.travel()){bot.skills.rotation(null);return;}
    const leader=bot.transport.fresh(bot.leader);
    if(cfg.party.enabled&&bot.leader!==me.name){
      if(!leader?.running||leader.realm!==p.realm()||leader.rip){waitSafely('Warte auf Kampf-Leader');return;}
      if(!samePlace(c,leader)||distance(c,leader)>cfg.party.followDistance){bot.target=null;bot.reason='Folge '+bot.leader;if(['combat','farm','kite'].includes(bot.movement.order?.owner))bot.movement.stop();bot.movement.go({...leader,radius:cfg.party.followDistance/2},'follow');bot.skills.rotation(null);return;}
      if(leader.questVisit===true){waitSafely('Begleite Monsterhunt-Reise des Leaders');return;}
    }
    if(cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||!samePlace(c,bot.transport.fresh(n))||bot.transport.fresh(n)?.realm!==p.realm()||distance(c,bot.transport.fresh(n))>cfg.party.followDistance*2))){waitSafely('Warte auf Gruppe');return;}
    bot.encounter?.pull();const mobs=bot.monsters().filter(bot.allowed);
    const focus=cfg.party.enabled&&cfg.party.focusFire&&leader?.target&&(!bot.teamPlan||leader.farmPlan?.id===bot.teamPlan.heartbeat()?.id||leader.activity)?mobs.find(e=>e.id===leader.target):null;
    const previous=bot.target&&mobs.find(e=>e.id===bot.target.id);
    bot.target=focus??previous??mobs.sort((a,b)=>(a.target===c.name?-10000:0)+distance(c,a)-((b.target===c.name?-10000:0)+distance(c,b)))[0]??null;
    const target=bot.target;
    bot.skills.rotation(target);
    if(!target){bot.reason='Suche Farmziel';if(cfg.farming.autoTravel&&now-lastTravel>=10000&&!bot.movement.order){lastTravel=now;const d=bot.movement.farmLocation(bot.targets()[0]);if(d)bot.movement.go(d,'farm');else bot.reason='Kein öffentlicher Spawn für Farmziel';}return;}
    bot.reason='Kampf: '+target.mtype;
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    const range=Math.max(5,c.range-Math.min(cfg.farming.rangeBuffer,c.range*.25)),d=distance(c,target);
    if(cfg.farming.kiting&&target.target===c.name&&c.range>(target.range??20)+25&&d<Math.min(range,(target.range??20)+35))retreat(target);
    else if(d>range){bot.reason='Unterwegs zu '+target.mtype;if(!bot.movement.order){const reachable=p.call('can_move_to',xy(target).x,xy(target).y),detour=!reachable&&bot.navigation?.waypoint(target);if(!reachable&&bot.navigation&&!detour){bot.navigation.blocked(target);bot.target=null;return;}bot.movement.go(detour||combatApproach(c,target,range,(x,y)=>p.call('can_move_to',x,y)),'combat');}}
    if(c.target!==target.id)exec.run('target',['target'],()=>bot.allowed(target),()=>p.call('change_target',target),{delay:500});
    exec.run('attack',['attack','mana'],()=>{const t=bot.entity(target.id);return t&&bot.allowed(t)&&p.call('can_attack',t)&&!p.call('is_on_cooldown','attack');},()=>tolerate('attack','not_there',()=>p.call('attack',bot.entity(target.id)),()=>{bot.target=null;}),{delay:100});
  }
  return {tick,retreat,safety(){bot.recovering=false;if(recover()){bot.recovering=true;return true;}const threat=bot.monsters().find(m=>m.target===p.c.name);if(threat&&(me.role==='merchant'||bot.strategy?.safeTarget?.(threat.mtype,threat)===false)){bot.recovering=true;bot.strategy?.interruptQuest?.();bot.strategy?.failActivity?.('Gefährliche Aggro',threat.mtype);bot.target=null;retreat(threat);bot.skills.rotation(null);return true;}return false;}};
}
