import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackerAcquisition} from '../src/merchant/tracker-acquisition.mjs';

function fixture({tokens=4,own='tracker',peerCarrier=null,free=12,
 price=4,tokenLocked=false,reserved=0,existingState=null}={}){
 const items=[{name:'monstertoken',q:tokens,level:0,...(tokenLocked?{l:true}:{})},
  ...(own?[{name:own,level:0}]:[]),
  ...Array(own?40:41).fill(null)];
 const c={name:'Merchant',map:'main',in:'main',items,gold:300000};
 const records=new Map(),calls=[],actions=[],movements=[];
 if(existingState)records.set('albot:tracker-exchange:Merchant',existingState);
 let merchantCanReach=true,writeAllowed=true;
 const peer={name:'Ranger',running:true,rip:false,realm:'EUII',
  achievementCarrier:peerCarrier,free,inventoryBlocked:false,
  journal:false};
 const G={tokens:{monstertoken:{tracker:price}},
  items:{tracker:{type:'tracker'},supercomputer:{type:'computer'},
   monstertoken:{type:'token'}}};
 const p={c,G,realm:()=> 'EUII',
  read:key=>records.get(key)??null,
  write:(key,value)=>{
   if(!writeAllowed)return false;records.set(key,value);return true;
  },
  call:(name,token,reward)=>{
   calls.push([name,token,reward]);
   assert.deepEqual([name,token,reward],['exchange_buy','monstertoken','tracker']);
   const old=c.items[0],left=old.q-4;
   c.items[0]=left?{...old,q:left}:null;
   const freeSlot=c.items.findIndex(i=>!i);
   assert.ok(freeSlot>=0);
   c.items[freeSlot]={name:'tracker',level:0};
   return Promise.resolve({success:true,name:'tracker'});
  }};
 const cfg={items:[],merchant:{enabled:true,supply:true,minFreeSlots:4},
   farming:{freeSlots:4}};
 const bot={p,cfg,me:{name:'Merchant',role:'merchant'},farmers:['Ranger'],
  running:true,inventoryBlocked:false,journal:null,checkpoint:{durable:true},
  bank:{pending:false},logistics:{reserved:false},
  production:{reservedQuantity:()=>reserved},
  transport:{fresh:name=>name==='Ranger'?peer:null}};
 const destination={name:'monsterhunter',map:'main',x:20,y:10};
 bot.economy={
  destination:()=>destination,
  npcTravel:()=>{movements.push('npcTravel');return merchantCanReach;},
  npcAt:()=>merchantCanReach,
  perform:(kind,job)=>{
   actions.push({kind,job});
   if(!job.guard())return false;
   job.call();
   assert.equal(job.observe(),true);
   return true;
  }
 };
 const acquisition=createTrackerAcquisition(bot);
 return {bot,c,G,p,peer,calls,actions,movements,records,acquisition,
  setReachable:value=>merchantCanReach=value,
  setWritable:value=>writeAllowed=value};
}
test('verified four-token exchange is exactly one journalled purchase for one missing Farmer',()=>{
 const f=fixture();
 assert.equal(f.acquisition.eligible(),true);
 assert.equal(f.acquisition.tick(),true);
 assert.deepEqual(f.calls,[['exchange_buy','monstertoken','tracker']]);
 assert.equal(f.c.items.filter(i=>i?.name==='tracker').length,2);
 assert.equal(f.c.items.some(i=>i?.name==='monstertoken'),false);
 assert.equal(f.actions[0].kind,'tracker.exchange');
 assert.deepEqual(f.actions[0].job.slots,[0]);
 assert.equal(f.actions[0].job.details.tokensSpent,4);
 assert.equal(f.acquisition.status().pendingRecipient,'Ranger');
 assert.equal(f.records.get('albot:tracker-exchange:Merchant').recipient,'Ranger');
});
test('durable recipient assignment blocks duplicate purchases across reloads until confirmed',()=>{
 const f=fixture({tokens:12});
 assert.equal(f.acquisition.tick(),true);
 assert.equal(f.acquisition.tick(),false);
 const next=createTrackerAcquisition(f.bot);
 assert.equal(next.eligible(),false,'same valid durable pending assignment survives re-create');
 assert.equal(next.tick(),false);
 assert.equal(f.calls.length,1);
 f.peer.achievementCarrier='tracker';
 assert.equal(next.tick(),false,'one spare purchased Tracktrix still exists for delivery');
 assert.equal(next.status().pendingRecipient,null);
 assert.equal(f.records.get('albot:tracker-exchange:Merchant'),null);
});
test('wrong token count, malformed price, locked source and no own carrier do not spend',()=>{
 for(const opts of [
  {tokens:3},{tokens:0},{price:5},{price:null},{tokenLocked:true},
  {own:null},{peerCarrier:'unknown'},{peerCarrier:'tracker'},
  {peerCarrier:'supercomputer'},{free:4},{reserved:1}
 ]){
  const f=fixture(opts);
  assert.equal(f.acquisition.eligible(),false,JSON.stringify(opts));
  assert.equal(f.acquisition.tick(),false,JSON.stringify(opts));
  assert.equal(f.calls.length,0);
 }
});
test('spare Tracktrix or user-authored token rule blocks unnecessary exchange',()=>{
 const spare=fixture();
 spare.c.items[2]={name:'tracker',level:0};
 assert.equal(spare.acquisition.eligible(),false);
 const explicit=fixture();
 explicit.bot.cfg.items=[{enabled:true,item:'monstertoken',
   action:'keep',role:'merchant'}];
 assert.equal(explicit.acquisition.eligible(),false);
});
test('NPC travel is required and first token stack is pinned, not a different later stack',()=>{
 const f=fixture();
 f.setReachable(false);
 assert.equal(f.acquisition.tick(),false);
 assert.equal(f.calls.length,0);
 f.setReachable(true);
 assert.equal(f.acquisition.tick(),true);
 const mixed=fixture({tokens:3});
 mixed.c.items[2]={name:'monstertoken',q:40,level:0};
 assert.equal(mixed.acquisition.tick(),false,
   'runner exchange_buy always picks first matching token stack');
 assert.equal(mixed.calls.length,0);
});
test('inventory mutation between planning and execution revokes the token exchange guard',()=>{
 const f=fixture();
 let guard;
 f.bot.economy.perform=(kind,job)=>{guard=job.guard;return true;};
 assert.equal(f.acquisition.tick(),true);
 assert.equal(guard(),true);
 f.c.items[0].q=5;
 assert.equal(guard(),false,'first-token quantity must be exactly pinned');
 assert.equal(f.calls.length,0);
});
test('failed durable assignment cannot reach game exchange method',()=>{
 const f=fixture();
 f.setWritable(false);
 assert.throws(()=>f.acquisition.tick(),/dauerhaft gespeichert/);
 assert.equal(f.calls.length,0);
 assert.equal(f.acquisition.status().pendingRecipient,null);
});
test('unknown persisted intent freezes future token spending rather than resetting it',()=>{
 const f=fixture({existingState:{recipient:'Ranger',at:'invalid'}});
 assert.equal(f.acquisition.eligible(),false);
 assert.equal(f.acquisition.tick(),false);
 assert.equal(f.acquisition.status().reason,'invalid-durable-state');
 assert.equal(f.calls.length,0);
});

test('live banked Tracktrix is retrieved before spending four Monster Tokens',()=>{
 const f=fixture({tokens:8});
 f.G.bank_packs={items0:['bank',42]};
 f.c.bank={items0:[{name:'tracker',level:0},...Array(41).fill(null)]};
 const requests=[];
 f.bot.bank.retrieve=(item,rule,wanted)=>{
  requests.push({item,rule,wanted});
  const place=f.c.items.findIndex(i=>!i);
  f.c.items[place]=f.c.bank.items0[0];
  f.c.bank.items0[0]=null;
  return true;
 };
 assert.equal(f.acquisition.eligible(),true);
 assert.equal(f.acquisition.tick(),true);
 assert.equal(requests.length,1);
 assert.equal(requests[0].rule.pack,'items0');
 assert.equal(requests[0].wanted,1);
 assert.equal(requests[0].item.name,'tracker');
 assert.equal(f.calls.length,0,'tokens must remain untouched when banked Tracker exists');
 assert.equal(f.c.items.filter(i=>i?.name==='tracker').length,2);
 assert.equal(f.acquisition.eligible(),false,'newly retrieved spare can be distributed');
});
test('missing bank pack definition cannot authorize a guessed retrieval',()=>{
 const f=fixture();
 f.c.bank={items0:[{name:'tracker'}]};
 assert.equal(f.acquisition.tick(),true,
  'without verified bank pack mapping only documented token route is usable');
 assert.equal(f.calls.length,1);
});
test('protected, variant-modified or nonstandard bank Trackers cannot be retrieved implicitly',()=>{
 const variants=[
  {name:'tracker',l:true},{name:'tracker',level:1},
  {name:'tracker',data:{gift:1}},{name:'tracker',q:2},
  {name:'tracker',acc:'x'},{name:'tracker',rid:'x'}
 ];
 for(const variant of variants){
  const f=fixture();
  f.G.bank_packs={items0:['bank',42]};
  f.c.bank={items0:[variant]};
  assert.equal(f.acquisition.tick(),true,JSON.stringify(variant));
  assert.equal(f.calls.length,1,'not a safe bank retrieve variant: '+JSON.stringify(variant));
 }
});
test('pending token order prevents bank retrieval until confirmed recipient',()=>{
 const f=fixture({existingState:{recipient:'Ranger',at:Date.now()}});
 f.G.bank_packs={items0:['bank',42]};
 f.c.bank={items0:[{name:'tracker',level:0}]};
 let retrieved=false;
 f.bot.bank.retrieve=()=>{retrieved=true;return true;};
 assert.equal(f.acquisition.eligible(),false);
 assert.equal(f.acquisition.tick(),false);
 assert.equal(retrieved,false);
});
test('below Merchant reserve bank retrieval is not an emergency shortcut',()=>{
 const f=fixture();
 f.G.bank_packs={items0:['bank',42]};
 f.c.bank={items0:[{name:'tracker',level:0}]};
 for(let i=2;i<38;i++)f.c.items[i]={name:'gem0'};
 // Only four slots remain; neither retrieval nor token purchase is allowed.
 assert.equal(f.c.items.filter(i=>!i).length,4);
 assert.equal(f.acquisition.eligible(),false);
 assert.equal(f.acquisition.tick(),false);
 assert.equal(f.calls.length,0);
});
