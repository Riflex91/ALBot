import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENT_CARRIER_IDS,isAchievementCarrier,
  carriedAchievementCarrier} from '../src/items/achievement-utility.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {createProgression} from '../src/world/progression.mjs';

test('Tracktrix and Super Computer activate the carrier, ordinary computer does not',()=>{
 assert.deepEqual(ACHIEVEMENT_CARRIER_IDS,['tracker','supercomputer']);
 assert.equal(carriedAchievementCarrier([{name:'tracker'}]),'tracker');
 assert.equal(carriedAchievementCarrier([{name:'supercomputer'}]),'supercomputer');
 assert.equal(carriedAchievementCarrier([{name:'tracker'},{name:'supercomputer'}]),'supercomputer');
 assert.equal(carriedAchievementCarrier([{name:'computer'}]),null);
 assert.equal(isAchievementCarrier({name:'computer'}),false);
 assert.equal(isAchievementCarrier({name:'tracker'}),true);
 assert.equal(isAchievementCarrier({name:'supercomputer'}),true);
});
test('unknown physical inventory must not be reported as confirmed absence',()=>{
 assert.equal(carriedAchievementCarrier(undefined),'unknown');
 assert.equal(carriedAchievementCarrier(null),'unknown');
 assert.equal(carriedAchievementCarrier([]),null);
 assert.equal(carriedAchievementCarrier([{name:'gem0'}]),null);
});
test('compacted heartbeat retains carrier proof while trimming optional telemetry',()=>{
 const data={name:'Ranger1',running:true,realm:'EUII',
  achievementCarrier:'supercomputer',items:[],materials:[],
  performance:'a'.repeat(3200),adaptive:'b'.repeat(3200)};
 const compact=fitHeartbeat(data);
 assert.ok(compact);
 assert.equal(compact.achievementCarrier,'supercomputer');
 assert.ok(JSON.stringify(compact).length<=4200);
});
test('progression status records local and fresh team carrier evidence without inventing scores',()=>{
 const self={name:'Ranger1',items:[{name:'tracker'}]};
 let peer={running:true,achievementCarrier:'supercomputer'};
 const bot={
  p:{c:self,G:{},read:()=>null},cfg:{production:{progressionAdvice:false},
    party:{merchant:'Merchant'}},me:{name:'Ranger1',role:'farmer',farmTargets:[]},
  farmers:['Ranger1','Ranger2','Ranger3'],
  transport:{fresh:name=>name==='Ranger2'?peer:null}
 };
 const status=createProgression(bot).status();
 assert.equal(status.achievementCarrier,'tracker');
 assert.deepEqual(status.farmerCarriers,[
  {name:'Ranger1',carrier:'tracker'},
  {name:'Ranger2',carrier:'supercomputer'},
  {name:'Ranger3',carrier:'unknown'}]);
 assert.equal(status.scores,undefined,'unknown account monster score is not zero');
 peer=null;
 assert.equal(createProgression(bot).status().farmerCarriers[1].carrier,'unknown');
});
