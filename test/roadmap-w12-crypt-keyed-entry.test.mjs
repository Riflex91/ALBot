import test from 'node:test';
import assert from 'node:assert/strict';
import {createCryptLifecycle,validCryptEntryRecord} from '../src/world/crypt-lifecycle.mjs';

function cryptFixture({stored=null,hasKey=true}={}){
 const memory=new Map(),calls=[],intents=[];
 const key='albot:crypt-lifecycle:M';
 if(stored)memory.set(key,structuredClone(stored));
 let at=1700000000000,writeOK=true,readOK=true;
 const items=[hasKey?{name:'cryptkey'}:null,null,null];
 const p={c:{name:'M',map:'main',in:'main',items,rip:false},
  G:{items:{cryptkey:{type:'material'}}},
  realm:()=> 'EUI',has:name=>name==='enter',
  readCryptJournal:k=>{if(!readOK)throw Error('storage failure');return memory.get(k)??null;},
  write:(k,v)=>{if(!writeOK)return false;memory.set(k,structuredClone(v));return true;},
  call:(...args)=>{calls.push(args);return Promise.resolve({success:true});}};
 const exec={pending:new Map(),
  dispatch:(id,resources,guard,invoke,options)=>{
   intents.push({id,resources,guard,invoke,options});return true;}};
 const bot={p,exec,me:{name:'M',role:'farmer'},
  session:'M-session',running:true,inventoryBlocked:false,
  journal:null,bank:{pending:false},logistics:{reserved:false},
  movement:{order:null},strategy:{busy:false}};
 const lifecycle=()=>createCryptLifecycle(bot,{now:()=>at});
 return {memory,key,items,p,bot,calls,intents,lifecycle,advance:ms=>at+=ms,
  writeOk:value=>writeOK=value,readOk:value=>readOK=value};
}
test('W12/N11 crypt key opening requires exact physical unprotected key',()=>{
 const f=cryptFixture(),c=f.lifecycle();
 assert.equal(c.status().state,'empty');
 assert.equal(c.status().executable,false);
 assert.deepEqual(c.preflight(),{mode:'open',instance:null,keySlot:0,
  keyPrint:JSON.stringify(['cryptkey',0,'','','','','','',''])+':1',
  keyBefore:1});
 assert.equal(c.prepare('open'),true);
 assert.equal(c.status().state,'prepared');
 assert.equal(c.requestEntry(),true);
 assert.equal(f.calls.length,0,'a prepare or executor enqueue is NOT a game call');
 assert.equal(f.intents.length,1);
 assert.deepEqual(f.intents[0].resources,['lifecycle','movement','account']);
 assert.equal(f.intents[0].guard(),true);
});
test('W12/N11 unknown Crypt open never replays after restart or failed promise',async()=>{
 const f=cryptFixture(),c=f.lifecycle();
 assert.equal(c.prepare(),true);
 assert.equal(c.requestEntry(),true);
 await f.intents[0].invoke();
 assert.deepEqual(f.calls,[['enter','crypt']]);
 assert.equal(c.status().state,'dispatch-unknown');
 const saved=f.memory.get(f.key);
 assert.equal(saved.phase,'dispatch-unknown');
 const again=f.lifecycle();
 assert.equal(again.requestEntry(),false);
 assert.equal(again.prepare(),false);
 assert.equal(again.discardPrepared(),false);
 assert.equal(again.status().blocked,true);
});
test('W12/N11 a physical instance and consumed key together prove entry',async()=>{
 const f=cryptFixture(),c=f.lifecycle();c.prepare();c.requestEntry();
 await f.intents[0].invoke();
 f.p.c.map='crypt';f.p.c.in='crypt-party';
 assert.equal(c.sample(),false,'map arrival alone does not prove key consumption');
 assert.equal(c.status().state,'dispatch-unknown');
 f.items[0]=null;
 assert.equal(c.sample(),true);
 assert.equal(c.status().state,'inside-observed');
 assert.equal(c.status().journal.inside.in,'crypt-party');
 const restart=f.lifecycle();
 assert.equal(restart.status().state,'inside-observed');
 assert.equal(restart.requestEntry(),false);
 f.p.c.map='main';
 assert.equal(restart.status().state,'instance-not-currently-observed');
 assert.equal(restart.discardPrepared(),false,
  'disconnect or leaving the map cannot erase entry intent');
});
test('W12/N11 join uses exact party instance without consuming any key',async()=>{
 const f=cryptFixture({hasKey:false}),c=f.lifecycle();
 assert.equal(c.prepare('open'),false);
 for(const name of ['', '../other','other instance',null,'x'.repeat(81)])
  assert.equal(c.prepare('join',name),false,String(name));
 assert.deepEqual(c.preflight('join','sunday-party'),{
  mode:'join',instance:'sunday-party',keySlot:null,
  keyPrint:null,keyBefore:null});
 assert.equal(c.prepare('join','sunday-party'),true);
 assert.equal(c.requestEntry(),true);
 await f.intents[0].invoke();
 assert.deepEqual(f.calls,[['enter','crypt','sunday-party']]);
 f.p.c.map='crypt';f.p.c.in='unknown-party';
 assert.equal(c.sample(),false);
 f.p.c.in='sunday-party';
 assert.equal(c.sample(),true);
 assert.equal(c.status().state,'inside-observed');
});
test('W12/N11 prepared Crypt entry is explicitly discardable but not after dispatch',async()=>{
 const f=cryptFixture(),c=f.lifecycle();
 assert.equal(c.prepare(),true);
 assert.equal(c.discardPrepared(),true);
 assert.equal(c.status().state,'empty');
 assert.equal(c.prepare(),true);
 assert.equal(c.requestEntry(),true);
 await f.intents[0].invoke();
 assert.equal(c.discardPrepared(),false);
 assert.equal(c.requestEntry(),false);
});
test('W12/N11 late key drift, session change and busy executor deny dispatch',()=>{
 for(const kind of ['key','session','busy','bank','movement','realm']){
  const f=cryptFixture(),c=f.lifecycle();
  assert.equal(c.prepare(),true);
  if(kind==='key')f.items[0].q=null;
  if(kind==='session')f.bot.session='restarted';
  if(kind==='busy')f.bot.exec.pending.set('other',true);
  if(kind==='bank')f.bot.bank.pending=true;
  if(kind==='movement')f.bot.movement.order={owner:'travel'};
  if(kind==='realm')f.p.realm=()=> 'USI';
  assert.equal(c.requestEntry(),false,kind);
  assert.equal(f.calls.length,0);
 }
});
test('W12/N11 strict persistence failures block rather than treating key as unused',()=>{
 const f=cryptFixture();
 f.readOk(false);
 const c=f.lifecycle();
 assert.equal(c.prepare(),false);
 assert.equal(c.status().state,'storage-uncertain');
 f.readOk(true);
 const f2=cryptFixture(),d=f2.lifecycle();
 f2.writeOk(false);
 assert.equal(d.prepare(),false);
 assert.equal(d.status().state,'storage-uncertain');
 assert.equal(d.requestEntry(),false);
 const f3=cryptFixture(),e=f3.lifecycle();
 e.prepare();
 f3.memory.set(f3.key,{tampered:true});
 assert.equal(e.discardPrepared(),false);
 assert.equal(e.status().state,'storage-uncertain');
});
test('W12/N11 poisoned persisted intent never becomes an empty entry journal',()=>{
 const f=cryptFixture({stored:{version:1,owner:'M',phase:'dispatch-unknown'}});
 const c=f.lifecycle();
 assert.equal(validCryptEntryRecord(f.memory.get(f.key)),false);
 assert.equal(c.status().state,'corrupt');
 assert.equal(c.status().blocked,true);
 assert.equal(c.prepare(),false);
 assert.equal(c.requestEntry(),false);
 assert.equal(c.discardPrepared(),false);
});


test('W12/N12 Crypt cannot open while Cave entry or vote journal is unresolved',()=>{
 for(const journal of ['cave','vote']){
  const f=cryptFixture(),c=f.lifecycle();
  f.bot[journal==='cave'?'caveLifecycle':'caveVoteJournal']={
   status:()=>({blocked:true,state:'dispatch-unknown'})};
  assert.equal(c.preflight(),null,journal);
  assert.equal(c.prepare(),false,journal);
  assert.equal(c.requestEntry(),false,journal);
  assert.deepEqual(f.calls,[]);
 }
});
test('W12/N12 Cave journal drift revokes a previously prepared Crypt dispatch',()=>{
 for(const source of ['caveLifecycle','caveVoteJournal']){
  const f=cryptFixture(),c=f.lifecycle();
  assert.equal(c.prepare(),true);
  const pflight=c.status();
  assert.equal(pflight.state,'prepared');
  f.bot[source]={status:()=>({blocked:true,state:'dispatch-unknown'})};
  assert.equal(c.requestEntry(),false,
   'a new conflicting Cave journal blocks enqueue');
  assert.equal(f.calls.length,0);
  assert.equal(c.status().state,'prepared',
   'no speculative cancellation or replay of the original checkpoint');
  f.bot[source].status=()=>({blocked:false,state:'empty'});
  assert.equal(c.requestEntry(),true,
   'only a verifiably empty other lifecycle restores the original guard');
  f.bot[source].status=()=>({blocked:true,state:'observed-run'});
  assert.equal(f.intents.at(-1).guard(),false,
   'the final Executor guard must repeat the conflict proof');
 }
});
