import {selectVerifiedStatMilestoneArea,selectHuntArea} from '../src/world/team-plan.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedTrackerScores,verifiedStatMilestones,achievementMilestoneBias,createAchievementScores}
 from '../src/world/achievement-scores.mjs';
import {createProgression} from '../src/world/progression.mjs';

const G={monsters:{
 goo:{achievements:[[10,'stat','hp',5],[100,'stat','hp',10]]},
 bee:{achievements:[[100,'stat','dex',1]]},
 crab:{achievements:[[100,'cosmetic','title',1]]}
}};
const data=()=>({max:{monsters:{goo:[99,100],bee:[90,100],crab:[99,100]}}});
function fixture(){
 let now=1000000;
 const socket={fn:null,sent:0,
  on(event,fn){assert.equal(event,'tracker');this.fn=fn;},
  off(event,fn){if(this.fn===fn)this.fn=null;},
  emit(event){assert.equal(event,'tracker');this.sent++;},
  deliver(value){this.fn?.(value);}};
 const bot={running:true,p:{c:{items:[{name:'tracker'}]},G,trackerSocket:()=>socket}};
 const scores=createAchievementScores(bot,()=>now);
 return {bot,socket,scores,advance:ms=>now+=ms};
}
test('nearby known stat milestone has small capped boost, not a kill-score estimate',()=>{
 const rows=verifiedTrackerScores(data(),G);
 assert.ok(Math.abs(achievementMilestoneBias(rows.find(r=>r.monster==='goo'))-.0384)<1e-12);
 assert.ok(Math.abs(achievementMilestoneBias(rows.find(r=>r.monster==='bee'))-.024)<1e-12);
 assert.equal(achievementMilestoneBias(rows.find(r=>r.monster==='crab')),0,
  'non-stat reward does not alter combat farming');
 for(const row of [
  {score:0,nextThreshold:25,gap:25,nextReward:{stat:'hp',value:5}},
  {score:10,nextThreshold:10,gap:0,nextReward:{stat:'hp',value:5}},
  {score:4,nextThreshold:10,gap:7,nextReward:{stat:'hp',value:5}},
  {score:4,nextThreshold:10,gap:6,nextReward:{stat:'hp',value:-5}},
  null
 ])assert.equal(achievementMilestoneBias(row),0);
});
test('verified active carrier enables milestone bias; stale/removed data disables it',()=>{
 const f=fixture();
 assert.equal(f.scores.bonus('goo'),0);
 f.scores.poll();f.socket.deliver(data());
 assert.ok(f.scores.bonus('goo')>0);
 assert.equal(f.scores.bonus('crab'),0);
 assert.equal(f.scores.bonus('nonexistent'),0);
 f.bot.p.c.items=[{name:'computer'}];
 assert.equal(f.scores.bonus('goo'),0,'no carried achievement carrier');
 f.bot.p.c.items=[{name:'supercomputer'}];
 assert.equal(f.scores.bonus('goo'),0,'re-equipped carrier requires new server evidence');
 f.advance(120001);
 assert.equal(f.scores.poll(),true);
 f.socket.deliver(data());
 assert.ok(f.scores.bonus('goo')>0,'fresh confirmed supercomputer score is accepted');
 f.advance(600001);
 assert.equal(f.scores.bonus('goo'),0,'stale scores cannot change farm targets');
});
test('reloading optional Guide advice off still uses confirmed achievement score only',()=>{
 const socket={handlers:new Map(),count:0,
  on(e,fn){this.handlers.set(e,fn);},
  off(e,fn){if(this.handlers.get(e)===fn)this.handlers.delete(e);},
  emit(){this.count++;}};
 const bot={running:true,p:{c:{items:[{name:'tracker'}]},
  G,trackerSocket:()=>socket,realm:()=> 'EUII'},
  cfg:{production:{progressionAdvice:false},general:{planningTickMs:15000},
   party:{merchant:'Merchant'},farming:{targets:['goo']}},
  me:{name:'Ranger',role:'farmer',farmTargets:[]},farmers:['Ranger'],
  transport:{fresh:()=>null}};
 const progression=createProgression(bot);
 assert.equal(progression.bonus('goo','main'),0);
 progression.refresh();
 assert.equal(socket.count,1);
 socket.handlers.get('tracker')?.(data());
 assert.ok(progression.bonus('goo','main')>0);
 assert.equal(progression.bonus('crab','main'),0);
 progression.close();
 assert.equal(socket.handlers.size,0);
});

test('delayed tracker response after carrier loss cannot restore achievement bonus',()=>{
 const f=fixture();
 assert.equal(f.scores.poll(),true);
 f.bot.p.c.items=[];
 assert.equal(f.scores.status().state,'carrier-not-held');
 f.socket.deliver(data());
 f.bot.p.c.items=[{name:'tracker'}];
 assert.equal(f.scores.bonus('goo'),0);
 f.advance(120001);
 assert.equal(f.scores.poll(),true);
 f.socket.deliver(data());
 assert.ok(f.scores.bonus('goo')>0);
});

test('fractional server scores are preserved but unsafe scores and non-integer milestones are rejected',()=>{
 const malformed={max:{monsters:{goo:[99.5],bee:[Number.MAX_SAFE_INTEGER+1],crab:[99]}}};
 const rows=verifiedTrackerScores(malformed,G);
 assert.equal(rows.some(x=>x.monster==='bee'),false);
 assert.equal(rows.find(x=>x.monster==='goo')?.score,99.5);
 const defs={monsters:{goo:{achievements:[[99.5,'stat','hp',50],[100,'stat','hp',5],[Number.MAX_SAFE_INTEGER+1,'stat','hp',100]]}}};
 const clean=verifiedTrackerScores({max:{monsters:{goo:[99]}}},defs);
 assert.equal(clean[0].nextThreshold,100);
 assert.ok(achievementMilestoneBias(clean[0])>0);
 for(const bad of [
  {...clean[0],score:Number.MAX_SAFE_INTEGER+1,gap:1},
  {...clean[0],nextThreshold:99.5,gap:.5},
  {...clean[0],gap:Infinity}
 ])assert.equal(achievementMilestoneBias(bad),0);
});

test('invalid refresh revokes previously confirmed milestone priority',()=>{
 const f=fixture();
 assert.equal(f.scores.poll(),true);
 f.socket.deliver(data());
 assert.ok(f.scores.bonus('goo')>0);
 f.advance(120001);
 assert.equal(f.scores.poll(),true);
 f.socket.deliver({max:{monsters:null}});
 assert.equal(f.scores.status().state,'invalid-server-reply');
 assert.equal(f.scores.status().observedMonsters,0);
 assert.equal(f.scores.bonus('goo'),0);
});

test('actual official stat reward can follow earlier cosmetic achievement, not invented from absent scores',()=>{
 const defs={monsters:{bee:{achievements:[[10,'cosmetic','hat',1],[25,'stat','dex',1]]},
  goo:{achievements:[[10,'stat','hp',5]]}}};
 const verified=verifiedTrackerScores({max:{monsters:{bee:[8]}}},defs);
 const rows=verifiedStatMilestones(verified,defs);
 assert.deepEqual(rows,[{monster:'bee',score:8,threshold:25,gap:17,stat:'dex',bonus:1}]);
 assert.equal(rows.some(r=>r.monster==='goo'),false,'no unobserved server score becomes invented zero');
});
test('verified near stat milestone outranks ordinary gold/XP only among preapproved safe areas',()=>{
 const defs={monsters:{bee:{hp:100,achievements:[[25,'stat','dex',1]]},
  goo:{hp:80,achievements:[]}}};
 const rows=[{monster:'bee',score:19,threshold:25,gap:6,stat:'dex',bonus:1}];
 const ranking=[{target:'goo',key:'main:goo',score:100,
  travelSeconds:4,composition:{effectiveDps:100}},
  {target:'bee',key:'main:bee',score:50,
   travelSeconds:10,composition:{effectiveDps:100}}];
 const selected=selectVerifiedStatMilestoneArea(ranking,rows,defs);
 assert.equal(selected?.area.target,'bee');
 assert.equal(selected?.milestone.gap,6);
 assert.equal(selectHuntArea(ranking,{phase:'combat',owner:'Ranger',
  monster:'goo',remaining:5}).area.target,'goo','safe monsterhunt stays top');
 assert.equal(selectVerifiedStatMilestoneArea(ranking.slice(0,1),rows,defs),null,
  'cannot prioritize a monster missing from safe approved spawn ranking');
 assert.equal(selectVerifiedStatMilestoneArea(ranking,
  [{...rows[0],gap:3000,threshold:3019}],defs),null);
 assert.equal(selectVerifiedStatMilestoneArea(ranking,
  [{...rows[0],stat:'strength'}],defs),null);
});
test('stat milestone exposure strictly requires live carried Tracktrix or Super Computer',()=>{
 const f=fixture();
 assert.deepEqual(f.scores.milestones(),[]);
 f.scores.poll();f.socket.deliver(data());
 assert.ok(f.scores.milestones().some(m=>m.monster==='goo'));
 f.bot.p.c.items=[];
 assert.deepEqual(f.scores.milestones(),[]);
 f.bot.p.c.items=[{name:'supercomputer'}];
 assert.deepEqual(f.scores.milestones(),[],'old score cannot reactivate on carrier replacement');
});
