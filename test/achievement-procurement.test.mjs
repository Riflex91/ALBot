import test from 'node:test';
import assert from 'node:assert/strict';
import {tracktrixProvisionPlan,createTracktrixProvision}
 from '../src/merchant/achievement-procurement.mjs';

const G={
 tokens:{monstertoken:{tracker:4}},
 items:{monstertoken:{type:'token',npc:'monsterhunter',g:12000},
   tracker:{type:'tracker'}},
 npcs:{monsterhunter:{role:'monstertokens'}}
};
const peer=overrides=>({name:'Ranger1',running:true,rip:false,
 realm:'EUII',achievementCarrier:null,inventoryBlocked:false,
 free:17,journal:false,reserved:false,...overrides});
const items=(quantity=4)=>[{name:'monstertoken',q:quantity,level:0},
  ...Array(41).fill(null)];
function plan(overrides={}){
 const {inventory=items(),heart=peer(),game=G,...other}=overrides;
 return tracktrixProvisionPlan({
  items:inventory,G:game,farmers:['Ranger1'],
  fresh:()=>heart,realm:'EUII',merchantName:'Merchant',
  freeReserve:4,farmerReserve:4,...other
 });
}
test('verified missing recipient and exactly four tokens authorize one bounded exchange',()=>{
 const result=plan();
 assert.deepEqual(result,{
  state:'exchange',recipient:'Ranger1',costTokens:4,
  tokenSlot:0,tokenQuantity:4,trackerBefore:0
 });
});
test('unknown, dead, remote, blocked and covered Farmer cannot authorize buying',()=>{
 for(const overrides of [{achievementCarrier:'unknown'},
  {achievementCarrier:'tracker'},{achievementCarrier:'supercomputer'},
  {running:false},{rip:true},{realm:'USIV'},{free:4},
  {inventoryBlocked:true},{journal:true}]){
  const result=plan({heart:peer(overrides)});
  assert.equal(result.state,'no-confirmed-recipient',JSON.stringify(overrides));
 }
 assert.equal(plan({farmers:[]}).state,'no-confirmed-recipient');
});
test('spare utility gets delivered BEFORE new tokens are spent',()=>{
 assert.equal(plan({inventory:[{name:'tracker'},{name:'tracker'},...Array(40).fill(null)]})
  .state,'deliver-existing');
 assert.equal(plan({inventory:[{name:'supercomputer'},{name:'tracker'},
  ...Array(40).fill(null)]}).state,'deliver-existing');
 assert.equal(plan({inventory:[{name:'tracker'},...Array(41).fill(null)]})
  .state,'need-tokens','Merchant retains its last Tracktrix as designed in PR #67');
});
test('game token source, NPC and price must match the current official G',()=>{
 const copied=()=>structuredClone(G);
 const invalids=[
  g=>{g.tokens.monstertoken.tracker=10;},
  g=>{delete g.tokens.monstertoken.tracker;},
  g=>{g.items.monstertoken.npc='unknown';},
  g=>{g.npcs.monsterhunter.role='other';},
  g=>{delete g.items.tracker;},
  g=>{g.items.monstertoken.type='material';}
 ];
 for(const mutate of invalids){
  const g=copied();mutate(g);
  assert.equal(plan({game:g}).state,'game-source-unverified');
 }
 assert.equal(plan({explicit:true}).state,'explicit-rule');
});
test('first token stack is authoritative, protected, low and fragmented tokens are not spent',()=>{
 assert.equal(plan({inventory:items(3)}).state,'first-token-stack-not-spendable');
 assert.equal(plan({inventory:[{name:'monstertoken',q:2},
  {name:'monstertoken',q:4},...Array(40).fill(null)]})
  .state,'first-token-stack-not-spendable');
 assert.equal(plan({inventory:items(4).map((x,i)=>i===0?{...x,l:'lock'}:x)})
  .state,'first-token-stack-not-spendable');
 assert.equal(plan({inventory:items(4).map((x,i)=>i===0?{...x,q:4.5}:x)})
  .state,'first-token-stack-not-spendable');
});
test('optional purchase respects actual Merchant workspace',()=>{
 const blocked=[{name:'monstertoken',q:4},
  ...Array.from({length:41},(_,i)=>i<37?{name:'other'+i}:null)];
 assert.equal(plan({inventory:blocked}).state,'inventory-pressure');
 const available=[...blocked];available[36]=null;
 assert.equal(plan({inventory:available}).state,'exchange');
});
test('bank must be observed before spending, and a banked Tracktrix wins over purchase',()=>{
 assert.equal(plan({bankEnabled:true}).state,'inspect-bank');
 const now=Date.now(),status={observedAt:now,revision:1};
 assert.equal(plan({bankEnabled:true,bankStatus:status,now,
  bankRows:[{pack:'items0',slot:8,item:{name:'tracker'}}]})
  .state,'retrieve-bank');
 assert.equal(plan({bankEnabled:true,bankStatus:status,now,
  bankRows:[]}).state,'exchange');
 assert.equal(plan({bankEnabled:true,bankStatus:{observedAt:now-600001},
  now}).state,'inspect-bank');
});
function fixture({tokenQty=4,bank=false}={}){
 const c={name:'Merchant',map:'main',in:'main',
  items:items(tokenQty)};
 const calls=[],performed=[];
 const p={c,G,realm:()=> 'EUII',
  call:(name,...args)=>{
   calls.push({name,args});
   assert.equal(name,'exchange_buy');
   assert.deepEqual(args,['monstertoken','tracker']);
   const source=c.items[0],rest=source.q-4;
   c.items[0]=rest?{...source,q:rest}:{name:'tracker',level:0};
   if(rest)c.items[1]={name:'tracker',level:0};
   return Promise.resolve({success:true});
  }};
 const bot={p,running:true,me:{name:'Merchant',role:'merchant'},
  farmers:['Ranger1'],cfg:{
   items:[],merchant:{bank,supply:true,minFreeSlots:4},
   farming:{freeSlots:4}},transport:{fresh:()=>peer()},
  journal:null,inventoryBlocked:false,
  logistics:{reserved:false},
  free:()=>c.items.filter(x=>!x).length,
  economy:{
   destination:()=>({map:'main',in:'main',x:126,y:-413}),
   npcTravel:()=>true,npcAt:()=>true,
   perform:(kind,job)=>{
    performed.push({kind,job});
    assert.equal(job.guard(),true);
    job.call();
    return true;
   }
  }};
 bot.bank={catalogStatus:()=>({observedAt:Date.now()}),
  catalogStock:()=>[],inspect:()=>true};
 return {bot,c,calls,performed,provision:createTracktrixProvision(bot)};
}
test('Merchant performs exact four-token exchange using guarded durable-economy action',()=>{
 const f=fixture();
 assert.equal(f.provision.tick(),true);
 assert.equal(f.performed.length,1);
 assert.equal(f.performed[0].kind,'achievement.tracktrix-exchange');
 assert.equal(f.performed[0].job.loss,48000,'token cost counts against economy loss budget');
 assert.equal(f.performed[0].job.observe(),true);
 assert.equal(f.calls.length,1);
 assert.equal(f.provision.status().state,'need-tokens');
});
test('partial token stacks have exact output receipt and stop once a spare exists',()=>{
 const f=fixture({tokenQty:8});
 assert.equal(f.provision.tick(),true);
 assert.equal(f.performed[0].job.observe(),true);
 assert.equal(f.c.items[0].q,4);
 assert.equal(f.provision.tick(),true);
 assert.equal(f.performed[1].job.observe(),true);
 assert.equal(f.provision.status().state,'deliver-existing');
 assert.equal(f.provision.tick(),false,'do not spend a third batch');
});
test('game state changing after plan invalidates dispatch guard and prevents token value action',()=>{
 const f=fixture();
 const original=f.bot.economy.perform;
 f.bot.economy.perform=(kind,job)=>{
  f.c.items[0].q=3;
  assert.equal(job.guard(),false);
  return false;
 };
 assert.equal(f.provision.tick(),false);
 assert.deepEqual(f.calls,[]);
 f.bot.economy.perform=original;
});
