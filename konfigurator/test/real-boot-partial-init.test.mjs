import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPorts} from '../../src/runtime/ports.mjs';
import {createBootResourceScope} from '../../src/runtime/boot-resource-scope.mjs';
import {createSkillWakeups} from '../../src/core/skill-wakeups.mjs';

function fixture(){
 const root={parent:{},character:{name:'Farmer_1'}};
 const ports=createPorts(root),initialCall=ports.call;
 const registrations=new Map(),released=[],scope=createBootResourceScope();
 let id=0;
 const emitter={on(event,handler){const token=++id;
  registrations.set(token,{event,handler});return token;},
  remove(token){released.push(token);registrations.delete(token);}};
 return {root,ports,initialCall,registrations,released,scope,emitter};
}
test('partially failed REAL port-hook + game-listener initialization releases every owned resource',()=>{
 const x=fixture(),wake=x.scope.acquire('skill-wakeups',
  ()=>createSkillWakeups({now:()=>1000}));
 assert.equal(wake.observe('attack',1500),true);
 const replacement=()=>false;
 x.ports.call=replacement;
 x.scope.add('game-port-wrapper',()=>{
  if(x.ports.call===replacement)x.ports.call=x.initialCall;});
 assert.throws(()=>x.scope.initialize(()=>{
  x.scope.acquire('game-hit',()=>x.emitter.on('hit',()=>{}),
   {release:token=>x.emitter.remove(token)});
  x.scope.attach('party-invite',()=>x.ports.hook('on_party_invite',()=>false));
  assert.equal(typeof x.root.on_party_invite,'function');
  x.scope.acquire('game-death',()=>{throw Error('native event subscription failed');},
   {release:token=>x.emitter.remove(token)});
 }),error=>{
  assert.equal(error.message,'Boot resource initialization aborted');
  assert.equal(error.cause.message,'native event subscription failed');
  assert.equal(error.rollbackComplete,true);
  assert.equal(error.cleanupFailures,0);
  return true;
 });
 assert.equal(x.ports.call,x.initialCall);
 assert.equal(x.root.on_party_invite,undefined);
 assert.equal(x.registrations.size,0);
 assert.equal(wake.status().active,0);
 assert.deepEqual(x.released,[1]);
 assert.deepEqual(x.scope.status().releaseOrder,
  ['party-invite','game-hit','game-port-wrapper','skill-wakeups']);
 assert.equal(x.scope.status().active,0);
 assert.equal(x.scope.status().closed,true);
 assert.equal(x.scope.status().safeToReconstruct,false);
 assert.equal(x.scope.status().transactionCommitted,false);
 assert.equal(x.scope.status().applied,false);
 assert.throws(()=>x.scope.initialize(()=>{}),/unavailable/);
});

test('failed disposer never hides incomplete rollback but releases remaining owned game callbacks',()=>{
 const x=fixture();x.scope.add('older',()=>x.released.push('older'));
 assert.throws(()=>x.scope.initialize(()=>{
  x.scope.attach('bad-hook',()=>()=>{throw Error('remove failed');});
  x.scope.acquire('game-hit',()=>x.emitter.on('hit',()=>{}),
   {release:token=>x.emitter.remove(token)});
  throw Error('construction aborted');
 }),error=>{
  assert.equal(error.message,'Boot resource initialization aborted');
  assert.equal(error.cause.message,'construction aborted');
  assert.equal(error.rollbackComplete,false);
  assert.equal(error.cleanupFailures,1);
  return true;
 });
 assert.equal(x.registrations.size,0);
 assert.deepEqual(x.released,[1,'older']);
 assert.equal(x.scope.status().cleanupFailures,1);
 assert.equal(x.scope.close().closed,false);
});

test('optional registration cannot leak its subscription if ownership capacity is exceeded',()=>{
 const x=fixture(),scope=x.scope;
 for(let i=0;i<128;i++)scope.add('lease-'+i,()=>{});
 let attached=0,detached=0;
 assert.throws(()=>scope.attach('capacity',()=>{
  attached++;return ()=>detached++;
 }),/capacity exceeded/);
 assert.equal(attached,1);
 assert.equal(detached,1);
 assert.equal(scope.status().active,128);
 assert.equal(scope.close().closed,true);
});

test('constructor exception, missing subscription disposer and async registration are fail-closed',()=>{
 const x=fixture(),scope=x.scope;
 assert.throws(()=>scope.initialize(()=>{
  scope.attach('none',()=>null);
 }),/Boot resource initialization aborted/);
 assert.equal(scope.status().closed,true);
 assert.equal(scope.status().active,0);
 const y=fixture();
 assert.throws(()=>y.scope.initialize(()=>Promise.resolve(true)),
  /Boot resource initialization aborted/);
 assert.equal(y.scope.status().closed,true);
 const z=fixture();
 assert.throws(()=>z.scope.initialize(()=>{
  z.scope.acquire('throws',()=>{throw Error('factory failed');});
 }),/Boot resource initialization aborted/);
 assert.equal(z.scope.status().active,0);
});

test('runtime wiring uses a single fail-closed startup bracket and guarded actual event acquisition',async()=>{
 const source=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const start=source.indexOf('cleanup.initialize(()=>{');
 const end=source.indexOf('  });\n  // Follower-initiated requests',start);
 assert.ok(start>0&&end>start,'real hook installation inside one guarded transaction');
 const part=source.slice(start,end);
 for(const signature of [
  "cleanup.acquire('game-'+event,()=>game.on(event,handler)",
  "cleanup.acquire('merchant-merrit',()=>events.on('merrit',handler)",
  "cleanup.acquire('window-'+type,()=>root.addEventListener(type,handler)",
  "cleanup.attach('party-invite',()=>p.hook(",
  "cleanup.attach('party-request',()=>p.hook(",
  "cleanup.attach('magiport',()=>p.hook("
 ])assert.ok(part.includes(signature),signature);
 assert.equal(part.includes("bot.cfg="),false);
 assert.equal(part.includes("ALBotConfig="),false);
 const scope=await readFile(new URL('../../src/runtime/boot-resource-scope.mjs',import.meta.url),'utf8');
 assert.match(scope,/const rollback=close\(\)/);
 assert.match(scope,/aborted\.rollbackComplete=rollback\.closed/);
});
