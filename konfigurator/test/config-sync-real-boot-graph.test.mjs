import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditRealRuntimeBootGraph,RESTART_BOOT_BLOCKERS}
 from '../../scripts/audit-config-restart-boot-graph.mjs';
const source=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');

test('real runtime bootstrap has at least 75 actual controller factory wiring edges, not a synthetic substitute',()=>{
 const r=auditRealRuntimeBootGraph(source);
 assert.equal(r.format,'albot-real-runtime-boot-graph-audit/v1');
 assert.ok(r.factoryCount>=75);
 assert.equal(r.controllerFactories.length,r.factoryCount);
 const slots=new Set(r.controllerFactories.map(x=>x.slot));
 for(const name of ['farmer','merchant','teamTravel','account','logistics',
  'movement','transport','bank','recovery','lootReceipts','skills'])
  assert.equal(slots.has(name),true,name);
 assert.ok(r.startupCapturedConfigSections.length>=5);
 for(const side of ['game-port-hooks','game-event-listeners',
  'window-global-events','wrapped-game-port-call','persistent-item-watchers'])
  assert.ok(r.registeredSideEffectKinds.includes(side),side);
 assert.equal(r.executorConstructed,true);
 assert.equal(r.shutdownHandlerObserved,true);
 assert.equal(r.cleanupRegistrationsObserved,true);
 assert.equal(r.bootGraphObserved,true);
 for(const field of ['liveControllerRebuildCovered','actualRollbackCertified',
  'readyForActivation','restartAuthorized','transactionCommitted',
  'applied','acknowledged'])assert.equal(r[field],false,field);
 assert.deepEqual(r.blockers,RESTART_BOOT_BLOCKERS);
 assert.equal(JSON.stringify(r).includes('ALBotConfig'),false);
});

test('deleting a real bot factory causes audit failure; spoofing with comments cannot satisfy it',()=>{
 const modified=source.replace(/bot\.farmer=createFarmer\(bot\)/,
  "/* bot.farmer=createFarmer(bot) */");
 assert.notEqual(modified,source);
 assert.throws(()=>auditRealRuntimeBootGraph(modified),
  /required-live-factory-missing/);
 // Removing a single required factory with valid JavaScript must fail
 // the AST-based required factory invariant, not just the parser.
 const many=source.replace('bot.merchant=createMerchant(bot)',
  'bot.merchant=null');
 assert.notEqual(many,source);
 assert.throws(()=>auditRealRuntimeBootGraph(many),
  /required-live-factory-missing|factory-count-dropped/);
});

test('critical side-effect wiring can never disappear silently from rollback risk inventory',()=>{
 for(const [needle,replacement] of [
  ["p.call=recordingPortCall;","p.callWrapper=recordingPortCall;"],
  ["p.hook('on_party_invite'","p.hookDisabled('on_party_invite'"],
  ["game.on(event,handler)","game.onDisabled(event,handler)"],
  ["root.addEventListener(type,handler)","root.addEventListenerDisabled(type,handler)"],
  ["p.watchChestOpened?.(row=>","p.watchChestIgnored?.(row=>"],
  ["const exec=new Executor(","const exec=new FakeExecutor("]
 ]){
  assert.ok(source.includes(needle),needle);
  let changed=source.replace(needle,replacement);
  if(needle==="p.hook('on_party_invite'")
   changed=changed.replaceAll("p.hook('on_party_request'","p.hookDisabled('on_party_request'")
    .replaceAll("p.hook('on_magiport'","p.hookDisabled('on_magiport'");
  if(needle==="p.watchChestOpened?.(row=>")
   changed=changed.replace("p.watchOwnTradeSwaps?.(data=>","p.watchSwapsIgnored?.(data=>");
  assert.throws(()=>auditRealRuntimeBootGraph(changed),
   /Real controller graph audit incomplete/,needle);
 }
});

test('malformed main, missing boot boundaries and fake constructed graph fail closed',()=>{
 for(const invalid of [
  null,'',source.slice(0,700),
  source.replace('const bot={','const unrelated={'),
  source.replace('function tick(','function unavailable(')
 ])assert.throws(()=>auditRealRuntimeBootGraph(invalid));
});

test('published rehearsal never promotes real boot coverage into an apply guarantee',async()=>{
 const src=await readFile(new URL('../../src/runtime/config-sync-recovery-rehearsal.mjs',import.meta.url),'utf8');
 for(const key of ['controllerReconstructionTested:false',
  'remoteAccountRollbackVerified:false','transactionCommitted:false',
  'readyForActivation:false','applied:false','acknowledged:false'])
  assert.ok(src.includes(key),key);
 const main=source.slice(source.indexOf('rehearseConfigRestartRecovery:async()=>'));
 assert.ok(main.includes('configRestartIntent.status()'));
 assert.ok(main.includes('configActivationPreflight()'));
 assert.doesNotMatch(main.slice(0,main.indexOf('openConfigSync(){')),
  /bot\.cfg\s*=|ALBotConfig\s*=|appliedHighwater\s*=/);
});
