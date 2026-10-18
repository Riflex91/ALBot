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
 const bot={p,me:{name:'M'},running:true,monsters:()=>mobs,
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
