import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createHopLifecycle} from '../src/party/hop-lifecycle.mjs';

async function clocked(run){
 const real=Date.now;let now=1000000;Date.now=()=>now;
 try{await run({advance:ms=>{now+=ms;},now:()=>now});}
 finally{Date.now=real;}
}
function fixture(now,invoke=()=>Promise.resolve(true)){
 const store=new Map(),events=[],errors=[],calls=[];
 let realm='EUII',normal=true,canWrite=true;
 const p={c:{name:'My_Ranger1'},parent:{socket:{connected:true}},
  realm:()=>realm,read:key=>store.get(key)??null,
  write:(key,value)=>{if(!canWrite)return false;store.set(key,structuredClone(value));return true;},
  call:(name,...args)=>{calls.push([name,...args]);return invoke(calls.length);}};
 const bot={p,me:{name:'My_Ranger1'},running:true,lifecycleChanging:false,
  movement:{stop(){}},journal:null,inventoryBlocked:false,logistics:{reserved:false},
  event:(name,data)=>events.push({name,data})};
 bot.exec=new Executor({now,active:()=>bot.running,limit:4,
  retryDelay:()=>3000,onEvent:()=>{},onError:(key,e)=>errors.push([key,String(e?.message??e)])});
 const make=()=>createHopLifecycle(bot,{destinationNormal:to=>to==='USII'&&normal,
  safe:()=>bot.running&&!bot.lifecycleChanging&&!bot.exec.pending.size&&!bot.inventoryBlocked});
 const plan={id:'team:hop:1',from:'EUII',to:'USII'};
 return {bot,p,store,calls,events,errors,make,plan,setRealm:v=>realm=v,
  setNormal:v=>normal=v,setWritable:v=>canWrite=v};
}

test('rejected change_server is reported, retried once, then confirmed by observed realm',async()=>{
 await clocked(async t=>{
  const f=fixture(t.now,n=>n===1?Promise.reject(new Error('gateway down')):Promise.resolve(true));
  const lifecycle=f.make();
  assert.equal(lifecycle.begin(f.plan),true);
  assert.deepEqual(f.calls[0],['change_server','US','II']);
  assert.equal(f.bot.lifecycleChanging,true);
  await Promise.resolve();f.bot.exec.poll();
  assert.equal(f.bot.lifecycleChanging,false,'bot must not stay suspended after rejection');
  assert.equal(lifecycle.status().phase,'retry-wait');
  assert.equal(lifecycle.status().attempts,1);
  assert.equal(lifecycle.status().lastError,'gateway down');
  t.advance(9999);lifecycle.tick();assert.equal(f.calls.length,1);
  t.advance(1);lifecycle.tick();assert.equal(f.calls.length,2);
  f.setRealm('USII');f.bot.exec.poll();
  assert.equal(lifecycle.blocked,false);
  assert.equal(lifecycle.status().phase,'arrived');
  assert.equal(f.events.some(e=>e.name==='server.hop.arrived'),true);
 });
});

test('resolved native call is not mistaken for a connected server',async()=>{
 await clocked(async t=>{
  const f=fixture(t.now),lifecycle=f.make();
  assert.equal(lifecycle.begin(f.plan),true);
  await Promise.resolve();t.advance(19999);f.bot.exec.poll();
  assert.equal(lifecycle.status().phase,'dispatching');
  assert.equal(f.calls.length,1);
  t.advance(1);f.bot.exec.poll();
  assert.equal(lifecycle.status().phase,'retry-wait');
  assert.equal(f.events.some(e=>e.name==='server.hop.retryScheduled'&&e.data.result==='timeout'),true);
  t.advance(10000);lifecycle.tick();assert.equal(f.calls.length,2);
 });
});

test('no fourth attempt, no retry into a subsequently disallowed target',async()=>{
 await clocked(async t=>{
  const f=fixture(t.now,()=>Promise.reject(new Error('blocked')));
  const lifecycle=f.make();lifecycle.begin(f.plan);
  for(let n=0;n<3;n++){
   await Promise.resolve();f.bot.exec.poll();
   if(n<2){t.advance(n===0?10000:20000);lifecycle.tick();}
  }
  assert.equal(f.calls.length,3);
  assert.equal(lifecycle.status().phase,'failed');
  assert.equal(lifecycle.blocked,false);
  t.advance(40000);lifecycle.tick();assert.equal(f.calls.length,3);
  const second=fixture(t.now,()=>Promise.reject(new Error('blocked')));
  const another=second.make();another.begin(second.plan);
  await Promise.resolve();second.setNormal(false);second.bot.exec.poll();
  t.advance(10000);another.tick();
  assert.equal(second.calls.length,1);
  assert.equal(another.status().phase,'failed');
 });
});

test('reload at original realm logs incomplete hop; destination boot confirms without starting another tab',async()=>{
 await clocked(async t=>{
  const f=fixture(t.now),first=f.make();first.begin(f.plan);
  t.advance(12000);
  const reloaded=f.make();
  assert.equal(reloaded.blocked,false,'old process must not self-authorize reconnect after reload');
  assert.equal(f.events.some(e=>e.name==='server.hop.boot'&&e.data.outcome==='still-on-source'),true);
  f.setRealm('USII');t.advance(3000);
  const arrived=f.make();
  assert.equal(arrived.status().phase,'arrived');
  assert.equal(f.events.some(e=>e.name==='server.hop.boot'&&e.data.outcome==='destination-online'),true);
  assert.equal(f.calls.length,1,'no remote start_character or duplicate change_server');
 });
});

test('missing durable checkpoint and unavailable socket cannot cause an untracked hop',async()=>{
 await clocked(async t=>{
  const f=fixture(t.now),lifecycle=f.make();f.setWritable(false);
  assert.equal(lifecycle.begin(f.plan),false);
  assert.deepEqual(f.calls,[]);
  f.setWritable(true);f.p.parent.socket.connected=false;
  assert.equal(lifecycle.begin(f.plan),true);
  assert.equal(lifecycle.status().phase,'retry-wait');
  assert.deepEqual(f.calls,[]);
  f.p.parent.socket.connected=true;t.advance(2000);lifecycle.tick();
  assert.equal(f.calls.length,1);
 });
});
