import test from 'node:test';
import assert from 'node:assert/strict';
import {createLuckySlotEvidence} from '../src/production/lucky-slot-evidence.mjs';

function fixture(){
 let clock=1700000000000,realm='EUI';
 const calls=[];
 const bot={session:'M-1',p:{realm:()=>realm,call:(...a)=>calls.push(a),
  write:(...a)=>calls.push(a)}};
 const m=createLuckySlotEvidence(bot,{now:()=>clock});
 return {bot,m,calls,advance:ms=>clock+=ms,setRealm:x=>{realm=x;}};
}
test('N14 counts only observed completed existing mutations, not preview or unknown result',()=>{
 const f=fixture();
 for(const fields of [
  {kind:'upgrade',slot:1,fromLevel:0,toLevel:1,outcome:'improved'},
  {kind:'upgrade',slot:1,fromLevel:0,toLevel:1,outcome:'improved',confirmed:false},
  {kind:'buy',slot:1,fromLevel:0,toLevel:1,outcome:'improved',confirmed:true},
  {kind:'compound',slot:-1,fromLevel:0,toLevel:1,outcome:'improved',confirmed:true},
  {kind:'upgrade',slot:1,fromLevel:0,toLevel:2,outcome:'improved',confirmed:true},
  {kind:'upgrade',slot:1,fromLevel:0,toLevel:1,outcome:'guessed',confirmed:true}
 ])assert.equal(f.m.record(fields),false);
 assert.equal(f.m.status().observed,0);
 assert.equal(f.m.record({kind:'upgrade',slot:1,fromLevel:0,
  toLevel:1,outcome:'improved',confirmed:true}),true);
 assert.equal(f.m.record({kind:'upgrade',slot:1,fromLevel:1,
  toLevel:2,outcome:'server-reported-failure',confirmed:true}),true);
 assert.equal(f.m.record({kind:'compound',slot:4,fromLevel:2,
  toLevel:3,outcome:'unclassified',confirmed:true}),true);
 assert.deepEqual(f.m.status().slots,[
  {slot:1,improved:1,serverReportedFailure:1,unclassified:0,samples:2},
  {slot:4,improved:0,serverReportedFailure:0,unclassified:1,samples:1}]);
 assert.equal(f.m.status().predictionAuthorized,false);
 assert.equal(f.m.status().executable,false);
 assert.equal(f.m.status().authority,'none');
 assert.equal(f.calls.length,0,'passive analysis must never call game APIs or persistence');
});
test('N14 scope is the actual realm and current session, never a historical luck bonus',()=>{
 const f=fixture(),params={kind:'upgrade',slot:2,fromLevel:0,toLevel:1,
  outcome:'improved',confirmed:true};
 f.m.record(params);assert.equal(f.m.status().observed,1);
 f.bot.session='M-2';assert.equal(f.m.status().observed,0);
 f.m.record(params);f.setRealm('USI');
 assert.equal(f.m.status().observed,0);
 assert.equal(f.m.status().realm,'USI');
});
test('N14 bounded sample window and row count, without inventing winning slots',()=>{
 const f=fixture(),params={kind:'upgrade',fromLevel:0,toLevel:1,
  outcome:'unclassified',confirmed:true};
 for(let i=0;i<150;i++)assert.equal(f.m.record({...params,slot:i%20}),true);
 assert.equal(f.m.status().observed,128);
 assert.equal(f.m.status().slots.length,16);
 f.advance(21600001);
 assert.equal(f.m.status().observed,0);
 assert.deepEqual(f.m.status().slots,[]);
});
test('N14 stopping the diagnostic clears memory without value actions',()=>{
 const f=fixture();
 f.m.record({kind:'compound',slot:3,fromLevel:4,toLevel:5,
  outcome:'server-reported-failure',confirmed:true});
 f.m.close();
 assert.equal(f.m.status().observed,0);
 assert.equal(f.calls.length,0);
});
