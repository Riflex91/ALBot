import test from 'node:test';
import assert from 'node:assert/strict';
import {electStableCombatLeader} from '../src/party/account.mjs';

function ranger(name,{hp=4000,rip=false,running=true,attack=300,armor=80}={}){
 return {name,running,rip,hp,max_hp:4500,class:'ranger',
  stats:{attack,armor,frequency:1}};
}
const roster=['My_Ranger2','My_Ranger1','My_Ranger3'];

test('ordinary farming retains the same healthy leader despite score or HP swings',()=>{
 const members=[ranger('My_Ranger2',{hp:2100,attack:100}),
  ranger('My_Ranger1',{hp:4500,attack:700}),
  ranger('My_Ranger3',{hp:4000,attack:200})];
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2'),
  'My_Ranger2','the leader remains responsible for its published farm plan');
 members[0].hp=4500;members[1].hp=500;
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2'),
  'My_Ranger2','changing damage estimates do not oscillate ownership');
 members[0].hp=1;
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2'),
  'My_Ranger2','emergency combat retreat is separate from switching team ownership');
});

test('failover elects a healthy ranger if the current leader is dead, missing, or offline',()=>{
 const members=[ranger('My_Ranger2',{rip:true,hp:0}),
  ranger('My_Ranger1',{attack:500}),
  ranger('My_Ranger3',{attack:200})];
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2'),'My_Ranger1');
 members[0].rip=false;members[0].hp=4300;members[0].running=false;
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2'),'My_Ranger1');
 assert.equal(electStableCombatLeader(members,roster,'Removed'),'My_Ranger1');
 assert.equal(electStableCombatLeader(members,['My_Ranger2','My_Ranger3'],'My_Ranger1'),
 'My_Ranger3');
});

test('boss/event is allowed to elect a stronger specialist, manual leader remains authoritative',()=>{
 const members=[ranger('My_Ranger2',{attack:300}),ranger('My_Ranger1',{attack:900}),
  ranger('My_Ranger3',{attack:150})];
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2',{bossOrEvent:true}),
  'My_Ranger1');
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2',{
  explicit:'My_Ranger2',bossOrEvent:true}), 'My_Ranger2');
 assert.equal(electStableCombatLeader(members,roster,'My_Ranger2',{
  explicit:'My_Ranger3'}),'My_Ranger3');
});

test('missing or unverifiable current leader is not preserved indefinitely',()=>{
 const m=[ranger('My_Ranger2'),ranger('My_Ranger1')];
 m[0].hp=undefined;
 assert.equal(electStableCombatLeader(m,roster,'My_Ranger2'),'My_Ranger1');
 m[1].hp=undefined;
 assert.equal(electStableCombatLeader(m,roster,'My_Ranger2'),null);
});
