import test from 'node:test';
import assert from 'node:assert/strict';
import {assessQuestDetachment} from '../src/combat/quest-detachment.mjs';
import {neutralPullReadiness} from '../src/combat/team-readiness.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';

function team(self='Ranger1',visitor='Priest'){
 const names=['Ranger1','Priest','Ranger2'];
 const people=Object.fromEntries(names.map((name,i)=>[name,{
  name,class:name==='Priest'?'priest':'ranger',ctype:name==='Priest'?'priest':'ranger',
  running:true,rip:false,realm:'EUII',map:'main',in:'main',
  x:105+i*5,y:105,hp:100,max_hp:100,mp:100,max_mp:100,
  questVisit:name===visitor,threats:0,received:Date.now()
 }]));
 const me=people[self];
 const plan={id:'plan-1',leader:'Ranger1',kind:'farm',target:'bee',key:'bee/main/1',
  objective:null,realm:'EUII',map:'main',in:'main',x:100,y:100,expires:Date.now()+60000};
 const bot={
  running:true,me:{name:self,role:'farmer'},leader:'Ranger1',farmers:names,
  teamNames:names,
  cfg:{party:{enabled:true,waitForTeam:true,followDistance:180,aoe:true,aoeMaxTargets:5},
   farming:{pullHp:.75,pullMp:.5,maxAggro:5,restBelow:.4}},
  p:{c:{...me,s:{},xp:0},realm:()=> 'EUII',
   G:{monsters:{bee:{hp:10,attack:1}},skills:{}},
   read:()=>null,write:()=>true},
  transport:{fresh:name=>name===self?null:people[name]},
  teamPlan:{heartbeat:()=>plan,valid:()=>true,target:()=>plan.target,wantsCombat:()=>true},
  strategy:{busy:self===visitor,safeTarget:()=>true,heartbeat:()=>null},
  monsters:()=>[],entity:()=>null
 };
 return {bot,people,plan};
}

test('solo Priest visit keeps leader and Ranger2 at safe farm anchor',()=>{
 const {bot}=team('Ranger1','Priest');
 assert.deepEqual(assessQuestDetachment(bot)?.active,['Ranger1','Ranger2']);
 assert.equal(assessQuestDetachment(bot)?.puller,'Ranger1');
 assert.equal(neutralPullReadiness(bot).reason,'two-farmer-conservative');
});

test('when leader collects Monsterhunt, Ranger becomes temporary puller, not Priest',()=>{
 const {bot}=team('Ranger2','Ranger1');
 const d=assessQuestDetachment(bot);
 assert.equal(d?.visitor,'Ranger1');
 assert.equal(d?.puller,'Ranger2');
 assert.equal(neutralPullReadiness(bot).ready,true);
 const {bot:priest}=team('Priest','Ranger1');
 assert.equal(assessQuestDetachment(priest)?.puller,'Ranger2');
 assert.equal(neutralPullReadiness(priest).ready,false);
});

test('temporary pulls require both survivors above conservative health and mana floors',()=>{
 const {bot,people}=team('Ranger1','Priest');
 people.Ranger2.hp=89;
 assert.equal(neutralPullReadiness(bot).ready,false);
 people.Ranger2.hp=100;
 people.Ranger2.mp=29;
 assert.equal(neutralPullReadiness(bot).ready,false);
});

test('no verified detachment for missing quest, two visitors, invalid or relocated farm plan',()=>{
 const {bot,people,plan}=team('Ranger1','Priest');
 people.Priest.questVisit=false;
 assert.equal(assessQuestDetachment(bot),null);
 people.Priest.questVisit=true;
 people.Ranger2.questVisit=true;
 assert.equal(assessQuestDetachment(bot),null);
 people.Ranger2.questVisit=false;
 people.Ranger2.map='halloween';
 assert.equal(assessQuestDetachment(bot),null);
 people.Ranger2.map='main';
 bot.teamPlan.valid=()=>false;
 assert.equal(assessQuestDetachment(bot),null);
 bot.teamPlan.valid=()=>true;
 plan.kind='hunt';
 assert.equal(assessQuestDetachment(bot),null);
});

test('a missing second farmer prevents a partial group from starting new pulls',()=>{
 const {bot,people}=team('Ranger1','Priest');
 people.Ranger2.running=false;
 assert.equal(assessQuestDetachment(bot),null);
 assert.equal(neutralPullReadiness(bot).ready,false);
});

test('detached Ranger starts at most one neutral bee and no multi-pull',()=>{
 const {bot}=team('Ranger2','Ranger1');
 const encounter=createEncounter(bot);
 encounter.tick();
 assert.equal(encounter.status().capacity,1);
 assert.equal(encounter.permit({type:'monster',mtype:'bee'}),true);
 assert.equal(encounter.permit({type:'monster',mtype:'minimush'}),false);
 bot.monsters=()=>[{id:'hostile',type:'monster',mtype:'bee',hp:10,target:'Priest'}];
 assert.equal(encounter.permit({type:'monster',mtype:'bee'}),false);
 assert.equal(encounter.pull(),false);
});

test('conservative dual farming cannot bypass live risk rejection',()=>{
 const {bot}=team('Ranger1','Priest');
 bot.strategy.safeTarget=()=>false;
 const encounter=createEncounter(bot);
 assert.equal(encounter.permit({type:'monster',mtype:'bee'}),false);
});

test('quest owner returning revokes temporary single-puller authority',()=>{
 const {bot,people}=team('Ranger2','Ranger1');
 const encounter=createEncounter(bot);
 assert.equal(encounter.permit({type:'monster',mtype:'bee'}),true);
 people.Ranger1.questVisit=false;
 assert.equal(assessQuestDetachment(bot),null);
 assert.equal(encounter.permit({type:'monster',mtype:'bee'}),false);
});
