import test from 'node:test';
import assert from 'node:assert/strict';
import {roadAggroTravelDecision} from '../src/combat/transit-defense.mjs';
import {assessLiveSquadMarch} from '../src/world/team-plan.mjs';
import {catalogNpcDestination} from '../src/merchant/economy.mjs';
import {vacantAccessoryCandidates} from '../src/production/intelligence.mjs';

const realm='EUII';
const plan={id:'plan:stoneworm',kind:'farm',realm,target:'stoneworm',
 map:'spookytown',in:'spookytown',x:1000,y:0};
const ranger={name:'Ranger1',map:'main',in:'main',x:0,y:0,
 hp:1500,max_hp:1500,moving:true};
const order={owner:'follow',dest:{...plan}};
const hostile={id:'bigbird:1',type:'monster',mtype:'bigbird',hp:40000,
 target:'Priest',map:'main',in:'main',x:20,y:20};

test('lethal roadside aggro preserves a verified native farm route, not a defensive chase',()=>{
 assert.deepEqual(roadAggroTravelDecision(ranger,order,plan,[hostile],
  ['Ranger1','Priest']),{
  continueRoute:true,reason:'team-road-aggro-preserve-native-route',hostileCount:1
 });
 assert.equal(roadAggroTravelDecision(ranger,order,plan,[hostile],
  ['Ranger1','Priest'],true).reason,'verified-team-transit-block');
 assert.equal(roadAggroTravelDecision(ranger,{owner:'combat',dest:order.dest},
  plan,[hostile],['Priest']).continueRoute,false);
});
test('leader does not repeatedly halt for a healthy follower visibly progressing on the same route',()=>{
 const local={...plan,map:'main',in:'main',x:1000,y:0};
 const teammate={name:'Priest',map:'main',in:'main',x:-190,y:0,
  received:9950,realm,running:true,rip:false,hp:900,max_hp:1000,
  march:{plan:local.id,realm,moving:true,map:'main',in:'main'}};
 const check=x=>assessLiveSquadMarch({...ranger,realm},[x],{
  realm,plan:local,now:10000,maxGap:180,hpFloor:.6});
 assert.equal(check(teammate).ready,true);
 assert.equal(check({...teammate,march:{...teammate.march,moving:false}}).reason,
  'teammate-behind');
 assert.equal(check({...teammate,x:-290}).reason,'teammate-behind');
 assert.equal(check({...teammate,hp:500}).reason,'teammate-needs-heal');
 assert.equal(check({...teammate,received:5000}).reason,'teammate-unverified');
});
test('remote NPC accessor purchase requires authoritative placement and item listing',()=>{
 const G={maps:{
  main:{npcs:[]},
  winterland:{npcs:[{id:'accessoryshop',position:[30,-25]}]},
  dangerous:{pvp:true,npcs:[{id:'fake',position:[0,0]}]},
  ignored:{ignore:true,npcs:[{id:'ghost',position:[0,0]}]}
 },npcs:{accessoryshop:{items:['earringA','capeA']}}};
 assert.deepEqual(catalogNpcDestination(G,'accessoryshop'),
  {map:'winterland',in:'winterland',x:30,y:-25});
 assert.equal(catalogNpcDestination(G,'fake'),null);
 assert.equal(catalogNpcDestination(G,'ghost'),null);
 assert.equal(catalogNpcDestination(G,'absent'),null);
});
test('catalog only proposes compatible, unfilled accessory slots; no phantom market stock',()=>{
 const slots={cape:null,earring1:null,earring2:null};
 const profile={class:'ranger',level:20,slots};
 const G={items:{earringA:{type:'earring',g:100},
  capeA:{type:'cape',g:120},bow:{type:'weapon',wtype:'bow',g:1}},
  classes:{ranger:{mainhand:{bow:{}},doublehand:{},offhand:{}}}};
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring1'),['earringA']);
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'cape'),['capeA']);
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring2'),['earringA']);
 slots.earring1={name:'earringA',level:0};
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring1'),[]);
});
