import {runtimeConditionGate} from '../core/action-admission.mjs';
import {validMessage,xy,samePlace,distance} from '../core/policy.mjs';
import {ownSupplyCharacters} from '../items/potion-supply.mjs';
import {carriedAchievementCarrier} from '../items/achievement-utility.mjs';
import {inventoryStockEvidence,packInventoryEvidence,unpackInventoryEvidence} from '../items/stock-evidence.mjs';
import {inspectItemTransferEvidence} from '../items/transfer-reconciliation.mjs';
// The full ranking contains bulky diagnostics. Recipients only need the
// authoritative fields required to validate/adopt the shared spawn plan.
// The leader may finish a short-lived attack tick with bot.target already
// reset while the native character target is still observable. Publish it
// only when the actual LIVE monster matches the current shared farm plan.
export function verifiedNativeFarmFocus(character,monsters,plan){
 if(!character||character.rip||!plan?.id||!plan.target||
    character.target==null)return null;
 return (monsters??[]).find(m=>m?.id!=null&&
   String(m.id)===String(character.target)&&m.mtype===plan.target&&
   m.hp>0&&!m.dead&&samePlace(character,m))?.id??null;
}
export function compactFarmPlan(plan){
 if(!plan?.id)return null;
 const fields=['id','key','target','map','in','x','y','realm','leader',
  'kind','objective','item','started','expires','definition','bounds',
  'radius','reason','arrivedAt'];
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
 return {aoe:(capabilities?.sustainable??[]).filter(id=>['3shot','5shot'].includes(id)&&G?.skills?.[id]&&runtimeConditionGate(c,G,'skill:'+id,['mana','skill']).allowed).map(id=>({id,capacity:id==='3shot'?3:5})),healReady:!!(allowed&&capabilities?.ready?.includes('heal')&&
    runtimeConditionGate(c,G,'skill:heal',['mana','attack']).allowed),
   healSustainable:!!(allowed&&capabilities?.sustainable?.includes('heal')&&
    runtimeConditionGate(c,G,'skill:heal',['mana','skill']).allowed),
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
 // Bound malformed evidence; retain valid small material counts through
 // farmPlan trimming so missing telemetry cannot permanently freeze quotas.
 const progress=d.materialProgress;
 if(progress!==undefined&&(!Array.isArray(progress)||progress.length>5||
   JSON.stringify(progress).length>1200||progress.some(r=>
    typeof r?.objective!=='string'||r.objective.length>120||
    !Number.isSafeInteger(r.quantity)||r.quantity<0)))delete d.materialProgress;
 if(length()<=maxLength)return d;
 // Keep verified material stock counts as long as possible: the Merchant
 // uses these counts to avoid allocating duplicate farming quotas. They
 // matter more than optional diagnostic/skill/market telemetry, but lose
 // priority to the core identity, item demand and material requests below.
 for(const key of ['lootReceipts','itemTransferEvidence','impactIntents','performance','stock','adaptive','advice','capabilities','gearOrders','roles','activity','skills','supplies','farmPlan']){
  delete d[key];if(length()<=maxLength)return d;
 }
 // Full, session-bound gear.slots is required by allocation.offer(), reserve()
 // and the equip receipt guard. Never silently discard this proof from a
 // fresh heartbeat; refuse an impossible payload instead of sending a
 // misleading gear-less status.
 // bankOwner is required for conservative G11 collision detection;
 // never drop a fresh active bank claim to shrink a heartbeat.
 // Keep active team identity if possible, but delivery demand takes precedence.
 while(d.materials.length>1&&length()>maxLength)d.materials.pop();
 while(d.items.length>0&&length()>maxLength)d.items.pop();
 // Material orders are actionable contracts. An oversized heartbeat must
 // not silently turn a real Merchant request into an empty order list.
 // Fail closed instead; the compact team broadcast remains independent.
 // Team election is core account state: dropping it lets restarted farmers
 // elect themselves and create incompatible party owners. Keep it intact;
 // a separate compact coordinator broadcast is the independent fallback.
 // Do not treat absent team evidence as a one-member selection.
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
  const unreachableProbed=new Map();
  const peerCounters=new Map(roster.filter(n=>n!==me.name).map(n=>[n,{sent:0,received:0,failed:0}]));
  let lastFailure=null,lastTeamBroadcast=0;
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
  // Register both real listeners atomically with respect to all returned
  // disposers. In particular, a failure at CM registration must detach IPC.
  function releaseListeners(){
    let failures=0;
    for(const off of offs.splice(0).reverse()){
      try{off();}catch{failures++;}
    }
    if(failures)throw Error('Transport listener cleanup incomplete: '+failures);
  }
  try{
    if(p.ipc){
      const off=p.h.onMessage(e=>{if(e.topic==='albot/1')receive(e.from,e.data);});
      if(typeof off!=='function')throw Error('IPC listener is missing cleanup');
      offs.push(off);
    }
    const off=p.hook('on_cm',(from,data)=>{if(data?.protocol!=='albot/1')return;if(cfg.general.transport!=='ipc'&&(!p.headless||cfg.general.allowRemoteCM||cfg.general.transport==='cm'))receive(from,data);return true;});
    if(typeof off!=='function')throw Error('CM listener is missing cleanup');
    offs.push(off);
  }catch(error){
    try{releaseListeners();}
    catch(rollbackError){
      throw new Error('Transport initialization rollback incomplete',
       {cause:{registration:error,rollback:rollbackError}});
    }
    throw error;
  }
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
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={browserSwitch:p.characterSwitchCapability?.()??{supported:false,reason:'capability-unavailable'},incomingRotation:bot.account?.incomingRotation?.()??null,townActive:!!bot.movement?.townActive,lifecycleChanging:!!bot.lifecycleChanging,combatLife:bot.combatLife??null,name:me.name,...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),party:c.party??null,rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,class:c.ctype,level:c.level,stats:{attack:c.attack,frequency:c.frequency,armor:c.armor,resistance:c.resistance,range:c.range,heal:c.heal,mp_cost:c.mp_cost,damage_type:c.damage_type,courage:c.courage,mcourage:c.mcourage,pcourage:c.pcourage,fear:c.fear},s:Object.fromEntries(Object.entries(c.s??{}).filter(([id])=>['hardshell','sheltered','mshield','aether_shield','guardians_oath','beacon_of_resolve','poisoned','stunned','silenced','stoned','hopsickness','realmfatigue'].includes(id)||p.G.conditions?.[id]?.blocked===true||id.startsWith('paladin_aura_'))),goldBalance:Number.isSafeInteger(c.gold)&&c.gold>=0?c.gold:null,goldReconcile:bot.recovery?.goldEvidence?.()??null,itemTransferEvidence:inspectItemTransferEvidence({
      journal:bot.journal,inventory:c.items,gold:c.gold,
      owner:me.name,session:bot.session,realm:p.realm()
     }),accountLossGuard:(()=>{const g=bot.lossGuard?.status();return g?.enabled?{blocked:g.blocked,trip:g.trip,resetAt:g.resetAt}:null;})(),bankGoldBalance:(me.name===cfg.party.merchant||c.map?.startsWith('bank'))&&Number.isSafeInteger(c.bank?.gold)&&c.bank.gold>=0?c.bank.gold:null,goldSurplus:bot.gold?.surplus()??0,monsterhunt:(()=>{const q=c.s?.monsterhunt;return q&&typeof q.id==='string'&&Number.isSafeInteger(q.c)&&q.c>=0?{id:q.id,c:q.c,...(Number.isFinite(q.ms)?{ms:Math.max(0,Math.floor(q.ms))}:{}),...(typeof q.sn==='string'?{sn:q.sn}:{})}:null;})(),huntObjective:me.name===bot.leader?bot.teamPlan?.orderedHunt?.()??null:null,squadQuestVisit:false,goldTransferPending:!!bot.gold?.reserved,goldTransferAt:bot.gold?.transferAt??0,target:bot.target?.id??(me.name===bot.leader?verifiedNativeFarmFocus(c,bot.monsters(),bot.teamPlan?.heartbeat?.()):null),free:bot.free(),achievementCarrier:carriedAchievementCarrier(c.items),storagePressure:me.role==='merchant'&&me.name===cfg.party.merchant&&(bot.merchant?.status?.()?.capacityRecovery===true||bot.free()<=(cfg.merchant?.minFreeSlots??4)),running:bot.running,reserved:!!bot.logistics?.reserved,journal:!!bot.journal||!!bot.bank?.pending,inventoryBlocked:!!bot.inventoryBlocked,threats:bot.monsters().filter(m=>m.target===me.name).length,pending:bot.exec.pending.size,lootSlots:bot.logistics?.pickupSlots?.()??0,
      travelBlock:bot.farmer?.travelStatus?.()??null,farmRejections:bot.strategy?.farmRejections?.()??[],
      // Compact evidence only. Never relay a command; every Cave member
      // attests its own direct native clearance and peers verify all three.
      retreatVote:bot.caveRetreat?.heartbeat?.()??null,
      retreatPrepare:bot.caveRetreatPrepare?.heartbeat?.()??null,
      retreatAbort:bot.caveRetreatWatchdog?.heartbeat?.()??null,
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
        const march=sharedMarchStatus(route,bot.movement?.order,p.realm());
        // Full farmPlan is optional heartbeat telemetry and may be shed at
        // 4.2 KB. While one selected farmer visits the hunt NPC, preserve
        // the leader's *locally validated* ordinary anchor in the compact
        // march proof so the remaining Priest/Ranger can validate a duo.
        // A compact verified plan is needed for *all* leader engagements,
        // not only a quest-detached duo. The optional full farmPlan can
        // disappear during normal 4.2 KB heartbeat shedding as well.
        if(me.name===bot.leader&&march&&own?.kind==='farm'&&
           !own.objective&&bot.teamPlan?.valid?.(own)){
          march.anchor=compactFarmPlan(own);
        }
        return march;
      })(),potionConsumption:bot.potionReceipts?.heartbeat(),lootReceipts:bot.lootReceipts?.heartbeat()??[],items,materials:bot.production?.materials()??[],gear:bot.gear?.snapshot(),gearOrders:bot.gear?.goals().filter(g=>g.sourceOwner&&g.sourceOwner!==me.name).slice(0,5).map(g=>({item:g.item,level:g.sourceLevel??g.level,targetLevel:g.level,variant:g.variant,gearSlot:g.gearSlot,recipient:g.recipient,character:g.character,sourceOwner:g.sourceOwner})),activity:bot.strategy?.heartbeat(),questVisit:!!bot.strategy?.busy,team:bot.account?.heartbeat(),performance:bot.observations?.heartbeat(),impactIntents:bot.impactIntents?.heartbeat()??[],adaptive:bot.adaptive?.snapshot(),advice:bot.cloud?.advice(),farmPlan:compactFarmPlan(bot.teamPlan?.heartbeat?.()),materialAck:bot.teamPlan?.materialAck?.(),roles:bot.teamPlan?.roles(),elixir:bot.elixirs?.request(),supplies:bot.supplies?.request(),materialProgress:bot.production?.progress?.(),bankOwner:bot.recovery?.heartbeat(),inventoryEvidence:packInventoryEvidence(inventoryStockEvidence(c.items??[],{owner:me.name,session:bot.session,realm:p.realm(),maxRows:32,allowOpaque:true,reserved:i=>bot.production?.reservedQuantity?.(i)??0})),// Minimal elixir stock evidence survives a trimmed status message; the
      // optional full gear-stock advertisement can still be discarded.
      elixirStock:me.role==='merchant'?[...new Set((c.items??[])
       .filter(i=>i&&!i.l&&!i.b&&p.G.items?.[i.name]?.type==='elixir')
       .map(i=>i.name))].slice(0,8).map(name=>({name})):undefined,
      stock:(c.items??[]).filter(i=>i&&!i.l&&!i.b&&bot.p.G.items[i.name]&&['weapon','helmet','chest','pants','shoes','ring','earring','amulet','belt','cape','gloves','shield','source','orb','elixir'].includes(bot.p.G.items[i.name].type)).sort((a,b)=>Number(bot.p.G.items[b.name].type==='elixir')-Number(bot.p.G.items[a.name].type==='elixir')).slice(0,16).map(i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''})),capabilities:bot.capabilities?.snapshot(),motion:{moving:!!c.moving,speed:c.speed??0,at:Date.now()},mluck:c.s?.mluck??null,skills:['heal','partyheal','revive','taunt','reflection','energize','rspeed','cleansing_light'].filter(id=>{const s=p.G.skills?.[id];return s&&(!s.class||s.class.includes?.(c.ctype))&&(s.level??0)<=c.level;})};const bounded=fitHeartbeat(d);
      if(!bounded)bot.event?.('transport.heartbeatOversize',{
        bytes:JSON.stringify(d).length,teamPreserved:!!d.team,
        reason:'status-fail-closed-independent-team-channel'});
      refreshOwn();const now=Date.now();if(bounded)for(const n of roster){
      const d=peers.get(n),online=d?.running===true&&now-d.received<cfg.general.messageTtlMs;
      const configuredPeer=configured.includes(n);
      if(!configuredPeer&&!(me.name===cfg.party.merchant&&online))continue;
      // Discovery must remain possible; only repeatedly unreachable peers
      // are probed infrequently. A fresh peer is never throttled.
      const bad=(peerCounters.get(n)?.failed??0)>=2&&!online;
      if(bad&&now-(unreachableProbed.get(n)??0)<30000)continue;
      if(bad)unreachableProbed.set(n,now);
      send(n,'status',bounded);
    }
    // Independent compact roster channel. It remains deliverable when
    // inventory/gear/bank heartbeat fields force status to fail closed.
    // Send only from the configured active coordinator to known live peers.
    if(me.name===cfg.party.merchant&&bot.running&&
       cfg.party.selection==='adaptive'&&now-lastTeamBroadcast>=6000){
      const team=bot.account?.heartbeat?.();
      if(Array.isArray(team?.names)&&team.names.length>0&&
         team.names.length<=cfg.party.maxFarmers&&
         typeof team.leader==='string'&&team.names.includes(team.leader)&&
         Number.isSafeInteger(team.seq)&&team.seq>=0){
        lastTeamBroadcast=now;
        const names=[...new Set(team.names)].filter(n=>n!==me.name&&
          configured.includes(n)&&bot.transport?.fresh?.(n)?.running&&
          bot.transport.fresh(n).realm===p.realm());
        for(const name of names)send(name,'accountTeam',{
          realm:p.realm(),team:{names:[...team.names],leader:team.leader,
           seq:team.seq,rotationSince:team.rotationSince}
        });
      }
    }
    },
    close(){try{releaseListeners();}finally{peers.clear();seen.clear();retired.clear();}}
  };
}
