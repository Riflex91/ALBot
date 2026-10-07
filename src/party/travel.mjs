import {distance,samePlace} from '../core/policy.mjs';
export function createTeamTravel(bot){
 const {p,cfg,me,exec}=bot,w=cfg.world;let hop=null,hopAt=Number(p.read('albot:hop:'+me.name))||0;const consents=new Map();
 const safe=()=>bot.running&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&!exec.pending.size&&!Object.keys(p.c.q??{}).length&&!bot.monsters().some(m=>m.target===me.name);
 const realmAllowed=realm=>w.serverHop&&w.allowedRealms.includes(realm)&&/^[A-Z]{2}.+$/.test(realm);
 function requestHop(realm){if(me.name!==bot.leader||!realmAllowed(realm)||realm===p.realm()||Date.now()-hopAt<w.hopCooldownMs||!safe()||hop)return false;
  const names=[...bot.farmers,...(cfg.party.merchant?[cfg.party.merchant]:[])];if(names.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.realm!==p.realm())))return false;
  hop={id:bot.session+':hop:'+Date.now(),realm,names,ready:new Set([me.name]),until:Date.now()+15000};bot.movement.stop();for(const n of names)if(n!==me.name)bot.transport.send(n,'hopPlan',{realm},hop.id);return true;
 }
 function applyHop(){if(!hop||!safe())return false;const realm=hop.realm;if(!p.write('albot:hop:'+me.name,Date.now()))return false;
  hopAt=Date.now();const started=exec.run('server.hop',['lifecycle'],()=>bot.running&&!bot.journal,()=>{bot.pause('Serverwechsel: '+realm);try{return Promise.resolve(p.call('change_server',realm.slice(0,2),realm.slice(2))).catch(error=>bot.report('Serverwechsel fehlgeschlagen: '+(error?.message??error)));}catch(error){bot.report('Serverwechsel fehlgeschlagen: '+(error?.message??error));}},{delay:w.hopCooldownMs});hop=null;return started;
 }
 function receive(from,m){
  if(m.type==='hopPlan'&&from===bot.leader&&realmAllowed(m.data?.realm)&&Date.now()-hopAt>=w.hopCooldownMs&&safe()){
   hop={id:m.id,realm:m.data.realm,names:[],ready:new Set(),until:Date.now()+15000};bot.movement.stop();bot.transport.send(from,'hopAck',{},m.id);
  }else if(m.type==='hopAck'&&me.name===bot.leader&&hop?.id===m.id&&hop.names.includes(from))hop.ready.add(from);
  else if(m.type==='hopCommit'&&from===bot.leader&&hop?.id===m.id&&hop.realm===m.data?.realm){applyHop();}
  else if(m.type==='hopCancel'&&from===bot.leader&&hop?.id===m.id)hop=null;
  else if(m.type==='portRequest'&&w.magiport&&bot.teamNames.includes(from)&&m.data?.target===me.name&&safe()){
   const mage=bot.transport.fresh(from),leader=me.name===bot.leader?p.c:bot.transport.fresh(bot.leader);
   if(mage?.class==='mage'&&mage.running&&mage.realm===p.realm()&&leader&&samePlace(mage,leader)&&distance(mage,leader)<cfg.party.followDistance){consents.set(from,{until:Date.now()+10000,id:m.id,purpose:'accept'});bot.transport.send(from,'portAck',{},m.id);}
  }else if(m.type==='portAck'&&w.magiport&&p.c.ctype==='mage'&&consents.get(from)?.purpose==='cast'&&consents.get(from)?.id===m.id&&consents.get(from)?.until>Date.now()&&safe()){
   exec.run('magiport',['skill','mana','lifecycle'],()=>bot.running&&p.c.mp>=(p.G.skills.magiport?.mp??900)+p.c.max_mp*.2,()=>p.call('use_skill','magiport',from),{delay:15000});consents.delete(from);
  }
 }
 function tick(){
  for(const [name,t] of consents)if(t.until<Date.now())consents.delete(name);
  if(hop){if(hop.until<Date.now()){if(me.name===bot.leader)for(const n of hop.names)bot.transport.send(n,'hopCancel',{},hop.id);hop=null;return;}
   if(me.name===bot.leader&&!hop.broadcast&&hop.names.every(n=>hop.ready.has(n))&&safe()){const token=hop;hop.broadcast=true;Promise.all(hop.names.filter(n=>n!==me.name).map(n=>bot.transport.send(n,'hopCommit',{realm:hop.realm},hop.id))).then(results=>{if(hop===token&&results.every(Boolean))applyHop();else if(hop===token)hop=null;},()=>{if(hop===token)hop=null;});}return;
  }
  if(!w.magiport||p.c.ctype!=='mage'||!safe()||p.c.mp<(p.G.skills.magiport?.mp??900)+p.c.max_mp*.2)return;
  const leader=me.name===bot.leader?p.c:bot.transport.fresh(bot.leader);if(!leader||!samePlace(p.c,leader)||distance(p.c,leader)>cfg.party.followDistance)return;
  for(const name of bot.farmers){const peer=bot.transport.fresh(name);if(name===me.name||!peer?.running||peer.rip||peer.realm!==p.realm()||consents.has(name)||samePlace(p.c,peer)&&distance(p.c,peer)<cfg.party.followDistance*2)continue;
   const id=bot.session+':port:'+name+':'+Date.now();consents.set(name,{until:Date.now()+10000,id,purpose:'cast'});bot.transport.send(name,'portRequest',{target:name},id);break;
  }
 }
 function accept(name){if(w.magiport&&consents.get(name)?.purpose==='accept'&&consents.get(name)?.until>Date.now()&&safe()){consents.delete(name);return exec.run('magiport.accept',['lifecycle','movement'],()=>bot.running&&!bot.journal,()=>p.call('accept_magiport',name),{delay:10000});}return false;}
 return {requestHop,receive,tick,accept,get blocked(){return !!hop;},status:()=>({hop:hop?{realm:hop.realm,until:hop.until}:null}),close(){hop=null;consents.clear();}};
}
