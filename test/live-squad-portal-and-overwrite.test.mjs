import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiveSquadMarch} from '../src/world/team-plan.mjs';
import {squadMarchStillInTransit} from '../src/world/strategy.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {createOverwriteLogSaver,stableLogName} from '../src/core/overwrite-log.mjs';

test('leader continues across portal when Priest and Ranger2 demonstrably follow same route',()=>{
 const now=50000,leader={name:'R1',map:'main',in:'main',x:105,y:-358};
 const plan={id:'P4',map:'halloween',in:'halloween',realm:'EUII',x:8,y:630.5};
 const peer=(name,map,moving=true)=>({name,map,in:map,x:320,y:100,
   realm:'EUII',running:true,rip:false,received:now-500,hp:2800,max_hp:3000,
   march:{plan:'P4',realm:'EUII',moving}});
 const priest=peer('Priest','halloween'),ranger=peer('R2','mtunnel');
 assert.equal(assessLiveSquadMarch(leader,[priest,ranger],{realm:'EUII',
  plan,now}).ready,true);
 assert.equal(assessLiveSquadMarch(leader,[{...priest,march:{...priest.march,plan:'wrong'}},ranger],{
  realm:'EUII',plan,now}).reason,'teammate-not-on-shared-route');
 assert.equal(assessLiveSquadMarch(leader,[{...priest,march:{...priest.march,moving:false}},ranger],{
  realm:'EUII',plan,now}).ready,false);
 assert.equal(assessLiveSquadMarch(leader,[{...priest,hp:200},ranger],{
  realm:'EUII',plan,now}).reason,'teammate-needs-heal');
 assert.equal(assessLiveSquadMarch(leader,[{...priest,received:now-5000},ranger],{
  realm:'EUII',plan,now}).reason,'teammate-unverified');
 const reached={...priest,x:8,y:630.5,march:{...priest.march,moving:false}};
 assert.equal(assessLiveSquadMarch(leader,[reached,ranger],{realm:'EUII',plan,now}).ready,true);
});
test('monsterhunt cannot hijack selected farmer in transit or while teammates still crossing maps',()=>{
 const plan={id:'P4',map:'halloween',in:'halloween',realm:'EUII',x:8,y:630.5};
 const leader={name:'R1',map:'main',in:'main',x:105,y:-358};
 const priest={name:'Priest',map:'halloween',in:'halloween',x:8,y:630.5,running:true,realm:'EUII'};
 const nearLeader={name:'R1',map:'halloween',in:'halloween',x:10,y:620,running:true,realm:'EUII'};
 assert.equal(squadMarchStillInTransit(leader,['R1','Priest'],plan,n=>priest),true);
 assert.equal(squadMarchStillInTransit(priest,['R1','Priest'],plan,n=>leader),true);
 assert.equal(squadMarchStillInTransit(priest,['R1','Priest'],plan,n=>nearLeader),false);
});
test('compact march agreement survives heartbeat size pressure',()=>{
 const source={name:'Priest',items:[],materials:[],realm:'EUII',
  march:{plan:'P4',realm:'EUII',moving:true},
  performance:'p'.repeat(2500),stock:'x'.repeat(2500),gear:'g'.repeat(2500)};
 const packed=fitHeartbeat(source,200);
 assert.deepEqual(packed?.march,source.march);
 assert.ok(JSON.stringify(packed).length<=200);
});
test('two manual exports to the same chosen file overwrite rather than append or auto-rename',async()=>{
 const files=new Map(),handles=new Map();
 const root={showSaveFilePicker:async({suggestedName})=>{
  const handle={createWritable:async()=>({
   write:async data=>{files.set(suggestedName,data);},close:async()=>{},abort:async()=>{}
  })};
  handles.set(suggestedName,handle);
  return handle;
 }};
 const saver=createOverwriteLogSaver({parent:root,root,headless:false,log:()=>{}});
 const name=stableLogName('test','My_Ranger1');
 assert.equal(name,'test-My_Ranger1.json');
 const first=await saver.save(name,'{\"test\":1}');
 const second=await saver.save(name,'{\"test\":2}');
 assert.equal(first.overwritten,true);
 assert.equal(second.overwritten,true);
 assert.equal(files.get(name),'{\"test\":2}');
 assert.equal(handles.size,1);
});
test('both types share selected log folder but have separate stable names',async()=>{
 const contents=new Map();
 const directory={getFileHandle:async name=>({createWritable:async()=>({
  write:async value=>contents.set(name,value),close:async()=>{},abort:async()=>{}
 })})};
 const saver=createOverwriteLogSaver({parent:{},headless:false,log:()=>{}},()=>directory);
 const one=stableLogName('test','My_Priest'),two=stableLogName('team','My_Priest');
 assert.equal(two,'albot-teamcheck-My_Priest.json');
 await saver.save(one,'old');await saver.save(two,'team');await saver.save(one,'new');
 assert.equal(contents.get(one),'new');
 assert.equal(contents.get(two),'team');
});
test('picker cancellation does not create an unrequested legacy download',async()=>{
 const root={showSaveFilePicker:async()=>{const e=new Error('cancel');e.name='AbortError';throw e;}};
 const saver=createOverwriteLogSaver({parent:root,root,log:()=>{}});
 const outcome=await saver.save(stableLogName('team','P'),'{}');
 assert.equal(outcome.method,'cancelled');
 assert.equal(outcome.filename,null);
});
