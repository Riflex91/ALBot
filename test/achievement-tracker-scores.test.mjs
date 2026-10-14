import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedTrackerScores,createAchievementScores}
 from '../src/world/achievement-scores.mjs';
import {createProgression} from '../src/world/progression.mjs';

const G={monsters:{
 goo:{achievements:[[10,'stat','hp',5],[100,'stat','hp',10]]},
 bee:{achievements:[[25,'stat','dex',1],[100,'stat','dex',2]]},
 crab:{achievements:[[100,'stat','armor',2]]}
}};
const proof=()=>({monsters:{goo:999,bee:999,crab:999},
 max:{monsters:{goo:[9.5,20],bee:[50,70],crab:[0,0]}}});
function socketFixture(){
 const handlers=new Map(),sent=[];
 return {
  handlers,sent,
  on(event,fn){handlers.set(event,fn);},
  off(event,fn){if(handlers.get(event)===fn)handlers.delete(event);},
  emit(event){sent.push(event);},
  deliver(event,data){handlers.get(event)?.(data);}
 };
}
function fixture({items=[{name:'tracker'}],sock=socketFixture(),
 running=true}={}){
 let time=1000000;
 const bot={running,p:{c:{items},G,trackerSocket:()=>sock}};
 const tracker=createAchievementScores(bot,()=>time);
 return {tracker,bot,sock,advance:ms=>time+=ms};
}
test('tracker data uses account maximum instead of own kills or team total',()=>{
 const rows=verifiedTrackerScores(proof(),G);
 assert.deepEqual(rows,[
  {monster:'bee',score:50,nextThreshold:100,gap:50,
   nextReward:{stat:'dex',value:2}},
  {monster:'crab',score:0,nextThreshold:100,gap:100,
   nextReward:{stat:'armor',value:2}},
  {monster:'goo',score:9.5,nextThreshold:10,gap:.5,
   nextReward:{stat:'hp',value:5}}
 ]);
});
test('unknown monsters, missing entries and malformed maxima never become invented zeros',()=>{
 const data={max:{monsters:{goo:['9',0],bee:[-1,2],
   crab:[Infinity,0],unsupported:[5000,1]}}};
 assert.deepEqual(verifiedTrackerScores(data,G),[]);
 assert.equal(verifiedTrackerScores({monsters:{goo:250}},G),null);
 assert.equal(verifiedTrackerScores({max:{monsters:[]}},G),null);
});
test('fresh carrier requests tracker evidence once then records only confirmed reply',()=>{
 const f=fixture();
 assert.equal(f.tracker.status().state,'not-observed');
 assert.equal(f.tracker.poll(),true);
 assert.deepEqual(f.sock.sent,['tracker']);
 assert.equal(f.tracker.poll(),false);
 assert.equal(f.tracker.status().observedMonsters,0);
 f.sock.deliver('tracker',proof());
 const status=f.tracker.status();
 assert.equal(status.state,'verified-account-max');
 assert.equal(status.observedMonsters,3);
 assert.equal(status.closestMilestones[0].monster,'goo');
 assert.equal(status.closestMilestones[0].gap,.5);
 assert.equal(status.closestMilestones[0].score,9.5);
 assert.equal(status.observedAt,1000000);
});
test('polling honors 120-second minimum and marks account data stale after 10 minutes',()=>{
 const f=fixture();
 f.tracker.poll();f.sock.deliver('tracker',proof());
 f.advance(119999);
 assert.equal(f.tracker.poll(),false);
 f.advance(1);
 assert.equal(f.tracker.poll(),true);
 assert.equal(f.sock.sent.length,2);
 f.advance(500001);
 assert.equal(f.tracker.status().state,'stale');
 assert.equal(f.tracker.status().observedMonsters,0);
 assert.deepEqual(f.tracker.status().closestMilestones,[]);
});
test('timeout and invalid server shape cannot authorize guessed achievement priorities',()=>{
 const f=fixture();
 f.tracker.poll();
 f.advance(15001);
 assert.equal(f.tracker.poll(),false,'timeout alone cannot bypass 120-second rate limit');
 f.advance(105000);
 assert.equal(f.tracker.poll(),true);
 f.sock.deliver('tracker',{max:{monsters:null}});
 assert.equal(f.tracker.status().state,'invalid-server-reply');
 assert.deepEqual(f.tracker.status().closestMilestones,[]);
});
test('no carried Tracktrix or server socket means no tracker request',()=>{
 const missing=fixture({items:[{name:'computer'}]});
 assert.equal(missing.tracker.poll(),false);
 assert.equal(missing.tracker.status().state,'carrier-not-held');
 assert.deepEqual(missing.sock.sent,[]);
 const unknown=fixture({items:null});
 assert.equal(unknown.tracker.poll(),false);
 assert.equal(unknown.tracker.status().state,'inventory-unknown');
 const unsupported=fixture({sock:null});
 assert.equal(unsupported.tracker.poll(),false);
 assert.equal(unsupported.tracker.status().state,'tracker-socket-unavailable');
 const stopped=fixture({running:false});
 assert.equal(stopped.tracker.poll(),false);
 assert.deepEqual(stopped.sock.sent,[]);
});
test('stopping removes only the listener owned by this tracker; late replies ignored',()=>{
 const f=fixture();
 f.tracker.poll();
 assert.equal(f.sock.handlers.has('tracker'),true);
 f.tracker.close();
 assert.equal(f.sock.handlers.has('tracker'),false);
 f.sock.deliver('tracker',proof());
 assert.equal(f.tracker.poll(),false);
 assert.equal(f.tracker.status().observedMonsters,0);
});
test('progression integration polls tracker even when optional advice is disabled',()=>{
 const sock=socketFixture();
 const bot={running:true,
  p:{c:{name:'Ranger',items:[{name:'supercomputer'}]},G,
   trackerSocket:()=>sock,realm:()=> 'EUII'},
  cfg:{production:{progressionAdvice:false},party:{merchant:'Merchant'},
   farming:{targets:['goo']},general:{planningTickMs:15000}},
  me:{name:'Ranger',role:'farmer',farmTargets:[]},farmers:['Ranger'],
  transport:{fresh:()=>null}};
 const progression=createProgression(bot);
 assert.equal(progression.refresh(),null);
 assert.deepEqual(sock.sent,['tracker']);
 sock.deliver('tracker',proof());
 const status=progression.status();
 assert.equal(status.trackerScores.carrier,'supercomputer');
 assert.equal(status.trackerScores.observedMonsters,3);
 assert.equal(status.trackerScores.closestMilestones[0].monster,'goo');
 progression.close();
 assert.equal(sock.handlers.has('tracker'),false);
});
test('socket identity changes detach stale listeners and preserve minimum interval',()=>{
 const original=socketFixture(),replacement=socketFixture();
 let current=original;
 const f=fixture({sock:original});
 f.bot.p.trackerSocket=()=>current;
 f.tracker.poll();original.deliver('tracker',proof());
 f.advance(120000);current=replacement;
 f.tracker.poll();
 assert.equal(original.handlers.has('tracker'),false);
 assert.equal(replacement.handlers.has('tracker'),true);
 assert.deepEqual(replacement.sent,['tracker']);
 f.tracker.close();
 assert.equal(replacement.handlers.has('tracker'),false);
});
