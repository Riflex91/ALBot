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
export function createTeamTravel(bot){
 const {p,cfg,me,exec}=bot,w=cfg.world;let hop=null,hopAt=Number(p.read('albot:hop:'+me.name))||0;const consents=new Map();let registryRef=null,registrySignature=null,registryAt=0,lastHopDiagnostic=0,history=p.read('albot:hop-history:'+me.name)??[];if(!Array.isArray(history))history=[];
 const homeRealm=nonPvpRealm(w.homeRealm)?w.homeRealm:'';
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
 const safe=()=>bot.running&&!p.c.rip&&!bot.journal&&!bot.bank?.pending&&!bot.inventoryBlocked&&!bot.logistics.reserved&&!exec.pending.size&&!Object.keys(p.c.q??{}).length&&!bot.monsters().some(m=>m.target===me.name);
 const realmAllowed=realm=>nonPvpRealm(realm)&&!cfg.farming.pvp&&admission(realm)&&w.serverHop&&w.allowedRealms.includes(realm);
 const hopLifecycle=createHopLifecycle(bot,{destinationNormal,safe});
 function requestHop(realm){if(me.name!==bot.leader||!realmAllowed(realm)||realm===p.realm()||Date.now()-hopAt<w.hopCooldownMs||!safe()||hop||hopLifecycle.blocked)return false;
  const names=[...bot.farmers,...(cfg.party.merchant?[cfg.party.merchant]:[])];if(names.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.realm!==p.realm())))return false;
  hop={id:bot.session+':hop:'+Date.now(),realm,names,ready:new Set([me.name]),until:Date.now()+15000};bot.movement.stop();
  bot.event?.('server.hop.plan',{id:hop.id,from:p.realm(),to:realm,members:names.join(','),until:hop.until});
  for(const n of names)if(n!==me.name)bot.transport.send(n,'hopPlan',{realm},hop.id);return true;
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
   }else if(decision.state==='crowded'&&safe()){
    const prior=home.prior;
    const fallback=chooseHomeFallback(registry(),stateRealm,homeRealm,prior,realmAllowed);
    if(fallback&&requestHop(fallback)){
     if(saveHome({...home,phase:'away',prior:fallback,retryAt:now+retryMs,
       enteredAt:0,crowdedAt:now})){
      bot.event?.('server.homeCrowded',{realm:homeRealm,pressure,
       fallback,retryAt:now+retryMs});
     }else{for(const n of hop?.names??[])if(n!==me.name)
       bot.transport.send(n,'hopCancel',{},hop.id);hop=null;}
    }
   }
   // Home travel owns pressure-based server selection; do not race autoHop.
   return true;
  }
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
 return {requestHop,receive,tick,lifecycleTick:hopLifecycle.tick,accept,get blocked(){return !!hop||hopLifecycle.blocked;},
  status:()=>({registry:registry(),history:[...history],hop:hop?{id:hop.id,realm:hop.realm,until:hop.until,ready:[...hop.ready],members:[...hop.names]}:null,
   lifecycle:hopLifecycle.status(),home:homeRealm?{...home}:null}),
  close(){hop=null;hopLifecycle.close();consents.clear();}};
}
