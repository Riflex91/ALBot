import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createCaveVoteJournal,validCaveVoteRecord}
 from '../src/world/cave-vote-journal.mjs';

const now=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const current=(choiceId='scene-1',optionId='safe')=>({
 localConditionsMet:true,serverVerified:false,executable:false,
 canVote:false,requiresJournal:true,run,choiceId,optionId,deadline:now+30000
});
function fixture({store=new Map(),session='session-one',realm='EUI',
 response=()=>({choice:'scene-1',vote:'safe',resolved:false}),
 storageReadable=true,storageWritable=true}={}){
 const state={now,choice:'scene-1',option:'safe',eligible:true,
  live:{run,serverTime:now,choice:{id:'scene-1',votes:{R:'safe'}}},
  observed:true};
 const calls=[],writes=[],p={
  realm:()=>realm,
  readCaveJournal:key=>{
   if(!storageReadable)throw Error('raw storage unavailable');
   return store.has(key)?structuredClone(store.get(key)):null;
  },
  write:(key,value)=>{
   writes.push([key,value]);
   if(!storageWritable)return false;
   store.set(key,structuredClone(value));return true;
  },
  has:name=>name==='cave_reply',
  call:(name,...args)=>{calls.push([name,...args]);return response();}
 };
 const bot={p,me:{name:'P'},session,running:true,
  caveVote:{preflight:option=>{
   if(!state.eligible||option!==state.option)return {
    ...current(state.choice,state.option),localConditionsMet:false};
   return current(state.choice,option);
  }},
  cave:{status:()=>({realm,live:state.live})},
  caveLifecycle:{status:()=>({
   state:state.observed?'live-observed':'exit-outcome-unknown',
   journal:{phase:'observed-run',observed:{run}}
  })}
 };
 bot.exec=new Executor({now:()=>state.now,active:()=>bot.running,
  limit:3,admit:()=>true,onError:()=>{},onEvent:()=>{}});
 const journal=createCaveVoteJournal(bot,{now:()=>state.now});
 return {bot,p,state,store,writes,calls,journal};
}
test('N12 Cave choice is prepared durably without any RPC',()=>{
 const f=fixture();
 assert.equal(f.journal.status().state,'empty');
 assert.equal(f.journal.requestVote(),false);
 assert.equal(f.journal.prepare('safe'),true);
 const record=f.journal.status().journal;
 assert.equal(validCaveVoteRecord(record),true);
 assert.equal(record.phase,'prepared');
 assert.equal(record.reply,null);
 assert.equal(record.dispatchAt,null);
 assert.equal(f.journal.prepare('safe'),false);
 assert.deepEqual(f.calls,[]);
 assert.equal(f.journal.discardPrepared(),true);
 assert.equal(f.journal.status().state,'empty');
});

test('N12 one explicit cave_reply uses exact IDs only AFTER durable checkpoint',async()=>{
 const f=fixture();
 f.journal.prepare('safe');
 assert.equal(f.journal.requestVote(),true,'executor accepted, not a vote receipt');
 assert.deepEqual(f.calls,[['cave_reply','scene-1','safe']]);
 const dispatched=f.journal.status().journal;
 assert.equal(dispatched.phase,'dispatch-unknown');
 assert.equal(dispatched.dispatchAt,now);
 assert.equal(f.journal.requestVote(),false);
 assert.equal(f.journal.discardPrepared(),false);
 await Promise.resolve();await Promise.resolve();
 const replied=f.journal.status().journal;
 assert.deepEqual(replied.reply,{choice:'scene-1',vote:'safe',resolved:false,at:now});
 assert.equal(f.journal.status().state,'dispatch-unknown',
  'server response alone is not a physical own-vote observation');
 assert.deepEqual(f.calls,[['cave_reply','scene-1','safe']]);
});

test('N12 own vote in current server snapshot confirms once, never sends again',async()=>{
 const f=fixture();
 f.journal.prepare('safe');f.journal.requestVote();
 await Promise.resolve();await Promise.resolve();
 assert.equal(f.journal.sample(),false,'other player vote cannot confirm ours');
 f.state.live.choice.votes.P='safe';
 assert.equal(f.journal.sample(),true);
 assert.equal(f.journal.status().state,'vote-observed');
 assert.equal(f.journal.requestVote(),false);
 assert.deepEqual(f.calls,[['cave_reply','scene-1','safe']]);
 f.journal.close();
 const reboot=fixture({store:f.store,session:'new-session'});
 assert.equal(reboot.journal.status().state,'vote-observed');
 assert.equal(reboot.journal.prepare('safe'),false);
 assert.equal(reboot.journal.requestVote(),false);
});

test('N12 a new choice can be prepared ONLY after observed previous vote',()=>{
 const f=fixture();
 f.journal.prepare('safe');f.journal.requestVote();
 f.state.choice='scene-2';f.state.option='other';
 assert.equal(f.journal.prepare('other'),false,
  'dispatch-unknown must not be silently replaced by new vote');
 f.state.choice='scene-1';f.state.option='safe';
 f.state.live.choice.votes.P='safe';
 assert.equal(f.journal.sample(),true);
 f.state.choice='scene-2';f.state.option='other';
 assert.equal(f.journal.prepare('other'),true);
 const s=f.journal.status().journal;
 assert.equal(s.phase,'prepared');assert.equal(s.choiceId,'scene-2');
 assert.deepEqual(s.history,[{choiceId:'scene-1',optionId:'safe',at:now}]);
 assert.equal(f.journal.discardPrepared(),false,
  'discard must not destroy receipts for earlier accepted Cave votes');
 f.state.choice='scene-1';f.state.option='safe';
 assert.equal(f.journal.prepare('safe'),false);
});

test('N12 failed, thrown, rejected and mismatched API replies never permit replay',async()=>{
 for(const response of [
  ()=>{throw Error('socket lost')},
  ()=>Promise.reject(Error('timeout')),
  ()=>({choice:'scene-2',vote:'safe',resolved:false}),
  ()=>({choice:'scene-1',vote:'bad',resolved:false}),
  ()=>({choice:'scene-1',vote:'safe',resolved:'false'}),
  ()=>({failed:true}),
  ()=>null
 ]){
  const f=fixture({response});
  f.journal.prepare('safe');
  assert.equal(f.journal.requestVote(),true);
  await Promise.resolve();await Promise.resolve();
  f.bot.exec.poll();
  assert.equal(f.journal.status().state,'dispatch-unknown');
  assert.equal(f.journal.status().journal.reply,null);
  assert.equal(f.journal.requestVote(),false);
  assert.deepEqual(f.calls,[['cave_reply','scene-1','safe']]);
 }
});

test('N12 no safe read-after-write means no cave_reply call',()=>{
 const f=fixture({storageWritable:false});
 assert.equal(f.journal.prepare('safe'),false);
 assert.equal(f.journal.status().state,'storage-uncertain');
 assert.deepEqual(f.calls,[]);
 const g=fixture();
 assert.equal(g.journal.prepare('safe'),true);
 g.p.write=()=>false;
 assert.equal(g.journal.requestVote(),true,
  'Executor may accept; its invoke must fail before network call');
 assert.deepEqual(g.calls,[]);
 assert.equal(g.journal.status().state,'storage-uncertain');
});

test('N12 malformed, foreign or unreadable vote journal blocks restart and sending',()=>{
 const f=fixture();f.journal.prepare('safe');
 const key='albot:cave-vote:P',valid=f.store.get(key);
 for(const corrupted of [
  {...valid,run:other,phase:'dispatch-unknown',dispatchAt:null},
  {...valid,phase:'vote-observed',observedAt:now},
  {...valid,history:[{choiceId:'scene-1',optionId:'safe',at:now}]},
  {...valid,realm:'USII'},
  {...valid,name:'other'},
  {...valid,createdAt:Infinity}
 ]){
  const x=fixture({store:new Map([[key,corrupted]]),session:'restart'});
  assert.equal(x.journal.status().blocked,true);
  assert.equal(x.journal.prepare('safe'),false);
  assert.equal(x.journal.requestVote(),false);
  assert.deepEqual(x.calls,[]);
 }
 const noRead=fixture({storageReadable:false});
 assert.equal(noRead.journal.status().state,'storage-uncertain');
 assert.equal(noRead.journal.prepare('safe'),false);
 const foreign=fixture({store:f.store,realm:'USII'});
 assert.equal(foreign.journal.status().state,'scope-mismatch');
 assert.equal(foreign.journal.requestVote(),false);
});

test('N12 explicit send rejects changed choice, stale budget or other action',()=>{
 const changes=[
  f=>{f.state.choice='scene-2'},
  f=>{f.state.option='other'},
  f=>{f.state.eligible=false},
  f=>{f.bot.session='new'},
  f=>{f.bot.journal={kind:'bank'}},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.bank={pending:true}},
  f=>{f.bot.teamTravel={blocked:true}},
  f=>{f.p.has=()=>false},
  f=>{f.p.has=()=>{throw Error('not supported')}}
 ];
 for(const change of changes){
  const f=fixture();f.journal.prepare('safe');change(f);
  assert.equal(f.journal.requestVote(),false);
  assert.equal(f.journal.status().journal.phase,'prepared');
  assert.deepEqual(f.calls,[]);
 }
});

test('N12 physical confirmation demands own current run, server clock and matching choice',()=>{
 const f=fixture();f.journal.prepare('safe');f.journal.requestVote();
 f.state.live.choice.votes.P='safe';
 for(const mutation of [
  x=>{x.run=other},
  x=>{x.choice.id='scene-2'},
  x=>{x.serverTime=now-4000},
  x=>{x.serverTime=now+1},
  x=>{x.choice.votes.P='other'}
 ]){
  f.state.live={run,serverTime:now,choice:{id:'scene-1',
   votes:{P:'safe'}}};
  mutation(f.state.live);
  assert.equal(f.journal.sample(),false);
 }
 f.state.live={run,serverTime:now,choice:{id:'scene-1',votes:{P:'safe'}}};
 f.state.observed=false;assert.equal(f.journal.sample(),false);
 f.state.observed=true;assert.equal(f.journal.sample(),true);
});

test('N12 restart may reconcile own vote without replaying API request',()=>{
 const f=fixture(),key='albot:cave-vote:P';
 f.journal.prepare('safe');f.journal.requestVote();
 f.journal.close();
 const reboot=fixture({store:f.store,session:'new'});
 reboot.state.live.choice.votes.P='safe';
 assert.equal(reboot.journal.status().state,'dispatch-unknown');
 assert.equal(reboot.journal.sample(),true);
 assert.equal(reboot.journal.status().state,'vote-observed');
 assert.deepEqual(reboot.calls,[]);
 assert.equal(reboot.journal.requestVote(),false);
 assert.equal(reboot.store.get(key).observedAt,now);
});

test('N12 only independently proven final Cave exit retires same-run vote journal',()=>{
 const f=fixture();f.journal.prepare('safe');f.journal.requestVote();
 assert.equal(f.journal.completeRun(other),false);
 assert.equal(f.journal.status().blocked,true);
 assert.equal(f.journal.completeRun(run),true);
 assert.equal(f.journal.status().state,'empty');
 assert.equal(f.store.get('albot:cave-vote:P'),null);
});
