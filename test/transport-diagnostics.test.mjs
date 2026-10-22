import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransport} from '../src/party/transport.mjs';

function fixture(names=['Ranger','Merchant']){
 const queue=[],listeners={},bots={};
 const cfg={general:{transport:'auto',allowRemoteCM:false,messageTtlMs:10000},party:{merchant:'Merchant'},
  characters:names.map(name=>({name,enabled:true,group:'team1'}))};
 for(const name of names){
  const c={name,map:'main',in:'main',x:0,y:0,items:[],rip:false,hp:100,max_hp:100,mp:100,max_mp:100,
   ctype:name==='Ranger'?'ranger':'merchant',level:40,attack:100,frequency:1,armor:10,resistance:10,range:200,gold:1000};
  const p={c,G:{items:{},skills:{}},ipc:false,headless:false,parent:{},realm:()=> 'EUII',
   hook(kind,handler){listeners[name+':'+kind]=handler;return ()=>{delete listeners[name+':'+kind];};},
   call(kind,to,m){assert.equal(kind,'send_cm');queue.push({to,from:name,m});return true;}};
  const bot={p,cfg,me:{name,group:'team1'},session:name+'-session',running:true,journal:null,
   inventoryBlocked:false,exec:{pending:new Map()},logistics:{summary:()=>[],reserved:false},
   free:()=>40,monsters:()=>[],report(){},event(){}};
  bots[name]={bot,transport:createTransport(bot)};
 }
 return {bots,queue,listeners,deliver(){while(queue.length){const {to,from,m}=queue.shift();listeners[to+':on_cm']?.(from,m);}}};
}

test('transport confirms bidirectional receipt but distinguishes adapter success from peer delivery',async()=>{
 const f=fixture(),a=f.bots.Ranger.transport,b=f.bots.Merchant.transport;
 assert.equal(a.status().peers[0].seen,false);
 a.heartbeat();b.heartbeat();await Promise.resolve();
 assert.equal(a.status().counters.heartbeatAttempts,1);
 assert.equal(a.status().counters.heartbeatSent,1);
 assert.equal(a.status().counters.heartbeatReceived,0);
 f.deliver();
 for(const [own,other] of [[a,'Merchant'],[b,'Ranger']]){
  const s=own.status();assert.equal(s.counters.heartbeatReceived,1);
  assert.equal(s.peers.length,1);assert.equal(s.peers[0].name,other);
  assert.equal(s.peers[0].fresh,true);assert.equal(s.peers[0].running,true);
  assert.equal(s.peers[0].realm,'EUII');assert.equal(s.peers[0].heartbeatReceived,1);
  assert.equal(s.peers[0].heartbeatSent,1);assert.equal(s.peers[0].session,other+'-session');
  assert.equal('goldBalance' in s.peers[0],false);assert.equal('items' in s.peers[0],false);
 }
 a.close();b.close();assert.equal(f.listeners['Ranger:on_cm'],undefined);
 assert.equal(f.listeners['Merchant:on_cm'],undefined);
});

test('duplicates and expired/outsider packets cannot inflate accepted heartbeat counter',async()=>{
 const f=fixture(),a=f.bots.Ranger.transport,b=f.bots.Merchant.transport;
 a.heartbeat();await Promise.resolve();const packet=f.queue[0];f.deliver();
 f.listeners['Merchant:on_cm']('Ranger',packet.m);
 assert.equal(b.status().counters.duplicates,1);
 assert.equal(b.status().counters.heartbeatReceived,1);
 const expired=structuredClone(packet.m);expired.seq++;expired.time=Date.now()-11000;
 f.listeners['Merchant:on_cm']('Ranger',expired);
 assert.equal(b.status().counters.rejected,1);assert.equal(b.status().counters.heartbeatReceived,1);
 const outsider=structuredClone(packet.m);outsider.seq++;outsider.from='Unknown';
 f.listeners['Merchant:on_cm']('Unknown',outsider);
 assert.equal(b.status().counters.rejected,2);
 a.close();b.close();
});

test('adapter rejection and exception remain send failures, not sent heartbeats',async()=>{
 const f=fixture(),a=f.bots.Ranger.transport,b=f.bots.Merchant.transport;
 f.bots.Ranger.bot.p.call=()=>({success:false});
 a.heartbeat();await Promise.resolve();
 let s=a.status();
 assert.equal(s.counters.heartbeatAttempts,1);assert.equal(s.counters.heartbeatSent,0);
 assert.equal(s.counters.sendFailed,1);assert.equal(s.lastFailure.reason,'rejected');
 assert.equal(s.peers[0].sendFailed,1);
 f.bots.Ranger.bot.p.call=()=>Promise.reject(Error('simulated'));
 a.heartbeat();await Promise.resolve();await Promise.resolve();
 s=a.status();assert.equal(s.counters.sendFailed,2);
 assert.equal(s.lastFailure.reason,'exception');assert.equal(s.counters.heartbeatReceived,0);
 a.close();b.close();
});

test('stale peers become nonfresh without changing their historical counters',async()=>{
 const f=fixture(),a=f.bots.Ranger.transport,b=f.bots.Merchant.transport;
 a.heartbeat();await Promise.resolve();f.deliver();
 assert.ok(b.fresh('Ranger'));b.peers.get('Ranger').received=Date.now()-10001;
 assert.equal(b.status().peers[0].fresh,false);assert.equal(b.fresh('Ranger'),null);
 assert.equal(b.status().counters.heartbeatReceived,1);
 a.close();b.close();
});

test('IPC-only configuration without IPC records a failed transport attempt',async()=>{
 const f=fixture(),a=f.bots.Ranger.transport,b=f.bots.Merchant.transport;
 f.bots.Ranger.bot.cfg.general.transport='ipc';
 a.heartbeat();await Promise.resolve();
 const s=a.status();assert.equal(s.counters.heartbeatSent,0);assert.equal(s.counters.sendFailed,1);
 assert.equal(s.lastFailure.reason,'channel');assert.equal(f.queue.length,0);
 a.close();b.close();
});

test('repeatedly unreachable offline character is probed sparingly while active peers stay fresh',async()=>{
 const f=fixture(['Ranger','Merchant','OfflineWarrior']),entry=f.bots.Ranger,send=entry.bot.p.call;
 // A configured, inactive teammate is still discoverable on initial probes.
 const sent=[];entry.bot.p.call=(kind,to,m)=>{
  sent.push(to);
  return to==='OfflineWarrior'?{receivers:[]}:send(kind,to,m);
 };
 for(let k=0;k<8;k++){
  entry.transport.heartbeat();
  await Promise.resolve();
  await Promise.resolve();
 }
 assert.ok(sent.filter(n=>n==='OfflineWarrior').length<=3,
  'offline peer receives initial checks then at most one 30-second discovery probe');
 assert.equal(sent.filter(n=>n==='Merchant').length,8,
  'healthy team links remain unthrottled');
 entry.transport.close();f.bots.Merchant.transport.close();f.bots.OfflineWarrior.transport.close();
});
