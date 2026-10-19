import test from 'node:test';
import assert from 'node:assert/strict';
import {createRespawnCalendar} from '../src/world/respawn-calendar.mjs';

function fixture(saved=null){
 let at=1700000000000,realm='EUI',persist=true;
 const store=new Map(saved?[['albot:respawn-calendar:v1:M',saved]]:[]);
 const mobs=[{id:'e1',mtype:'phoenix',type:'monster',map:'main',in:'main',
  x:20,y:0,hp:100,dead:false}];
 const p={c:{map:'main',in:'main',x:0,y:0},realm:()=>realm,
  read:k=>store.get(k)??null,
  write:(k,v)=>{if(!persist)return false;store.set(k,structuredClone(v));return true;}};
 const bot={p,me:{name:'M'},session:'M-session-1',running:true,monsters:()=>mobs,
  entity:id=>mobs.find(m=>m.id===id)};
 const calendar=createRespawnCalendar(bot,{now:()=>at});
 return {bot,calendar,mobs,store,now:()=>at,advance:ms=>{at+=ms;},
  setRealm:r=>{realm=r;},setPersist:value=>{persist=value;}};
}
test('N05 only local sightings and own attributed death enter passive calendar',()=>{
 const f=fixture(),c=f.calendar;
 c.sample();
 assert.equal(c.status().rows.length,1);
 assert.equal(c.status().rows[0].state,'visible-last-sampled');
 assert.equal(c.status().predictionAuthorized,false);
 assert.equal(c.status().executable,false);
 c.hit({actor:'SomeoneElse',target:'e1',damage:50});
 assert.equal(c.death({actor:'SomeoneElse',id:'e1'}),false);
 assert.equal(c.death({actor:'M',id:'e1'}),false,'death alone does not invent kill credit');
 c.hit({actor:'M',target:'e1',damage:12});
 assert.equal(c.death({actor:'M',id:'e1'}),true);
 assert.equal(c.status().rows[0].state,'own-kill-observed');
 assert.equal(c.status().rows[0].respawnAt,null);
 const saved=f.store.get('albot:respawn-calendar:v1:M');
 assert.equal(saved.rows[0].killedAt,f.now());
 assert.equal(saved.rows[0].monster,'phoenix');
 assert.equal(c.death({actor:'M',id:'e1'}),false,'duplicate event is not a second kill');
});
test('N05 disappearance and negative local visibility never impersonate a kill',()=>{
 const f=fixture();f.calendar.sample();f.mobs.length=0;
 f.advance(2000);f.calendar.sample();
 const state=f.calendar.status().rows[0];
 assert.equal(state.state,'not-currently-visible');
 assert.equal(state.missingObservations,1);
 assert.equal(state.killedAt,null);
 assert.equal(state.respawnAt,null);
});
test('N05 a remote map, instance or realm never completes an old hit',()=>{
 for(const changed of ['map','instance','realm']){
  const f=fixture();f.calendar.sample();
  f.calendar.hit({actor:'M',target:'e1',damage:10});
  if(changed==='map')f.bot.p.c.map='other';
  if(changed==='instance')f.bot.p.c.in='different';
  if(changed==='realm')f.setRealm('USI');
  assert.equal(f.calendar.death({actor:'M',id:'e1'}),false,changed);
  assert.equal(f.calendar.status().rows.length,changed==='realm'?0:0);
 }
});
test('N05 bounded checkpoint reload only trusts matching realm and exact owner',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:12});
 f.calendar.death({actor:'M',id:'e1'});
 const saved=f.store.get('albot:respawn-calendar:v1:M');
 assert.equal(fixture(saved).calendar.status().rows[0].state,'own-kill-observed');
 assert.equal(fixture({...saved,owner:'Other'}).calendar.status().rows.length,0);
 assert.equal(fixture({...saved,realm:'USI'}).calendar.status().rows.length,0);
 assert.equal(fixture({...saved,rows:[{...saved.rows[0],lastSeenAt:Date.now()+1000000}]}).calendar.status().rows.length,0);
});
test('N05 persistence failure is diagnostic, not a false durable kill or travel permit',()=>{
 const f=fixture();f.calendar.sample();f.setPersist(false);
 f.calendar.hit({actor:'M',target:'e1',damage:12});
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),true);
 assert.equal(f.calendar.status().persistence,'unconfirmed');
 assert.equal(f.calendar.status().predictionAuthorized,false);
 assert.equal(f.store.size,0);
});
test('N05 bounded sightings never retain more than 64 rows',()=>{
 const f=fixture();f.mobs.length=0;
 for(let i=0;i<90;i++)f.mobs.push({id:'e'+i,mtype:'goo',type:'monster',
  map:'main',in:'main',x:i,y:0,hp:10,dead:false});
 f.calendar.sample();
 assert.equal(f.calendar.status().rows.length,64);
 f.advance(21600001);f.calendar.status();
 assert.equal(f.calendar.status().rows.length,0);
});

test('N05 own confirmed kill starts only a passive finite local scout window',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),true);
 const state=f.calendar.status().rows[0];
 assert.equal(state.scout.state,'observing');
 assert.equal(state.scout.negativeObservations,0);
 assert.equal(state.scout.until,f.now()+300000);
 assert.equal(state.scout.executable,false);
 assert.equal(f.calendar.status().predictionAuthorized,false);
 assert.equal(state.respawnAt,null);
});
test('N05 local negative observations have a hard twelve-sample limit',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),true);
 f.mobs.length=0;
 for(let n=0;n<18;n++){f.advance(2000);f.calendar.sample();}
 const result=f.calendar.status().rows[0];
 assert.equal(result.scout.negativeObservations,12);
 assert.equal(result.scout.state,'negative-evidence-limit');
 assert.equal(result.state,'own-kill-observed');
 assert.equal(result.respawnAt,null);
});
test('N05 scout window expires without sightings or renewed travel permission',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 f.calendar.death({actor:'M',id:'e1'});
 f.mobs.length=0;f.advance(300001);
 const r=f.calendar.status().rows[0];
 assert.equal(r.scout.state,'window-expired');
 assert.equal(r.scout.until,null);
 assert.equal(r.scout.negativeObservations,0);
 assert.equal(r.scout.executable,false);
 assert.equal(r.respawnAt,null);
});
test('N05 a live re-sighting requires an intervening negative local sample',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 f.calendar.death({actor:'M',id:'e1'});
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows[0].scout.state,'none',
  'a stale still-rendered monster cannot count as a newly respawned mob');
 const g=fixture();g.calendar.sample();
 g.calendar.hit({actor:'M',target:'e1',damage:10});g.calendar.death({actor:'M',id:'e1'});
 g.mobs.length=0;g.advance(2000);g.calendar.sample();
 assert.equal(g.calendar.status().rows[0].scout.negativeObservations,1);
 g.mobs.push({id:'e1',mtype:'phoenix',type:'monster',map:'main',in:'main',
  x:20,y:0,hp:100,dead:false});
 g.advance(2000);g.calendar.sample();
 const row=g.calendar.status().rows[0];
 assert.equal(row.scout.state,'live-resighting-observed');
 assert.equal(row.scout.resightedAt,g.now());
 assert.equal(row.killedAt,null);
 assert.equal(row.respawnAt,null);
 g.advance(2000);g.calendar.sample();
 assert.equal(g.calendar.status().rows[0].scout.state,'live-resighting-observed');
});
test('N05 restart and realm change never renew a consumed or historical scout window',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 f.calendar.death({actor:'M',id:'e1'});
 const saved=f.store.get('albot:respawn-calendar:v1:M');
 const reloaded=fixture(saved);
 const old=reloaded.calendar.status().rows[0];
 assert.equal(old.scout.state,'historical-unverified');
 assert.equal(old.scout.until,null);
 reloaded.mobs.length=0;reloaded.advance(2000);reloaded.calendar.sample();
 assert.equal(reloaded.calendar.status().rows[0].scout.negativeObservations,0);
 f.setRealm('USI');assert.equal(f.calendar.status().rows.length,0);
 f.setRealm('EUI');assert.equal(f.calendar.status().rows.length,0);
});
test('N05 local scout evidence cannot be generated from remote instances or absent view',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:10});
 f.calendar.death({actor:'M',id:'e1'});
 f.mobs.length=0;f.bot.p.c.in='instance-other';
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows.length,0);
 f.bot.p.c.in='main';
 f.bot.p.c.x=1200;
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows[0].scout.negativeObservations,0);
});
 
test('N05 an old hit cannot authorize a kill after character-session restart',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:20});
 f.bot.session='M-session-2';
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),false);
 assert.equal(f.calendar.status().rows.length,0);
 assert.equal(f.calendar.status().session,'M-session-2');
 f.calendar.sample();
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),false);
 f.calendar.hit({actor:'M',target:'e1',damage:20});
 assert.equal(f.calendar.death({actor:'M',id:'e1'}),true,
  'fresh hit and sighting in the new session remain actionable as observation');
});
test('N05 active local post-kill scout is invalidated on session drift',()=>{
 const f=fixture();f.calendar.sample();
 f.calendar.hit({actor:'M',target:'e1',damage:20});
 f.calendar.death({actor:'M',id:'e1'});
 assert.equal(f.calendar.status().rows[0].scout.state,'observing');
 f.bot.session='M-session-2';
 assert.equal(f.calendar.status().rows.length,0);
 f.bot.session='M-session-1';
 assert.equal(f.calendar.status().rows.length,0,
  'return to old session must not resurrect stale scouting authority');
});
test('N05 missing or invalid own session cannot generate fresh sightings or credit',()=>{
 for(const invalid of [null,undefined,'',42]){
  const f=fixture();f.bot.session=invalid;
  f.calendar.sample();
  assert.equal(f.calendar.status().rows.length,0);
  f.calendar.hit({actor:'M',target:'e1',damage:20});
  assert.equal(f.calendar.death({actor:'M',id:'e1'}),false);
  assert.equal(f.calendar.status().predictionAuthorized,false);
 }
});

test('N05 stale still-rendered monster never clears a confirmed kill or authorizes duplicate credit',()=>{
 const f=fixture(),c=f.calendar;c.sample();
 c.hit({actor:'M',target:'e1',damage:12});
 assert.equal(c.death({actor:'M',id:'e1'}),true);
 const first=c.status().rows[0].killedAt;
 f.advance(2000);c.sample();
 const row=c.status().rows[0];
 assert.equal(row.killedAt,first);
 assert.equal(row.scout.state,'observing');
 assert.equal(row.scout.negativeObservations,0);
 c.hit({actor:'M',target:'e1',damage:1});
 assert.equal(c.death({actor:'M',id:'e1'}),false,
  'a duplicate hit/death before observed disappearance cannot create a new kill');
 assert.equal(c.status().rows[0].killedAt,first);
});
test('N05 genuine negative observation and later live sighting permit a new separate kill',()=>{
 const f=fixture(),c=f.calendar;c.sample();
 c.hit({actor:'M',target:'e1',damage:10});
 assert.equal(c.death({actor:'M',id:'e1'}),true);
 const first=c.status().rows[0].killedAt;
 f.mobs.length=0;f.advance(2000);c.sample();
 assert.equal(c.status().rows[0].scout.negativeObservations,1);
 f.mobs.push({id:'e1',mtype:'phoenix',type:'monster',
  map:'main',in:'main',x:20,y:0,hp:100,dead:false});
 f.advance(2000);c.sample();
 assert.equal(c.status().rows[0].scout.state,'live-resighting-observed');
 assert.equal(c.status().rows[0].killedAt,null);
 c.hit({actor:'M',target:'e1',damage:10});
 assert.equal(c.death({actor:'M',id:'e1'}),true);
 assert.ok(c.status().rows[0].killedAt>first);
});
test('N05 persisted historical death cannot be overwritten by a stale live render',()=>{
 const first=fixture(),c=first.calendar;c.sample();
 c.hit({actor:'M',target:'e1',damage:10});
 assert.equal(c.death({actor:'M',id:'e1'}),true);
 const saved=first.store.get('albot:respawn-calendar:v1:M');
 const f=fixture(saved),before=f.calendar.status().rows[0].killedAt;
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows[0].killedAt,before);
 assert.equal(f.calendar.status().rows[0].scout.state,'historical-unverified');
 f.mobs.length=0;f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows[0].scout.negativeObservations,0,
  'historical kill must not start a new scout window');
 f.mobs.push({id:'e1',mtype:'phoenix',type:'monster',
  map:'main',in:'main',x:20,y:0,hp:100,dead:false});
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().rows[0].killedAt,null);
 assert.equal(f.calendar.status().rows[0].scout.state,'none',
  'late historical re-sighting is not a predicted respawn');
});
test('N05 invalid local observer geometry never produces positive or negative scout evidence',()=>{
 for(const invalid of [NaN,Infinity,-Infinity,undefined]){
  const f=fixture();f.bot.p.c.x=invalid;
  f.calendar.sample();
  assert.equal(f.calendar.status().rows.length,0);
 }
 const f=fixture(),c=f.calendar;c.sample();
 c.hit({actor:'M',target:'e1',damage:10});c.death({actor:'M',id:'e1'});
 f.mobs.length=0;f.bot.p.c.y=NaN;f.advance(2000);c.sample();
 assert.equal(c.status().rows[0].scout.negativeObservations,0);
 f.bot.p.c.y=0;f.advance(2000);c.sample();
 assert.equal(c.status().rows[0].scout.negativeObservations,1);
});
