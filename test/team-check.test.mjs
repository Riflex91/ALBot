import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamCheck,saveTeamCheck} from '../src/core/team-check.mjs';

test('in-game team check is strictly read-only and reports Party, leader, combat and peer freshness',()=>{
 const calls=[],bot={
  p:{c:{party:'My_Ranger1'},parent:{party:{My_Ranger1:{},My_Ranger2:{}}},realm:()=> 'EUII'},
  me:{name:'My_Ranger2'},running:true,reason:'Warte auf Gruppe',farmers:['My_Ranger1','My_Ranger2','My_Rogue'],leader:'My_Ranger1',
  target:null,task:()=> 'farm',account:{active:()=>true},
  teamPlan:{status:()=>({current:{id:'x',target:'goo',map:'main',leader:'My_Ranger1',expires:1234}})},
  transport:{status:()=>({counters:{heartbeatReceived:12,sendFailed:0},peers:[{name:'My_Ranger1',seen:true,fresh:true,ageMs:100,realm:'EUII',running:true,heartbeatReceived:4}]})},
  exec:{pending:new Map()},inventoryBlocked:false,journal:null,
  move:()=>calls.push('move')
 };
 const report={version:'0.8.4-full',counts:{'runtime.warning':0},incidents:[],actionStats:{attack:{started:4,ended:3,results:{returned:3}},'invite:My_Ranger3':{started:1,ended:1,results:{rejected:1}}}};
 const d=createTeamCheck(bot,report);
 assert.equal(d.format,'albot-team-check');
 assert.equal(d.gameParty,'My_Ranger1');
 assert.deepEqual(d.gamePartyMembers,['My_Ranger1','My_Ranger2']);
 assert.deepEqual(d.selectedFarmers,['My_Ranger1','My_Ranger2','My_Rogue']);
 assert.equal(d.combat.attacksStarted,4);
 assert.equal(d.combat.farmPlan.target,'goo');
 assert.equal(d.peers[0].fresh,true);
 assert.equal(d.partyActions['invite:My_Ranger3'].started,1);
 assert.deepEqual(calls,[]);
});

test('in-game team check download creates a JSON file via user-click-compatible browser APIs',()=>{
 const events=[];
 const doc={body:{append(node){events.push(['append',node.download])}},createElement(type){
  assert.equal(type,'a');return {click(){events.push(['click',this.download])},remove(){events.push(['remove'])}};
 }};
 class Blob {constructor(chunks,options){this.chunks=chunks;this.options=options;}}
 const p={headless:false,parent:{document:doc,Blob,URL:{createObjectURL(blob){events.push(['blob',JSON.parse(blob.chunks[0]).format]);return 'blob:fake';},revokeObjectURL(url){events.push(['revoke',url])}},setTimeout(cb){cb()}},log:()=>assert.fail('download should not fail')};
 const file=saveTeamCheck(p,{format:'albot-team-check',character:'My_Ranger1',createdAt:'2026-10-11T12:00:00.000Z'});
 assert.equal(file,'albot-teamcheck-My_Ranger1-2026-10-11T12-00-00-000Z.json');
 assert.ok(events.some(x=>x[0]==='click'&&x[1]===file));
 assert.ok(events.some(x=>x[0]==='blob'&&x[1]==='albot-team-check'));
});

test('headless team check does not attempt browser downloads',()=>{
 assert.equal(saveTeamCheck({headless:true},{character:'X'}),null);
});
