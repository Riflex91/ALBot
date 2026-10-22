import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveLifecycle,validCaveLifecycleRecord,
 caveLifecycleDisposition} from '../src/world/cave-lifecycle.mjs';
import {Executor} from '../src/core/executor.mjs';

const time=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const liveRun=(r=run,floor=1)=>({run:r,floor,
 map:`zone_${r}_${floor}`,roster:[
  {name:'P',left:false,disconnected:false}]});
const preflight=(mode='new')=>({
 mode,run:mode==='new'?null:run,party:['P'],
 localConditionsMet:true,requiresJournal:true,
 executable:false,serverVerified:false});
function fixture({store=new Map(),name='P',realm='EUI',
 session='s1',mode='new',write=true,read=true}={}){
 const writes=[],calls=[],state={at:time,live:null,preflight:preflight(mode)};
 const readFromStore=key=>{
  if(!read)throw Error('storage read');
  return store.has(key)?structuredClone(store.get(key)):null;
 };
 const p={realm:()=>realm,read:readFromStore,
  readCaveJournal:readFromStore,
  write:(key,value)=>{
  writes.push([key,value]);
  if(!write)return false;
  store.set(key,structuredClone(value));return true;
 },call:name=>{calls.push(name);throw Error('no Cave mutation permitted')}};
 const bot={p,me:{name},session,running:true,
  cave:{status:()=>({entryPreflight:state.preflight,live:state.live})}};
 const lifecycle=createCaveLifecycle(bot,{now:()=>state.at});
 return {store,writes,calls,p,bot,state,lifecycle};
}
test('N12 only durable prepared intent can be staged; never dispatch automatically',()=>{
 const f=fixture();
 assert.equal(f.lifecycle.status().blocked,false);
 assert.equal(f.lifecycle.prepare(),true);
 const status=f.lifecycle.status();
 assert.equal(status.state,'prepared');
 assert.equal(status.blocked,true);
 assert.equal(status.executable,false);
 assert.equal(status.journal.mode,'new');
 assert.equal(status.journal.dispatchAt,null);
 assert.equal(status.journal.observed,null);
 assert.equal(validCaveLifecycleRecord(status.journal),true);
 assert.equal(f.lifecycle.prepare(),false,'the same entry cannot be prepared twice');
 assert.deepEqual(f.calls,[],'neither preparation nor status calls cave_enter');
 assert.equal(f.lifecycle.discardPrepared(),true,
  'only a locally prepared, non-dispatched entry may be discarded');
 assert.equal(f.lifecycle.status().blocked,false);
 assert.equal(f.lifecycle.status().journal,null);
});

test('N12 prepared Cave intent survives bot restart and forbids a second entry',()=>{
 const a=fixture();
 assert.equal(a.lifecycle.prepare(),true);
 a.lifecycle.close();
 const b=fixture({store:a.store,session:'restart'});
 assert.equal(b.lifecycle.status().state,'prepared');
 assert.equal(b.lifecycle.status().blocked,true);
 assert.equal(b.lifecycle.prepare(),false);
 assert.equal(b.lifecycle.discardPrepared(),false,
  'old session cannot casually erase uncertain predecessor state');
 assert.equal(b.lifecycle.markDispatchUnknown(),false,
  'old session never inherits the permission to send the action');
 assert.deepEqual(b.calls,[]);
});

test('N12 a marked RPC may never be replayed after restart or API ambiguity',()=>{
 const a=fixture({mode:'resume'});
 assert.equal(a.lifecycle.prepare(),true);
 assert.equal(a.lifecycle.markDispatchUnknown(),true);
 const s=a.lifecycle.status();
 assert.equal(s.state,'dispatch-unknown');
 assert.equal(s.journal.mode,'resume');
 assert.equal(s.journal.run,run);
 assert.equal(s.journal.dispatchAt,time);
 assert.equal(a.lifecycle.markDispatchUnknown(),false);
 assert.equal(a.lifecycle.discardPrepared(),false);
 a.lifecycle.close();
 const b=fixture({store:a.store,session:'restart'});
 assert.equal(b.lifecycle.status().state,'dispatch-unknown');
 assert.equal(b.lifecycle.status().blocked,true);
 assert.equal(b.lifecycle.prepare(),false);
 assert.equal(b.lifecycle.markDispatchUnknown(),false);
 assert.equal(b.lifecycle.discardPrepared(),false);
 assert.deepEqual([...a.calls,...b.calls],[]);
});

test('N12 a physical same-run server snapshot proves observation, never an RPC success',()=>{
 const f=fixture({mode:'resume'});
 f.lifecycle.prepare();f.lifecycle.markDispatchUnknown();
 f.state.live=liveRun();
 f.lifecycle.sample();
 const status=f.lifecycle.status();
 assert.equal(status.state,'live-observed');
 assert.equal(status.journal.phase,'observed-run');
 assert.equal(status.journal.observed.run,run);
 assert.equal(status.journal.observed.floor,1);
 f.state.live=null;
 assert.equal(f.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(f.lifecycle.status().reason,'exit-not-proven');
 f.lifecycle.close();
 const reboot=fixture({store:f.store,session:'reboot'});
 assert.equal(reboot.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(reboot.lifecycle.status().blocked,true);
 assert.equal(reboot.lifecycle.prepare(),false);
});

test('N12 an unexpected resume run cannot settle the original durable intent',()=>{
 const f=fixture({mode:'resume'});
 f.lifecycle.prepare();f.lifecycle.markDispatchUnknown();
 f.state.live=liveRun(other);
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().state,'conflict');
 assert.equal(f.lifecycle.status().reason,'resume-run-mismatch');
 assert.equal(f.lifecycle.status().journal.phase,'dispatch-unknown');
 assert.equal(f.lifecycle.discardPrepared(),false);
});

test('N12 a preexisting observed Cave run is durably held even without bot dispatch',()=>{
 const f=fixture();
 f.state.live=liveRun();
 f.lifecycle.sample();
 const s=f.lifecycle.status();
 assert.equal(s.state,'live-observed');
 assert.equal(s.journal.mode,'observed');
 assert.equal(s.journal.dispatchAt,null,
  'a prior server run is not fabricated as a local Cave RPC');
 assert.equal(s.journal.run,run);
 f.lifecycle.close();
 const reboot=fixture({store:f.store,session:'restart'});
 assert.equal(reboot.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(reboot.lifecycle.status().blocked,true);
 assert.equal(reboot.lifecycle.prepare(),false);
});

test('N12 prepared new entry with observed run does not invent a dispatch receipt',()=>{
 const f=fixture();f.lifecycle.prepare();
 f.state.live=liveRun();
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().journal.dispatchAt,null);
 assert.equal(f.lifecycle.status().journal.phase,'observed-run');
 assert.equal(f.lifecycle.discardPrepared(),false);
});

test('N12 invalid or foreign durable records remain quarantined across restarts',()=>{
 const a=fixture();a.lifecycle.prepare();
 const key='albot:cave-lifecycle:P';
 const original=a.store.get(key);
 for(const record of [
  {...original,phase:'dispatch-unknown',dispatchAt:null},
  {...original,run:other},
  {...original,party:['P','P']},
  {...original,name:'someone-else'},
  {...original,createdAt:Infinity},
  {...original,phase:'observed-run',observed:null}
 ]){
  const store=new Map([[key,record]]);
  const f=fixture({store,session:'restart'});
  assert.equal(f.lifecycle.status().blocked,true);
  assert.equal(f.lifecycle.prepare(),false);
  assert.equal(f.lifecycle.discardPrepared(),false);
  assert.equal(f.writes.length,0);
 }
 const foreign=fixture({store:a.store,realm:'USII',session:'restart'});
 assert.equal(foreign.lifecycle.status().state,'scope-mismatch');
 assert.equal(foreign.lifecycle.status().blocked,true);
 assert.equal(foreign.writes.length,0);
 assert.equal(caveLifecycleDisposition(original,{
  name:'P',realm:'EUI'}).state,'prepared');
});

test('N12 unknown persistence and rejected writes fail closed without sending an action',()=>{
 const unreadable=fixture({read:false});
 assert.equal(unreadable.lifecycle.status().state,'storage-uncertain');
 assert.equal(unreadable.lifecycle.prepare(),false);
 const rejected=fixture({write:false});
 assert.equal(rejected.lifecycle.prepare(),false);
 assert.equal(rejected.lifecycle.status().state,'storage-uncertain');
 assert.equal(rejected.lifecycle.prepare(),false);
 assert.deepEqual(rejected.calls,[]);
 const restored=fixture({store:rejected.store,session:'restart'});
 assert.equal(restored.lifecycle.status().state,'empty',
  'failed write did not create a fake durable record');
});

test('N12 concurrent local state drift never overwrites an already changed journal',()=>{
 const f=fixture();
 f.store.set('albot:cave-lifecycle:P',{
  version:1,mode:'new',run:null,party:['P'],
  name:'P',realm:'EUI',session:'other',createdAt:time,
  phase:'prepared',dispatchAt:null,observed:null
 });
 assert.equal(f.lifecycle.prepare(),false);
 assert.equal(f.lifecycle.status().state,'storage-uncertain');
 assert.equal(f.store.get('albot:cave-lifecycle:P').session,'other');
});

test('N12 only same-session preflight can authorize the future durable dispatch boundary',()=>{
 const f=fixture();f.lifecycle.prepare();
 f.state.preflight.localConditionsMet=false;
 assert.equal(f.lifecycle.markDispatchUnknown(),false);
 assert.equal(f.lifecycle.status().state,'prepared');
 f.state.preflight.localConditionsMet=true;
 f.bot.session='changed';
 assert.equal(f.lifecycle.markDispatchUnknown(),false);
 assert.equal(f.lifecycle.discardPrepared(),false);
 assert.deepEqual(f.calls,[]);
});

function readyOneShot(f,respond=()=>({
 place:'enter',success:true,run,expires:time+500000,level:60
})){
 f.p.has=name=>name==='cave_enter';
 f.p.call=name=>{f.calls.push(name);return respond();};
 f.bot.exec=new Executor({
  now:()=>f.state.at,active:()=>f.bot.running,limit:3,
  admit:()=>true,onError:()=>{},onEvent:()=>{}
 });
 return f;
}

test('N12 explicit cave_enter is sent ONCE only after durable dispatch checkpoint',async()=>{
 const f=readyOneShot(fixture());
 assert.equal(f.lifecycle.requestEntry(),false,'must not send before prepared');
 assert.equal(f.lifecycle.prepare(),true);
 assert.equal(f.lifecycle.requestEntry(),true,'accepted by Executor, NOT a success receipt');
 assert.deepEqual(f.calls,['cave_enter']);
 assert.equal(f.lifecycle.status().journal.phase,'dispatch-unknown');
 assert.equal(f.lifecycle.status().journal.dispatchAt,time);
 assert.equal(f.lifecycle.requestEntry(),false);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 const st=f.lifecycle.status();
 assert.equal(st.journal.phase,'dispatch-unknown',
  'server reply alone never proves character is inside');
 assert.deepEqual(st.journal.serverReply,{
  run,expires:time+500000,level:60,at:time
 });
 assert.equal(st.blocked,true);
 assert.equal(f.lifecycle.discardPrepared(),false);
 f.bot.exec.poll();
 assert.deepEqual(f.calls,['cave_enter']);
});

test('N12 a physical server Cave map settles an explicit Cave entry once',async()=>{
 const f=readyOneShot(fixture());
 assert.equal(f.lifecycle.prepare(),true);
 assert.equal(f.lifecycle.requestEntry(),true);
 await Promise.resolve();await Promise.resolve();
 f.state.live=liveRun();
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().state,'live-observed');
 assert.equal(f.lifecycle.status().journal.phase,'observed-run');
 assert.equal(f.lifecycle.status().journal.serverReply.run,run);
 f.bot.exec.poll();
 f.state.live=null;
 assert.equal(f.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(f.lifecycle.requestEntry(),false);
 const reboot=fixture({store:f.store,session:'reboot'});
 assert.equal(reboot.lifecycle.status().blocked,true);
 assert.equal(reboot.lifecycle.status().state,'run-not-currently-visible');
 assert.deepEqual([...f.calls,...reboot.calls],['cave_enter']);
});

test('N12 failed, thrown, or rejected Cave RPC remains ambiguous without replay',async()=>{
 for(const reply of [
  ()=>{throw Error('socket dropped');},
  ()=>Promise.reject(Error('timeout')),
  ()=>({place:'enter',failed:true,reason:'already_inside'}),
  ()=>({success:false,run,expires:time+500000,level:60}),
  ()=>({success:true,run:'invalid',expires:time+500000,level:60})
 ]){
  const f=readyOneShot(fixture(),reply);
  assert.equal(f.lifecycle.prepare(),true);
  assert.equal(f.lifecycle.requestEntry(),true);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  f.bot.exec.poll();
  assert.equal(f.lifecycle.status().journal.phase,'dispatch-unknown');
  assert.equal(f.lifecycle.status().journal.serverReply??null,null);
  assert.equal(f.lifecycle.discardPrepared(),false);
  assert.equal(f.lifecycle.requestEntry(),false);
  assert.deepEqual(f.calls,['cave_enter']);
 }
});

test('N12 no durable dispatch checkpoint means no Cave API send',()=>{
 const f=readyOneShot(fixture({write:false}));
 assert.equal(f.lifecycle.prepare(),false);
 assert.equal(f.lifecycle.requestEntry(),false);
 assert.equal(f.calls.length,0);
 const good=readyOneShot(fixture());
 assert.equal(good.lifecycle.prepare(),true);
 good.p.write=()=>false;
 assert.equal(good.lifecycle.requestEntry(),true,
  'Executor can accept the action, but invoke fails before the API call');
 assert.equal(good.calls.length,0);
 assert.equal(good.lifecycle.status().state,'storage-uncertain');
 assert.equal(good.lifecycle.requestEntry(),false);
});

test('N12 explicit dispatch rejects drift, value locks and unavailable official endpoint',()=>{
 const denial=[
  f=>{f.bot.journal={kind:'sell'};},
  f=>{f.bot.inventoryBlocked=true;},
  f=>{f.bot.lifecycleChanging=true;},
  f=>{f.bot.bank={pending:true};},
  f=>{f.bot.logistics={reserved:true};},
  f=>{f.bot.teamTravel={blocked:true};},
  f=>{f.bot.account={rotationPending:()=>true};},
  f=>{f.bot.session='new';},
  f=>{f.state.preflight={...f.state.preflight,mode:'resume',run};},
  f=>{f.state.preflight={...f.state.preflight,party:['P','R']};},
  f=>{f.state.preflight={...f.state.preflight,localConditionsMet:false};},
  f=>{f.state.live=liveRun();},
  f=>{f.p.has=()=>false;},
  f=>{f.p.has=()=>{throw Error('missing capability');};}
 ];
 for(const mutate of denial){
  const f=readyOneShot(fixture());
  assert.equal(f.lifecycle.prepare(),true);
  mutate(f);
  assert.equal(f.lifecycle.requestEntry(),false,
   'cannot enter when one of the original admission assumptions changes');
  assert.equal(f.calls.length,0);
  assert.equal(f.lifecycle.status().journal.phase,'prepared');
 }
});

test('N12 a positive Cave API run receipt cannot be confused with another live run',async()=>{
 const f=readyOneShot(fixture());
 f.lifecycle.prepare();f.lifecycle.requestEntry();
 await Promise.resolve();await Promise.resolve();
 f.state.live=liveRun(other);
 assert.equal(f.lifecycle.status().state,'conflict');
 assert.equal(f.lifecycle.status().reason,'server-reply-run-mismatch');
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().journal.phase,'dispatch-unknown');
 assert.equal(f.lifecycle.status().journal.serverReply.run,run);
 assert.equal(f.lifecycle.requestEntry(),false);
});

test('N12 stale or conflicting Cave API receipts cannot rewrite a different session',async()=>{
 let resolve;
 const response=new Promise(r=>{resolve=r});
 const f=readyOneShot(fixture(),()=>response);
 f.lifecycle.prepare();f.lifecycle.requestEntry();
 f.bot.session='restarted';
 resolve({place:'enter',success:true,run,
  expires:time+500000,level:60});
 await response;await Promise.resolve();await Promise.resolve();
 assert.equal(f.lifecycle.status().journal.serverReply??null,null);
 assert.equal(f.lifecycle.status().blocked,true);
 assert.equal(f.calls.length,1);
});

test('N12 server-generated run ID is accepted only for a new run, not a mismatched resume',async()=>{
 const newEntry=readyOneShot(fixture(),()=>({
  place:'enter',success:true,run:other,expires:time+500000,level:42
 }));
 newEntry.lifecycle.prepare();
 assert.equal(newEntry.lifecycle.requestEntry(),true);
 await Promise.resolve();await Promise.resolve();
 assert.equal(newEntry.lifecycle.status().journal.serverReply.run,other);
 assert.equal(newEntry.lifecycle.status().journal.phase,'dispatch-unknown');
 const resume=readyOneShot(fixture({mode:'resume'}),()=>({
  place:'enter',success:true,run:other,expires:time+500000,level:42
 }));
 resume.lifecycle.prepare();
 assert.equal(resume.lifecycle.requestEntry(),true);
 await Promise.resolve();await Promise.resolve();
 assert.equal(resume.lifecycle.status().journal.serverReply??null,null);
 assert.equal(resume.lifecycle.status().journal.phase,'dispatch-unknown');
 assert.equal(resume.lifecycle.requestEntry(),false);
});

test('N12 startup requires strict Cave journal reader; generic get fallback is insufficient',()=>{
 const fixtureMissing=fixture();
 // Existing adapter gets strict capability when constructed; verify the
 // constructor never interprets a thrown strict raw read as empty journal.
 const broken={
  p:{...fixtureMissing.p,read:()=>null,
   readCaveJournal:()=>{throw Error('malformed cave storage');}},
  me:{name:'P'},running:true,session:'restart',
  cave:{status:()=>({entryPreflight:preflight(),live:null})}
 };
 const journal=createCaveLifecycle(broken,{now:()=>time});
 assert.equal(journal.status().state,'storage-uncertain');
 assert.equal(journal.prepare(),false);
 assert.equal(journal.requestEntry(),false);
 assert.equal(journal.discardPrepared(),false);
 const unsupported={
  ...broken,p:{...fixtureMissing.p,read:()=>null,
   readCaveJournal:undefined}
 };
 const noStrict=createCaveLifecycle(unsupported,{now:()=>time});
 assert.equal(noStrict.status().state,'storage-uncertain');
 assert.equal(noStrict.prepare(),false);
});

test('N12 strict read failure during dispatch checkpoint cannot cause a Cave call',()=>{
 const f=readyOneShot(fixture());
 assert.equal(f.lifecycle.prepare(),true);
 // Generic get() would report no journal; strict read must report the
 // actual corrupted/unavailable durable store instead.
 f.p.read=()=>null;
 f.p.readCaveJournal=()=>{throw Error('temporary storage read failure');};
 assert.equal(f.lifecycle.requestEntry(),true,
  'Executor accepts work but no server mutation runs');
 assert.equal(f.calls.length,0);
 assert.equal(f.lifecycle.status().state,'storage-uncertain');
 assert.equal(f.lifecycle.requestEntry(),false);
});


test('W12/N12 Cave entry and exit cannot overlap an unresolved Crypt journal',()=>{
 const f=readyOneShot(fixture());
 f.bot.cryptLifecycle={status:()=>({blocked:true,state:'dispatch-unknown'})};
 assert.equal(f.lifecycle.prepare(),false,
  'a possibly consumed Crypt key forbids new Cave preparation');
 assert.deepEqual(f.calls,[]);
 f.bot.cryptLifecycle.status=()=>({blocked:false,state:'empty'});
 assert.equal(f.lifecycle.prepare(),true);
 f.bot.cryptLifecycle.status=()=>({blocked:true,state:'inside-observed'});
 assert.equal(f.lifecycle.markDispatchUnknown(),false);
 assert.equal(f.lifecycle.requestEntry(),false);
 assert.equal(f.lifecycle.status().state,'prepared');
 assert.deepEqual(f.calls,[]);
 f.bot.cryptLifecycle.status=()=>({blocked:false,state:'empty'});
 assert.equal(f.lifecycle.requestEntry(),true,
  'a genuinely settled alternate admission permits the old prepared Cave');
 assert.deepEqual(f.calls,['cave_enter']);
});

test('N12 stale never-dispatched Cave new-entry checkpoint clears only after fresh cave_info',()=>{
 const shared=new Map(),first=fixture({store:shared});
 assert.equal(first.lifecycle.prepare(),true);
 assert.equal(first.lifecycle.status().state,'prepared');
 const second=fixture({store:shared,session:'restarted'});
 second.state.at=time+2000;
 second.p.c={name:'P',map:'main',in:'main',cave:null,rip:false};
 second.bot.exec={pending:new Map()};
 second.bot.cave.status=()=>({live:second.state.live,
  entryPreflight:second.state.preflight,
  visit:{available:true,resume:null,
   observedAt:second.state.at,serverTime:second.state.at}});
 second.lifecycle.sample();
 assert.equal(second.lifecycle.status().state,'empty');
 assert.equal(shared.get('albot:cave-lifecycle:P'),null);
 assert.deepEqual([...first.calls,...second.calls],[],
  'clearing an un-dispatched checkpoint never sends cave_enter');
 assert.equal(second.lifecycle.prepare(),true,
  'a separate new explicit entry preparation is required');
});

test('N12 stale prepared Cave checkpoint cannot clear on missing/stale/conflicting visit',()=>{
 for(const kind of ['missing-visit','stale-visit','before-prepare',
  'permission-used','new-resume','party-changed','other-realm',
  'crypt-pending','vote-pending','busy','outside','no-executor']){
  const store=new Map(),first=fixture({store});
  assert.equal(first.lifecycle.prepare(),true);
  const second=fixture({store,session:'after-restart'});
  second.state.at=time+4000;
  second.p.c={name:'P',map:'main',in:'main',cave:null,rip:false};
  second.bot.exec={pending:new Map()};
  let v={available:true,resume:null,observedAt:time+4000,
   serverTime:time+4000};
  if(kind==='missing-visit')v=null;
  if(kind==='stale-visit')v={...v,observedAt:time-35000};
  if(kind==='before-prepare')v={...v,observedAt:time};
  if(kind==='permission-used')v={...v,available:false};
  if(kind==='new-resume')v={...v,resume:{run,server:'EUI'}};
  if(kind==='party-changed')second.state.preflight={...preflight(),
   party:['P','R']};
  if(kind==='other-realm')second.p.realm=()=> 'USI';
  if(kind==='crypt-pending')
   second.bot.cryptLifecycle={status:()=>({blocked:true})};
  if(kind==='vote-pending')
   second.bot.caveVoteJournal={status:()=>({blocked:true})};
  if(kind==='busy')second.bot.exec.pending.set('work',true);
  if(kind==='outside')second.p.c.map='bank';
  if(kind==='no-executor')delete second.bot.exec;
  second.bot.cave.status=()=>({live:null,
   entryPreflight:second.state.preflight,visit:v});
  second.lifecycle.sample();
  assert.equal(second.lifecycle.status().blocked,true,kind);
  assert.equal(store.get('albot:cave-lifecycle:P')?.phase,'prepared',kind);
  assert.deepEqual(second.calls,[],kind);
 }
});

test('N12 a dispatched cave_enter is never cleared by a later fresh visit',()=>{
 const store=new Map(),first=fixture({store});
 assert.equal(first.lifecycle.prepare(),true);
 assert.equal(first.lifecycle.markDispatchUnknown(),true);
 const after=fixture({store,session:'reboot'});
 after.state.at=time+2000;
 after.p.c={name:'P',map:'main',in:'main'};
 after.bot.exec={pending:new Map()};
 after.bot.cave.status=()=>({live:null,entryPreflight:preflight(),
  visit:{available:true,resume:null,observedAt:time+2000,serverTime:time+2000}});
 after.lifecycle.sample();
 assert.equal(after.lifecycle.status().state,'dispatch-unknown');
 assert.equal(store.get('albot:cave-lifecycle:P')?.phase,'dispatch-unknown');
 assert.deepEqual(after.calls,[]);
});

test('N12 resumed run prepared checkpoint needs the same fresh server resumable run',()=>{
 const store=new Map(),first=fixture({store,mode:'resume'});
 assert.equal(first.lifecycle.prepare(),true);
 const second=fixture({store,session:'restart',mode:'resume'});
 second.state.at=time+2000;
 second.p.c={name:'P',map:'main',in:'main',cave:null};
 second.bot.exec={pending:new Map()};
 let v={available:false,resume:{run:other,server:'EUI'},
  observedAt:time+2000,serverTime:time+2000};
 second.bot.cave.status=()=>({live:null,
  entryPreflight:second.state.preflight,visit:v});
 second.lifecycle.sample();
 assert.equal(second.lifecycle.status().state,'prepared');
 v={...v,resume:{run,server:'USI'}};
 second.lifecycle.sample();
 assert.equal(second.lifecycle.status().state,'prepared');
 v={...v,resume:{run,server:'EUI'}};
 second.lifecycle.sample();
 assert.equal(second.lifecycle.status().state,'empty');
 assert.deepEqual(second.calls,[]);
});

test('N12 strict journal race prevents stale prepared cleanup',()=>{
 const store=new Map(),first=fixture({store});
 first.lifecycle.prepare();
 const second=fixture({store,session:'restart'});
 second.state.at=time+2000;
 second.p.c={name:'P',map:'main',in:'main'};
 second.bot.exec={pending:new Map()};
 second.bot.cave.status=()=>({live:null,entryPreflight:preflight(),
  visit:{available:true,resume:null,observedAt:time+2000,
   serverTime:time+2000}});
 store.set('albot:cave-lifecycle:P',{...store.get('albot:cave-lifecycle:P'),
  createdAt:time+1});
 second.lifecycle.sample();
 assert.equal(second.lifecycle.status().state,'storage-uncertain');
 assert.equal(store.get('albot:cave-lifecycle:P')?.createdAt,time+1);
 assert.deepEqual(second.calls,[]);
});
