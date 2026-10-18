import {runtimeConditionGate} from '../core/action-admission.mjs';
import {validMessage,xy,samePlace,distance} from '../core/policy.mjs';
import {ownSupplyCharacters} from '../items/potion-supply.mjs';
import {carriedAchievementCarrier} from '../items/achievement-utility.mjs';
import {inventoryStockEvidence,packInventoryEvidence,unpackInventoryEvidence} from '../items/stock-evidence.mjs';
import {inspectItemTransferEvidence} from '../items/transfer-reconciliation.mjs';
// The full ranking contains bulky diagnostics. Recipients only need the
// authoritative fields required to validate/adopt the shared spawn plan.
export function compactFarmPlan(plan){
 if(!plan?.id)return null;
 const fields=['id','key','target','map','in','x','y','realm','leader',
  'kind','objective','item','started','expires','definition','bounds',
  'radius','reason'];
 return Object.fromEntries(fields.filter(key=>plan[key]!==undefined)
  .map(key=>[key,plan[key]]));
}
// A march contract is independent of the optional, often size-trimmed
// farmPlan. Advertise only the leader's verified endpoint and whether our
// CURRENT navigation order actually heads there, never just a moving flag.
export function sharedMarchStatus(plan,order,realm){
 if(!plan?.id||plan.realm!==realm||typeof plan.map!=='string'||
    !Number.isFinite(plan.x)||!Number.isFinite(plan.y))return null;
 const dest=order?.dest;
 const moving=!!dest&&['farm','follow'].includes(order.owner)&&
   samePlace(dest,plan)&&Number.isFinite(dest.x)&&
   Number.isFinite(dest.y)&&distance(dest,plan)<=100;
 return {plan:plan.id,realm,map:plan.map,in:plan.in??plan.map,
  x:plan.x,y:plan.y,target:plan.target??null,moving};
}
// Kept even when large status heartbeats drop optional skill telemetry.
// Only currently verified heal readiness and real server item restoration
// amounts may contribute to a defensive fight estimate.
export function compactCombatSupport(c,G,capabilities,potionReady=false){
 const heal=G?.skills?.heal,allowed=!!heal&&c?.ctype==='priest'&&
  (!heal.class||Array.isArray(heal.class)&&heal.class.includes(c.ctype))&&
  Number.isFinite(c.level)&&c.level>=(heal.level??0);
 const potion=(id,type)=>{
  const count=(c?.items??[]).reduce((sum,item)=>sum+
   (item?.name===id&&!item.l&&!item.b?
    (Number.isSafeInteger(item.q)&&item.q>0?item.q:1):0),0);
  const restore=G?.items?.[id]?.gives?.find?.(row=>
   Array.isArray(row)&&row[0]===type)?.[1];
  return {count:Math.min(count,99999),
   restore:Number.isFinite(restore)&&restore>0&&restore<=100000?
    restore:0};
 };
 return {healReady:!!(allowed&&capabilities?.ready?.includes('heal')&&
    runtimeConditionGate(c,G,'skill:heal',['mana','attack']).allowed),
   healRange:allowed&&Number.isFinite(heal.range)&&heal.range>0?
    heal.range:c?.range??0,
   healMpCost:allowed&&Number.isFinite(heal.mp)&&heal.mp>=0?
    heal.mp:c?.mp_cost??0,
   potionReady:potionReady===true,
   hpPotion:potion('hpot0','hp'),mpPotion:potion('mpot0','mp')};
}
// A status heartbeat combines independent modules. Preserve the identity,
// location, balance, journal and item-demand fields needed for safe handoffs;
// shed optional telemetry before the transport's strict 5 KB message limit.
export function fitHeartbeat(data,maxLength=4200){
 const d={...data,items:[...(data.items??[])],materials:[...(data.materials??[])]};
 const length=()=>JSON.stringify(d).length;
 if(length()<=maxLength)return d;
 // Keep verified material stock counts as long as possible: the Merchant
 // uses these counts to avoid allocating duplicate farming quotas. They
 // matter more than optional diagnostic/skill/market telemetry, but lose
 // priority to the core identity, item demand and material requests below.
 for(const key of ['itemTransferEvidence','impactIntents','performance','stock','adaptive','advice','capabilities','gearOrders','gear','roles','activity','skills','mluck','supplies','materialProgress','farmPlan']){
  delete d[key];if(length()<=maxLength)return d;
 }
 // bankOwner is required for conservative G11 collision detection;
 // never drop a fresh active bank claim to shrink a heartbeat.
 // Keep active team identity if possible, but delivery demand takes precedence.
 while(d.materials.length>1&&length()>maxLength)d.materials.pop();
 while(d.items.length>0&&length()>maxLength)d.items.pop();
 if(length()>maxLength)d.materials=[];
 if(length()>maxLength)delete d.team;
 // Absence of this read-only proof means UNKNOWN, never empty inventory.
 if(length()>maxLength)delete d.inventoryEvidence;
 // Delivery intent and compact physically carried elixir evidence are core
 // fields, not optional telemetry. Refuse oversized messages rather than
 // silently hiding an outstanding elixir request.
 return length()<=maxLength?d:null;
}
// The official game server responds with the names actually reached by CM.
 // An empty receivers array is not delivery: cross-realm CM never reaches
 // players registered on another process. IPC responses need not carry it.
export function deliveryConfirmed(result,to){
 if(result===false||result?.success===false||result?.failed===true)return false;
 if(Array.isArray(result?.receivers))return result.receivers.includes(to);
 return true;
}
export function createTransport(bot){
  const {p,cfg,me}=bot,peers=new Map(),seen=new Map(),retired=new Map();let seq=0;const offs=[];
  const configured=cfg.characters.filter(x=>x.enabled&&x.group===me.group).map(x=>x.name),roster=[...configured];let own=[],ownAt=-Infinity;
  function refreshOwn(){if(cfg.merchant?.discoverOwnFarmers!==true||Date.now()-ownAt<15000)return;
    ownAt=Date.now();own=ownSupplyCharacters(p).filter(c=>!cfg.characters.some(x=>x.name===c.name&&(!x.enabled||x.group!==me.group)));
    roster.splice(0,roster.length,...new Set([...configured,...own.map(c=>c.name)]));
    for(const name of roster)if(name!==me.name&&!peerCounters.has(name))peerCounters.set(name,{sent:0,received:0,failed:0});
    for(const name of [...peerCounters.keys()])if(!roster.includes(name)){peerCounters.delete(name);peers.delete(name);seen.delete(name);retired.delete(name);}
  }
  const counters={heartbeatAttempts:0,heartbeatSent:0,heartbeatReceived:0,sendFailed:0,rejected:0,duplicates:0};
  const peerCounters=new Map(roster.filter(n=>n!==me.name).map(n=>[n,{sent:0,received:0,failed:0}]));
  let lastFailure=null;
  function failure(to,type,reason){
    counters.sendFailed++;const peer=peerCounters.get(to);if(peer)peer.failed++;
    lastFailure={to,type,reason,at:Date.now()};return false;
  }
  function success(to,type){
    if(type==='status'){counters.heartbeatSent++;const peer=peerCounters.get(to);if(peer)peer.sent++;}
    return true;
  }
  function status(){
    const at=Date.now(),ttlMs=cfg.general.messageTtlMs;
    return {name:me.name,group:me.group,session:bot.session,mode:cfg.general.transport,ipc:!!p.ipc,ttlMs,
      counters:{...counters},lastFailure:lastFailure?{...lastFailure}:null,
      peers:roster.filter(n=>n!==me.name).map(name=>{
        const d=peers.get(name),counts=peerCounters.get(name),ageMs=d?Math.max(0,at-d.received):null;
        return {name,seen:!!d,fresh:ageMs!==null&&ageMs<ttlMs,ageMs,
          receivedAt:d?.received??null,session:d?.session??null,realm:d?.realm??null,
          running:d?.running??null,heartbeatSent:counts.sent,heartbeatReceived:counts.received,sendFailed:counts.failed};
      })};
  }
  function receive(from,m){
    try{
      refreshOwn();
      if(!validMessage(m,from,me.name,roster,Date.now())||m.group!==me.group){counters.rejected++;return;}
      if((!configured.includes(from)||bot.supplyOnly)&&m.type!=='status'&&
         (!['offer','accept','sent','receipt','done','itemCancel'].includes(m.type)||m.type==='offer'&&!['hpot0','mpot0'].includes(m.data?.item?.name))){counters.rejected++;return;}
      const old=seen.get(from);if(old&&old.session===m.session&&m.seq<=old.seq){counters.duplicates++;return;}
      if(old&&old.session!==m.session){const past=retired.get(from)??[];if(past.includes(m.session)||m.time<old.time){counters.rejected++;return;}past.push(old.session);retired.set(from,past.slice(-8));}
      seen.set(from,{session:m.session,seq:m.seq,time:m.time});
      if(m.type==='status'){
        const d=m.data;if(!d||typeof d.map!=='string'||!Number.isFinite(d.x)||!Number.isFinite(d.y)||typeof d.realm!=='string'||!Array.isArray(d.items)||d.items.length>25){counters.rejected++;return;}
        peers.set(from,{...d,inventoryEvidence:unpackInventoryEvidence(d.inventoryEvidence),name:from,received:Date.now(),session:m.session});counters.heartbeatReceived++;const peer=peerCounters.get(from);if(peer)peer.received++;
      }else if(bot.running&&!bot.lifecycleChanging){if(m.type.startsWith('account'))bot.account?.receiveMessage(from,m);else if(m.type.startsWith('hop')||m.type.startsWith('port'))bot.teamTravel?.receive(from,m);else if(m.type.startsWith('gold'))bot.gold?.receive(from,m);else bot.logistics?.receive(from,m);}
    }catch(e){counters.rejected++;bot.report('Nachricht verworfen: '+e.message);}
  }
  if(p.ipc)offs.push(p.h.onMessage(e=>{if(e.topic==='albot/1')receive(e.from,e.data);}));
  offs.push(p.hook('on_cm',(from,data)=>{if(data?.protocol!=='albot/1')return;if(cfg.general.transport!=='ipc'&&(!p.headless||cfg.general.allowRemoteCM||cfg.general.transport==='cm'))receive(from,data);return true;}));
  function send(to,type,data,id=''){
    refreshOwn();
    if(to===me.name)return Promise.resolve(false);
    if(!roster.includes(to))return Promise.resolve(failure(to,type,'recipient'));
    const m={protocol:'albot/1',from:me.name,to,group:me.group,session:bot.session,seq:++seq,time:Date.now(),ttl:cfg.general.messageTtlMs,type,id,data};
    if(type==='status')counters.heartbeatAttempts++;
    if(JSON.stringify(m).length>=5000)return Promise.resolve(failure(to,type,'size'));
    const mode=cfg.general.transport;
    let result;
    try{
      if(mode!=='cm'&&p.ipc&&(parentSiblings().includes(to)||mode==='ipc'))result=p.h.send(to,'albot/1',m);
      else if(mode==='ipc'||(p.headless&&!cfg.general.allowRemoteCM&&mode!=='cm'))return Promise.resolve(failure(to,type,'channel'));
      else {if(bot.admission?.allowCM(to,m)===false)return Promise.resolve(failure(to,type,'call-cost'));result=p.call('send_cm',to,m);}
    }catch(e){bot.report('Teamtransport: '+(e.message??e));return Promise.resolve(failure(to,type,'exception'));}
    return Promise.resolve(result).then(value=>deliveryConfirmed(value,to)?success(to,type):failure(to,type,Array.isArray(value?.receivers)&&!value.receivers.includes(to)?'not-delivered':'rejected'),e=>{bot.report('Teamtransport: '+(e.message??e));return failure(to,type,'exception');});
  }
  // Test adapters may return Promises. Do not let an async rejection escape
  // a synchronous game cooldown lookup or invent potion readiness.
  function potionReady(){
   try{
    const value=p.call('is_on_cooldown','use_hp');
    if(value&&typeof value.then==='function'){
     value.catch?.(()=>{});return false;
    }
    return value===false;
   }catch{return false;}
  }
  function parentSiblings(){try{return p.parent.caracAL?.siblings??[];}catch{return [];}}
  return {peers,send,roster,status,
    combatSupport(){const c=p.c;return c?compactCombatSupport(c,p.G,bot.capabilities?.snapshot(),potionReady()):null;},
    ownCharacters(){refreshOwn();return own.map(c=>({...c}));},fresh(name){const d=peers.get(name);return d&&Date.now()-d.received<cfg.general.messageTtlMs?d:null;},
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={browserSwitch:p.characterSwitchCapability?.()??{supported:false,reason:'capability-unavailable'},incomingRotation:bot.account?.incomingRotation?.()??null,townActive:!!bot.movement?.townActive,lifecycleChanging:!!bot.lifecycleChanging,name:me.name,...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),party:c.party??null,rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,class:c.ctype,level:c.level,stats:{attack:c.attack,frequency:c.frequency,armor:c.armor,resistance:c.resistance,range:c.range,heal:c.heal,mp_cost:c.mp_cost,damage_type:c.damage_type,courage:c.courage,mcourage:c.mcourage,pcourage:c.pcourage,fear:c.fear},s:Object.fromEntries(Object.entries(c.s??{}).filter(([id])=>['hardshell','sheltered','mshield','aether_shield','guardians_oath','beacon_of_resolve','poisoned','stunned','silenced','stoned','hopsickness','realmfatigue'].includes(id)||p.G.conditions?.[id]?.blocked===true||id.startsWith('paladin_aura_'))),goldBalance:Number.isSafeInteger(c.gold)&&c.gold>=0?c.gold:null,goldReconcile:bot.recovery?.goldEvidence?.()??null,itemTransferEvidence:inspectItemTransferEvidence({
      journal:bot.journal,inventory:c.items,gold:c.gold,
      owner:me.name,session:bot.session,realm:p.realm()
     }),accountLossGuard:(()=>{const g=bot.lossGuard?.status();return g?.enabled?{blocked:g.blocked,trip:g.trip,resetAt:g.resetAt}:null;})(),bankGoldBalance:(me.name===cfg.party.merchant||c.map?.startsWith('bank'))&&Number.isSafeInteger(c.bank?.gold)&&c.bank.gold>=0?c.bank.gold:null,goldSurplus:bot.gold?.surplus()??0,monsterhunt:(()=>{const q=c.s?.monsterhunt;return q&&typeof q.id==='string'&&Number.isSafeInteger(q.c)&&q.c>=0?{id:q.id,c:q.c,...(Number.isFinite(q.ms)?{ms:Math.max(0,Math.floor(q.ms))}:{}),...(typeof q.sn==='string'?{sn:q.sn}:{})}:null;})(),huntObjective:me.name===bot.leader?bot.teamPlan?.orderedHunt?.()??null:null,squadQuestVisit:false,goldTransferPending:!!bot.gold?.reserved,goldTransferAt:bot.gold?.transferAt??0,target:bot.target?.id??null,free:bot.free(),achievementCarrier:carriedAchievementCarrier(c.items),storagePressure:me.role==='merchant'&&me.name===cfg.party.merchant&&(bot.merchant?.status?.()?.capacityRecovery===true||bot.free()<=(cfg.merchant?.minFreeSlots??4)),running:bot.running,reserved:!!bot.logistics?.reserved,journal:!!bot.journal||!!bot.bank?.pending,inventoryBlocked:!!bot.inventoryBlocked,threats:bot.monsters().filter(m=>m.target===me.name).length,pending:bot.exec.pending.size,lootSlots:bot.logistics?.pickupSlots?.()??0,
      combatSupport:compactCombatSupport(c,p.G,bot.capabilities?.snapshot(),potionReady()),
      potions:Object.fromEntries(['hpot0','mpot0'].map(id=>[id,
        (c.items??[]).reduce((n,i)=>n+(i?.name===id?(i.q??1):0),0)])),
      march:(()=>{
        const own=bot.teamPlan?.heartbeat?.();
        const lead=me.name===bot.leader?null:bot.transport?.fresh?.(bot.leader);
        const trusted=lead?.running&&!lead.rip&&lead.realm===p.realm();
        // A compact leader intent survives heartbeat trimming and can
        // confirm a follower's already active route even if its own plan
        // has temporarily vanished.
        const remote=trusted?(lead.farmPlan??
          (lead.march?.plan?{...lead.march,id:lead.march.plan}:null)):null;
        const route=me.name===bot.leader?own:
          remote??(trusted&&lead.march?.plan===own?.id?own:null);
        return sharedMarchStatus(route,bot.movement?.order,p.realm());
      })(),potionConsumption:bot.potionReceipts?.heartbeat(),items,materials:bot.production?.materials()??[],gear:bot.gear?.snapshot(),gearOrders:bot.gear?.goals().filter(g=>g.sourceOwner&&g.sourceOwner!==me.name).slice(0,5).map(g=>({item:g.item,level:g.sourceLevel??g.level,targetLevel:g.level,variant:g.variant,gearSlot:g.gearSlot,recipient:g.recipient,character:g.character,sourceOwner:g.sourceOwner})),activity:bot.strategy?.heartbeat(),questVisit:!!bot.strategy?.busy,team:bot.account?.heartbeat(),performance:bot.observations?.heartbeat(),impactIntents:bot.impactIntents?.heartbeat()??[],adaptive:bot.adaptive?.snapshot(),advice:bot.cloud?.advice(),farmPlan:compactFarmPlan(bot.teamPlan?.heartbeat?.()),materialAck:bot.teamPlan?.materialAck?.(),roles:bot.teamPlan?.roles(),elixir:bot.elixirs?.request(),supplies:bot.supplies?.request(),materialProgress:bot.production?.progress?.(),bankOwner:bot.recovery?.heartbeat(),inventoryEvidence:packInventoryEvidence(inventoryStockEvidence(c.items??[],{owner:me.name,session:bot.session,realm:p.realm(),maxRows:32,allowOpaque:true,reserved:i=>bot.production?.reservedQuantity?.(i)??0})),// Minimal elixir stock evidence survives a trimmed status message; the
      // optional full gear-stock advertisement can still be discarded.
      elixirStock:me.role==='merchant'?[...new Set((c.items??[])
       .filter(i=>i&&!i.l&&!i.b&&p.G.items?.[i.name]?.type==='elixir')
       .map(i=>i.name))].slice(0,8).map(name=>({name})):undefined,
      stock:(c.items??[]).filter(i=>i&&!i.l&&!i.b&&bot.p.G.items[i.name]&&['weapon','helmet','chest','pants','shoes','ring','earring','amulet','belt','cape','gloves','shield','source','orb','elixir'].includes(bot.p.G.items[i.name].type)).sort((a,b)=>Number(bot.p.G.items[b.name].type==='elixir')-Number(bot.p.G.items[a.name].type==='elixir')).slice(0,16).map(i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''})),capabilities:bot.capabilities?.snapshot(),motion:{moving:!!c.moving,speed:c.speed??0,at:Date.now()},mluck:c.s?.mluck??null,skills:['heal','partyheal','revive','taunt','reflection','energize','rspeed','cleansing_light'].filter(id=>{const s=p.G.skills?.[id];return s&&(!s.class||s.class.includes?.(c.ctype))&&(s.level??0)<=c.level;})};const bounded=fitHeartbeat(d);if(!bounded){bot.report('Team-Heartbeat zu groß; keine unvollständige Statusmeldung gesendet');return;}refreshOwn();for(const n of roster)if(configured.includes(n)||me.name===cfg.party.merchant&&peers.get(n)?.running&&Date.now()-peers.get(n).received<cfg.general.messageTtlMs)send(n,'status',bounded);},
    close(){offs.splice(0).forEach(f=>f());peers.clear();seen.clear();retired.clear();}
  };
}
