import {assessServerHop,assessHomeSpawn,chooseHomeFallback} from '../world/servers.mjs';
import {distance,samePlace} from '../core/policy.mjs';
import {createHopLifecycle} from './hop-lifecycle.mjs';
// Only official numbered European/American realms are eligible. PvP in any
// spelling or metadata is a hard reject, even if a caller mislabels the mode.
export function nonPvpRealm(realm){
 return typeof realm==='string'&&/^(EU|US)(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(realm)&&!/pvp/i.test(realm);
}
export function normalizeServerRegistry(raw,now=Date.now(),fromOfficialGame=false){
 return (Array.isArray(raw)?raw:[]).map(s=>{
  const realm=s.realm??String(s.region??'')+String(s.name??s.identifier??'');
  const name=String(s.name??s.identifier??'');
  const pvp=/pvp/i.test(realm)||/pvp/i.test(name)||s.pvp===true||
    (typeof s.mode==='string'&&/pvp/i.test(s.mode))||s.mode==='PVP';
  const explicitMode=typeof s.mode==='string'?s.mode.toUpperCase():s.pvp===false?'NORMAL':null;
  // X.servers is the game's own live list. Only its canonical numbered realms
  // with finite population and no contradicting metadata admit inference.
  const canonical=nonPvpRealm(realm);
  const trusted=fromOfficialGame&&canonical&&!pvp&&Number.isFinite(s.players)&&s.players>=0;
  const mode=pvp?'PVP':explicitMode??(trusted?'NORMAL':'UNBEKANNT');
  const offline=s.online===false||s.status==='offline'||s.status==='down';
  const online=!offline&&(s.online===true||s.status==='online'||trusted);
  return {realm,mode,online,players:s.players,at:s.at??now};
 });
}
// The official X.servers collection may be updated *in place* by the game.
// Reference identity alone hides fresh population updates and can age out the
// server-hop registry forever after 60 seconds of gameplay.
export function serverRegistrySignature(raw){
 if(!Array.isArray(raw)||raw.length>100)return null;
 return JSON.stringify(raw.map(s=>s&&typeof s==='object'?[
  s.region??null,s.name??null,s.identifier??null,s.realm??null,
  Number.isFinite(s.players)?s.players:null,
  s.online??null,s.status??null,s.mode??null,s.pvp??null,
  Number.isFinite(s.at)?s.at:null
 ]:null));
}
// A temporary congestion escape may delay return, never suppress the
// persisted home contract after the retry deadline expires.
export function reunionHomeRealm(homeRealm,home,localRealm,now=Date.now()){
 return home?.phase==='escaped'&&now<(home.retryAt??0)&&localRealm!==homeRealm?
  '':homeRealm;
}
// Recover an account team which was already started on different servers.
// Votes come only from all selected FARMERS, not the merchant (which might
// be deliberately stationed away). A missing or stale farmer abstains from
// permission: do not turn a partial set into a majority or bounce servers.
export function teamRealmRendezvous({farmers,localName,localRealm,peers,
 homeRealm='',fixedLeader=''}={}){
 const deny=(reason,extra={})=>({complete:false,split:false,target:null,reason,...extra});
 // Official send_cm is routed by the current game server only; an explicit,
 // common home realm is a safe cross-server rendezvous without remote CM.
 // Never infer a destination from stale/missing peer observations.
 if(!nonPvpRealm(localRealm))return deny('invalid-local-realm');
 if(nonPvpRealm(homeRealm))return {complete:true,split:localRealm!==homeRealm,
  target:homeRealm,reason:localRealm===homeRealm?'configured-home-arrived':'configured-home-return',
  source:'configured-home',farmers:[],counts:{}};
 if(!Array.isArray(farmers)||farmers.length<2||farmers.length>8||
    farmers.some(n=>typeof n!=='string'||!n)||
    new Set(farmers).size!==farmers.length||!nonPvpRealm(localRealm))
   return deny('invalid-roster');
 const votes=[];
 for(const name of farmers){
  const member=name===localName?{running:true,realm:localRealm}:peers?.[name];
  if(member?.running!==true||member.rip===true||
     !nonPvpRealm(member.realm))
   return deny('farmer-heartbeat-missing',{missing:name});
  votes.push({name,realm:member.realm});
 }
 const counts=new Map();
 for(const v of votes)counts.set(v.realm,(counts.get(v.realm)??0)+1);
 const ordered=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 // Respect an explicit home/leader preference; autoRoster sets leader='' and
 // therefore selects the current farmer majority (2x USI beats 1x USIV).
 const fixed=nonPvpRealm(homeRealm)?homeRealm:
    fixedLeader&&votes.find(v=>v.name===fixedLeader)?.realm;
 const target=fixed&&nonPvpRealm(fixed)?fixed:ordered[0]?.[0]??null;
 const split=counts.size>1||localRealm!==target;
 return {complete:true,split,target,reason:split?'farmer-realm-split':'unified',
  farmers:votes,counts:Object.fromEntries(ordered)};
}
export function createTeamTravel(bot){
 const {p,cfg,me,exec}=bot,w=cfg.world;let hop=null,hopAt=Number(p.read('albot:hop:'+me.name))||0;const consents=new Map();let registryRef=null,registrySignature=null,registryAt=0,lastHopDiagnostic=0,history=p.read('albot:hop-history:'+me.name)??[];if(!Array.isArray(history))history=[];
 const homeRealm=nonPvpRealm(w.homeRealm)?w.homeRealm:'';
 let reunionHold=false,lastReunion=null,lastReunionDiagnostic=0;
 // The selection is regenerated from this character's configured roster, not
 // from local server discovery. Only fresh cross-realm peer status qualifies.
 function reunionEvidence(){
  const names=[...(bot.farmers??[])];
  const peers=Object.fromEntries(names.filter(n=>n!==me.name)
    .map(n=>[n,bot.transport?.fresh?.(n)??null]));
  return teamRealmRendezvous({farmers:names,localName:me.name,
    localRealm:p.realm(),peers,
    // An authorized crowd escape lasts only until its persisted retry deadline.
    // Afterwards even a sole Farmer must rejoin the configured home realm;
    // requestHop() cannot do so if the Merchant is already on that realm.
    homeRealm:reunionHomeRealm(homeRealm,home,p.realm()),
    fixedLeader:cfg.party.leader??''});
 }

 const homeKey='albot:home-return:'+me.name;
 const savedHome=p.read(homeKey);
 let home=savedHome&&savedHome.realm===homeRealm&&
   Number.isFinite(savedHome.retryAt)&&savedHome.retryAt>=0?
   savedHome:{realm:homeRealm,phase:'idle',retryAt:0,enteredAt:0,prior:null};
 function saveHome(next){
  if(p.write(homeKey,next)!==true){bot.report?.('Heimserver-Rückkehr: Frist konnte nicht gespeichert werden');return false;}
  home=next;return true;
 }
 function registry(){const external=p.root.ALBotServerRegistry??p.parent.ALBotServerRegistry;const official=external==null;const raw=external??p.parent.X?.servers??[];
  const signature=serverRegistrySignature(raw);
  if(raw!==registryRef||signature!==registrySignature){
   registryRef=raw;registrySignature=signature;registryAt=Date.now();
  }
  return normalizeServerRegistry(raw,registryAt,official);
 }
 // Verify an online NORMAL server from the current registry rather than
 // trusting a past selection or any PvP flag on the character.
 function destinationNormal(realm){
  if(!nonPvpRealm(realm)||!w.allowedRealms.includes(realm))return false;
  const matches=registry().filter(s=>s.realm===realm);
  return matches.length===1&&matches[0].online===true&&matches[0].mode==='NORMAL';
 }
 function admission(realm){return destinationNormal(realm)&&
  (cfg.general.testLogging===undefined||assessServerHop(registry().find(s=>s.realm===realm),history,Date.now(),{pvp:false,cooldown:w.hopCooldownMs}).allowed);}
 const safe=()=>bot.lootDeparture?.beforeDeparture(null,'realm-hop')!==false&&bot.running&&!p.c.rip&&!bot.journal&&!bot.bank?.pending&&!bot.inventoryBlocked&&!bot.logistics.reserved&&!exec.pending.size&&!Object.keys(p.c.q??{}).length&&!bot.monsters().some(m=>m.target===me.name);
 const realmAllowed=realm=>nonPvpRealm(realm)&&!cfg.farming.pvp&&admission(realm)&&w.serverHop&&w.allowedRealms.includes(realm);
 const hopLifecycle=createHopLifecycle(bot,{destinationNormal,safe});
 function requestHop(realm,{pressureEscape=false}={}){if(me.name!==bot.leader||!realmAllowed(realm)||realm===p.realm()||Date.now()-hopAt<w.hopCooldownMs||!safe()||hop||hopLifecycle.blocked)return false;
  const names=[...bot.farmers,...(cfg.party.merchant?[cfg.party.merchant]:[])];if(names.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.realm!==p.realm())))return false;
  hop={id:bot.session+':hop:'+Date.now(),realm,names,pressureEscape,ready:new Set([me.name]),until:Date.now()+15000};bot.movement.stop();
  bot.event?.('server.hop.plan',{id:hop.id,from:p.realm(),to:realm,members:names.join(','),pressureEscape,until:hop.until});
  for(const n of names)if(n!==me.name)bot.transport.send(n,'hopPlan',{realm,pressureEscape},hop.id);return true;
 }
 function applyHop(){
  if(!hop||hopLifecycle.blocked||!safe()||!destinationNormal(hop.realm))return false;
  const {id,realm}=hop,at=Date.now(),from=p.realm();
  // Existing hourly cap and durable history must be stored before navigation.
  if(!p.write('albot:hop:'+me.name,at))return false;
  const next=[...history.filter(t=>at-t<3600000),at].slice(-16);
  if(!p.write('albot:hop-history:'+me.name,next))return false;
  history=next;hopAt=at;
  if(!hopLifecycle.begin({id,from,to:realm}))return false;
  hop=null;return true;
 }

 function receive(from,m){
  if(m.type==='hopPlan'&&from===bot.leader&&realmAllowed(m.data?.realm)&&Date.now()-hopAt>=w.hopCooldownMs&&safe()&&!hopLifecycle.blocked){
   if(m.data?.pressureEscape===true&&p.realm()===homeRealm&&
      !saveHome({...home,realm:homeRealm,phase:'escaped',
       retryAt:Date.now()+Math.max(600000,w.homeRetryMs??600000),
       escapeTo:m.data.realm,prior:homeRealm,enteredAt:0}))return;
   hop={id:m.id,realm:m.data.realm,names:[],ready:new Set(),until:Date.now()+15000};bot.movement.stop();
   bot.event?.('server.hop.planReceived',{id:m.id,from:p.realm(),to:hop.realm,leader:from});
   bot.transport.send(from,'hopAck',{},m.id);
  }else if(m.type==='hopAck'&&me.name===bot.leader&&hop?.id===m.id&&hop.names.includes(from)){
   hop.ready.add(from);bot.event?.('server.hop.ack',{id:m.id,member:from,ready:hop.ready.size,total:hop.names.length});
  }
  else if(m.type==='hopCommit'&&from===bot.leader&&hop?.id===m.id&&hop.realm===m.data?.realm){
   if(!applyHop())bot.event?.('server.hop.commitBlocked',{id:m.id,to:m.data?.realm,reason:'safety-or-checkpoint'});
  }
  else if(m.type==='hopCancel'&&from===bot.leader&&hop?.id===m.id){
   bot.event?.('server.hop.cancel',{id:m.id,to:hop.realm});hop=null;
  }
  else if(m.type==='portRequest'&&w.magiport&&bot.teamNames.includes(from)&&m.data?.target===me.name&&safe()){
   const mage=bot.transport.fresh(from),leader=me.name===bot.leader?p.c:bot.transport.fresh(bot.leader);
   if(mage?.class==='mage'&&mage.running&&mage.realm===p.realm()&&leader&&samePlace(mage,leader)&&distance(mage,leader)<cfg.party.followDistance){consents.set(from,{until:Date.now()+10000,id:m.id,purpose:'accept'});bot.transport.send(from,'portAck',{},m.id);}
  }else if(m.type==='portAck'&&w.magiport&&p.c.ctype==='mage'&&consents.get(from)?.purpose==='cast'&&consents.get(from)?.id===m.id&&consents.get(from)?.until>Date.now()&&safe()){
   exec.run('magiport',['skill','mana','lifecycle'],()=>bot.running&&p.c.mp>=(p.G.skills.magiport?.mp??900)+p.c.max_mp*.2,()=>p.call('use_skill','magiport',from),{delay:15000});consents.delete(from);
  }
 }
 function homeTick(){
  if(!homeRealm||!w.serverHop||!w.allowedRealms.includes(homeRealm)||
     me.name!==bot.leader)return false;
  const now=Date.now(),retryMs=Math.max(600000,w.homeRetryMs??600000);
  const stateRealm=p.realm();
  if(stateRealm===homeRealm){
   if(home.phase!=='checking'&&home.phase!=='settled'){
    saveHome({...home,realm:homeRealm,phase:'checking',enteredAt:now});
    return true;
   }
   const pressure=bot.teamPlan?.status()?.pressure;
   if(home.phase==='settled'){
    if(Number.isFinite(pressure)&&pressure>=w.homePressureThreshold&&
       now-(home.settledAt??0)>=Math.max(60000,w.homeCheckMs??90000))
     saveHome({...home,phase:'checking',enteredAt:now});
    return true;
   }
   if(!home.enteredAt||home.enteredAt>now){
    saveHome({...home,enteredAt:now});return true;
   }
   const decision=assessHomeSpawn({realm:stateRealm,home:homeRealm,
    enteredAt:home.enteredAt,now,pressure,
    checkMs:w.homeCheckMs??90000,threshold:w.homePressureThreshold??.65});
   if(decision.state==='settled'){
    if(saveHome({...home,phase:'settled',settledAt:now,enteredAt:home.enteredAt}))
     bot.event?.('server.homeSettled',{realm:homeRealm,pressure});
   }else if(decision.state==='crowded'){
    // Only a fresh, sampled spawn assessment can displace explicit home.
    const evidence=bot.teamPlan?.status()?.pressureEvidence;
    const credible=evidence?.reason==='verified-spawn-observations'&&
      Number.isFinite(evidence.measuredAt)&&now>=evidence.measuredAt&&
      now-evidence.measuredAt<=120000&&
      evidence.spawns?.some(s=>s.evidenceSeconds>=90&&
        s.pressureRatio>=w.homePressureThreshold&&
        Number.isFinite(s.observedAt)&&now>=s.observedAt&&
        now-s.observedAt<=120000);
    const servers=registry(),current=servers.find(s=>s.realm===homeRealm);
    const available=credible&&Number.isFinite(current?.players)?
      servers.filter(s=>Number.isFinite(s.players)&&
       s.players<current.players*.85&&realmAllowed(s.realm)):[];
    const alternative=available.length?
      chooseHomeFallback(available,stateRealm,homeRealm,home.prior,
       realm=>realmAllowed(realm)):null;
    const reason=!credible?'spawn-pressure-evidence-missing-or-stale':
      !Number.isFinite(current?.players)?'home-population-unverified':
      !alternative?'no-approved-lower-population-realm':
      !safe()?'actor-not-safe-for-hop':'team-hop-not-ready';
    if(alternative&&history.filter(at=>now-at<3600000).length<3&&
       requestHop(alternative,{pressureEscape:true})){
      const retryAt=now+retryMs;
      if(!saveHome({...home,phase:'escaped',escapeTo:alternative,
         enteredAt:0,prior:homeRealm,retryAt,escapedAt:now})){
       for(const n of hop?.names??[])if(n!==me.name)
        bot.transport.send(n,'hopCancel',{},hop.id);
       hop=null;return true;
      }
      bot.event?.('server.homeEscapePlanned',{from:homeRealm,to:alternative,
       pressure,evidence,returnAfter:retryAt});
      return true;
    }
    if(now-lastHopDiagnostic>=60000){
     lastHopDiagnostic=now;
     bot.event?.('server.homeEscapeDeferred',{realm:homeRealm,pressure,
      reason,credible,alternative});
    }
   }
   return true;
  }
  if(home.phase==='escaped'&&now<home.retryAt)return true;
  if(now<home.retryAt||!safe()||hop||!realmAllowed(homeRealm))return false;
  // Always reserve enough hourly hop budget for a possible immediate escape
  // from a blocked home spawn. Three hops per hour remains the hard ceiling.
  if(history.filter(at=>now-at<3600000).length>1)return false;
  const prior=stateRealm;
  if(!requestHop(homeRealm))return false;
  if(!saveHome({...home,realm:homeRealm,phase:'checking',enteredAt:0,
    prior,retryAt:now+retryMs,attemptedAt:now})){
   for(const n of hop?.names??[])if(n!==me.name)bot.transport.send(n,'hopCancel',{},hop.id);
   hop=null;return false;
  }
  bot.event?.('server.homeReturnAttempt',{realm:homeRealm,from:prior,
   retryAt:now+retryMs});
  return true;
 }
 function tick(){
  hopLifecycle.tick();if(hopLifecycle.blocked)return;
  // Coordinated hops need same-realm peers. A configured home realm is
  // a stronger rendezvous contract: no cross-server CM is required.
  // Without home, keep the conservative complete-heartbeat majority policy.
  reunionHold=false;
  if(w.serverHop&&cfg.party.enabled&&(homeRealm||bot.farmers?.length>=2)){
   const decision=reunionEvidence();
   lastReunion=decision;
   if(decision.complete&&decision.split){
    const local=p.realm(),target=decision.target;
    if(local!==target){
     // Never suspend survival logic or initiate change_server while ANY
     // nearby farmer is being attacked. Let the combat/emergency loop handle
     // the threat, then continue the convergence when combat is over.
     const localCombat=bot.monsters().some(m=>bot.farmers.includes(m.target));
     if(localCombat){reunionHold=false;return;}
     // Stop initiating unrelated value/movement actions while the pending
     // executor work settles. Existing safe() and lifecycle checks still apply.
     reunionHold=true;
     if(Date.now()-lastReunionDiagnostic>=12000){
      lastReunionDiagnostic=Date.now();
      bot.event?.('server.reunion.wait',{from:local,to:target,
       counts:decision.counts,reason:!destinationNormal(target)?
        'destination-unverified':!admission(target)?'hop-budget-or-registry':
        !safe()?'actor-not-safe':'reunion-ready'});
     }
     if(!hop&&!hopLifecycle.blocked&&
        destinationNormal(target)&&admission(target)&&
        Date.now()-hopAt>=w.hopCooldownMs&&safe()){
      const at=Date.now(),historyNext=[...history.filter(t=>at-t<3600000),at].slice(-16);
      if(p.write('albot:hop:'+me.name,at)===true&&
         p.write('albot:hop-history:'+me.name,historyNext)===true){
       const id=bot.session+':reunion:'+at;
       if(hopLifecycle.begin({id,from:local,to:target})){
        history=historyNext;hopAt=at;
        bot.event?.('server.reunion.commit',{id,from:local,to:target,
         votes:decision.counts,reason:decision.source??'farmer-majority'});
       }
      }
     }
    }
    // A member already on the voted target waits for other teammates.
    // In particular do not independently autoHop/homeHop while split.
    return;
   }
  }

  for(const [name,t] of consents)if(t.until<Date.now())consents.delete(name);
  if(hop){if(hop.until<Date.now()){
   bot.event?.('server.hop.timeout',{id:hop.id,to:hop.realm,
    missing:hop.names.filter(n=>!hop.ready.has(n)).join(',')});
   if(me.name===bot.leader)for(const n of hop.names)bot.transport.send(n,'hopCancel',{},hop.id);
   hop=null;return;}
   if(me.name===bot.leader&&!hop.broadcast&&hop.names.every(n=>hop.ready.has(n))&&safe()){const token=hop;hop.broadcast=true;Promise.all(hop.names.filter(n=>n!==me.name).map(n=>bot.transport.send(n,'hopCommit',{realm:hop.realm},hop.id))).then(results=>{if(hop===token&&results.every(Boolean))applyHop();else if(hop===token)hop=null;},()=>{if(hop===token)hop=null;});}return;
  }
  if(homeTick())return;
  if(cfg.general.testLogging!==undefined&&w.autoHop!==false&&
     me.name===bot.leader&&bot.teamPlan?.status().pressure>.6){
   const now=Date.now(),canMove=safe(),servers=registry();
   const current=servers.find(s=>s.realm===p.realm());
   const next=canMove?servers.filter(s=>s.realm!==p.realm()&&realmAllowed(s.realm)&&
     Number.isFinite(current?.players)&&Number.isFinite(s.players)&&
     s.players<current.players*.85).sort((a,b)=>a.players-b.players)[0]:null;
   if(next&&requestHop(next.realm)){
    bot.event('server.autoHop',{realm:next.realm,
     reason:'Anhaltender Standortdruck und frischer niedrigerer Serverbesatz'});
    return;
   }
   if(now-lastHopDiagnostic>=60000){
    lastHopDiagnostic=now;
    bot.event('server.autoHopDeferred',{realm:p.realm(),
     pressure:bot.teamPlan.status().pressure,
     reason:!w.serverHop?'server-hop-disabled':
      !canMove?'actor-not-safe-for-hop':
      !Number.isFinite(current?.players)?'current-population-unverified':
      'no-fresh-approved-lower-population-realm-or-team-not-ready',
     hopInProgress:!!hop});
   }
  }
  if(!w.magiport||p.c.ctype!=='mage'||!safe()||p.c.mp<(p.G.skills.magiport?.mp??900)+p.c.max_mp*.2)return;
  const leader=me.name===bot.leader?p.c:bot.transport.fresh(bot.leader);if(!leader||!samePlace(p.c,leader)||distance(p.c,leader)>cfg.party.followDistance)return;
  for(const name of bot.farmers){const peer=bot.transport.fresh(name);if(name===me.name||!peer?.running||peer.rip||peer.realm!==p.realm()||consents.has(name)||samePlace(p.c,peer)&&distance(p.c,peer)<cfg.party.followDistance*2)continue;
   const id=bot.session+':port:'+name+':'+Date.now();consents.set(name,{until:Date.now()+10000,id,purpose:'cast'});bot.transport.send(name,'portRequest',{target:name},id);break;
  }
 }
 function accept(name){if(w.magiport&&consents.get(name)?.purpose==='accept'&&consents.get(name)?.until>Date.now()&&safe()){consents.delete(name);return exec.run('magiport.accept',['lifecycle','movement'],()=>bot.running&&!bot.journal,()=>p.call('accept_magiport',name),{delay:10000});}return false;}
 return {requestHop,receive,tick,lifecycleTick:hopLifecycle.tick,accept,get blocked(){return reunionHold||!!hop||hopLifecycle.blocked;},
  status:()=>({registry:registry(),history:[...history],hop:hop?{id:hop.id,realm:hop.realm,until:hop.until,ready:[...hop.ready],members:[...hop.names]}:null,
   lifecycle:hopLifecycle.status(),reunion:lastReunion?{...lastReunion,hold:reunionHold}:null,
   home:homeRealm?{...home}:null}),
  close(){hop=null;hopLifecycle.close();consents.clear();}};
}
