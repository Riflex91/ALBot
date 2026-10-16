import test from 'node:test';
import assert from 'node:assert/strict';
import {purposeReservations} from '../src/production/purpose-allocation.mjs';
import {finiteMutationPlan} from '../src/production/mutation-plan.mjs';
import {bossProfile,bossReadiness} from '../src/combat/bosses.mjs';
import {createAdaptive} from '../src/world/adaptive.mjs';
import {createMarketDemand} from '../src/merchant/market-demand.mjs';
import {advise,validAdaptive} from '../cloud/advisor.mjs';
import {BudgetLedger,reserveBudget} from '../cloud/worker.mjs';
import {selectAccountTeam} from '../src/party/account.mjs';

const goal=(item,name=item,recipient='')=>({name,item,recipient,level:0,quantity:1,enabled:true});
test('all active recipe demands sum, while existing outputs can satisfy only one goal',()=>{
 const G={items:{a:{},b:{},mat:{}},craft:{a:{items:[[3,'mat']]},b:{items:[[4,'mat']]}}};
 let plan=purposeReservations({G,goals:[goal('a'),goal('b')],stock:()=>0});
 assert.equal(plan.quantity({name:'mat'}),7);
 plan=purposeReservations({G,goals:[goal('a','one','A'),goal('a','two','B')],stock:n=>n==='a'?1:0});
 assert.equal(plan.quantity({name:'mat'}),3);assert.equal(plan.quantity({name:'a'}),2);
 plan=purposeReservations({G,goals:[goal('mat','send','A'),goal('a','craft','A')],stock:()=>0,recipient:'A',recipientItem:{name:'mat'}});
 assert.equal(plan.quantity({name:'mat'}),3,'delivery cannot consume another recipe for the same recipient');
 G.craft.mat={items:[[1,'a']]};assert.equal(purposeReservations({G,goals:[goal('a')],stock:()=>0}).blocked,true);
});
test('finite policy accounts for future level upside, helper exhaustion and compound failures',()=>{
 const common={counts:[1,0,0],resources:[2],helpers:[{id:'s',cost:10,uses:[[0,1]]}],price:l=>[100,105,300][l],chance:()=>1,maxLevel:2,budget:20};
 const two=finiteMutationPlan(common);assert.equal(two.action,'upgrade');assert.equal(two.value,280);
 assert.equal(finiteMutationPlan({...common,resources:[1]}).action,'sell');
 const compound=finiteMutationPlan({...common,compound:true,counts:[6,0,0],resources:[2],maxLevel:1,chance:()=>.7,price:l=>l?1000:100});
 assert.equal(compound.action,'compound');assert.ok(compound.value>600);
 const exhausted=finiteMutationPlan({...common,maxStates:1});assert.equal(exhausted.action,'bank');
});
test('boss readiness recognises guard phases and refuses unsupported mechanics or insufficient damage',()=>{
 const G={monsters:{pinkgoo:{special:true,'1hp':true,hp:40,attack:10,frequency:1,avoidance:0},dragold:{special:true,hp:1000,attack:10,frequency:1,abilities:{multi_burn:{damage:10,cooldown:24000}}}}};
 const team=[{name:'P',ctype:'priest',hp:10000,max_hp:10000,mp:1000,max_mp:1000,attack:100,frequency:2}];
 assert.equal(bossReadiness(G,'pinkgoo',null,team).safe,true);
 assert.equal(bossReadiness(G,'pinkgoo',{s:{fullguard:{ms:100}}},team).phase,'WAIT');
 assert.equal(bossReadiness(G,'pinkgoo',null,[{...team[0],mp:1}]).safe,false);
 G.monsters.pinkgoo.avoidance=99.99;assert.equal(bossReadiness(G,'pinkgoo',null,team).safe,false);
 G.monsters.dragold.abilities.new_mechanic={};assert.equal(bossProfile(G,'dragold').supported,false);
});
function adaptiveFixture(){const memory=new Map();const bot={me:{name:'A'},farmers:['A'],cfg:{world:{adaptiveLearning:true}},p:{G:{version:1,monsters:{goo:{}}},realm:()=> 'EU1',read:k=>memory.get(k),write:(k,v)=>{memory.set(k,structuredClone(v));return true;}},gear:{snapshot:()=>({slots:{}})},transport:{fresh:()=>null},teamPlan:{candidates:()=>['goo']},strategy:{safeTarget:()=>true}};return {bot,memory};}
test('learning proposals require empirical evidence, roll back after failure and reject foreign context',()=>{
 const {bot}=adaptiveFixture(),a=createAdaptive(bot);
 const proposal=()=>[{target:'goo',factor:1.1,context:a.context(),expires:Date.now()+10000}];
 assert.equal(a.accept(proposal()),false);
 for(let i=0;i<5;i++)a.episode({target:'goo',seconds:10,reward:100});
 assert.equal(a.accept(proposal()),true);assert.equal(a.factor('goo'),1.1);
 a.episode({target:'goo',seconds:3,failed:true});assert.ok(a.factor('goo')<1);assert.equal(a.accept(proposal()),false);
 assert.equal(a.accept([{...proposal()[0],factor:.5,code:'sell everything'}]),false);
 const old=a.snapshot();bot.p.G.version=2;assert.equal(a.restore(old),true);assert.equal(a.factor('goo'),1);
});
test('market sale evidence is required and an expired automatic offer is pinned through delayed dispatch',()=>{
 const {bot}=adaptiveFixture();let now=Date.now(),job;const original=Date.now;Date.now=()=>now;
 try{
  Object.assign(bot.cfg,{merchant:{autoMarket:true,listingTtlMs:60000,minFreeSlots:2},production:{goldPerHour:0,minImprovement:.05}});
  bot.p.c={slots:{},tax:.05};bot.p.G.items={mat:{}};bot.p.has=()=>true;bot.p.call=()=>true;bot.free=()=>10;
  bot.economy={explicit:()=>null,value:()=>1,count:()=>0,perform:(_,j)=>{job=j;return true;}};bot.production={reservedQuantity:()=>0};
  const market=createMarketDemand(bot),item={name:'mat'},rule={action:'sell',_autoDisposition:true,minPrice:1};
  assert.equal(market.proposal(item,rule),null);
  for(let n=0;n<3;n++){now+=3000;market.sale({seller:'S',buyer:'B'+n,item:{name:'mat',price:100,q:1}});}
  const r=market.proposal(item,rule);assert.equal(r.action,'list');bot.p.c.slots[r.slot]={name:'mat',price:95,q:1};
  assert.equal(market.posted(r.slot,item,r),true);now+=60001;assert.equal(market.expire(),true);assert.equal(job.guard(),true);
  bot.p.c.slots[r.slot].price=96;assert.equal(job.guard(),false);
 }finally{Date.now=original;}
});
test('AI output is declarative, bounded and cannot bypass failure or field checks',async()=>{
 const row={target:'goo',context:'abc',samples:5,failures:0,seconds:50,reward:500,at:Date.now()};
 const input=[{character:'A',adaptive:{version:1,rows:[row]}}];
 assert.equal(validAdaptive(input[0].adaptive),true);
 const env={AI_ENABLED:'true',AI_FREE_PLAN_CONFIRMED:'true',AI:{run:async(model,args)=>{assert.equal(model,'@cf/meta/llama-3.2-1b-instruct');assert.equal(args.max_tokens,256);return {response:'{"weights":[{"index":0,"factor":1.1}]}'};}}};
 assert.equal((await advise(env,input))[0].proposals[0].target,'goo');
 row.failures=1;assert.deepEqual(await advise(env,input),[]);
 env.AI.run=async()=>({response:'{"weights":[],"code":"evil"}'});assert.deepEqual(await advise(env,input),[]);
 env.AI_FREE_PLAN_CONFIRMED='false';assert.deepEqual(await advise(env,input),[]);
});
test('bounded retention removes the cumulative byte stop but keeps the shared daily quota',()=>{
 const now=Date.now(),old={day:new Date(now).toISOString().slice(0,10),requests:1,totalBytes:1048576};
 assert.equal(reserveBudget(old,100,now),null);
 assert.equal(reserveBudget(old,100,now,true).totalBytes,1048676);
 assert.equal(reserveBudget({...old,requests:24},100,now,true),null);
});
test('cloud restores only bounded same-roster aggregates and charges the common budget',async()=>{
 const values=new Map(),storage={get:async k=>values.get(k),put:async(k,v)=>{values.set(k,v);},transaction:async fn=>fn(storage)};
 const row={target:'goo',context:'abc',samples:5,failures:0,seconds:50,reward:500,at:Date.now()};
 const env={FREE_PLANS_CONFIRMED:'true',BUDGET_VERIFIED_AT:new Date().toISOString(),CHARACTERS:'M,A',BOUNDED_RETENTION:'true'};
 const ledger=new BudgetLedger({storage},env);
 const payload={version:1,character:'M',at:Date.now(),learning:[],team:[{character:'A',adaptive:{version:1,rows:[row]}}]};
 assert.equal((await ledger.fetch(new Request('https://test/snapshot',{method:'POST',body:JSON.stringify(payload)}))).status,200);
 const response=await ledger.fetch(new Request('https://test/restore',{method:'POST',body:JSON.stringify({character:'A'})}));
 assert.deepEqual((await response.json()).adaptive.rows,[row]);assert.equal(values.get('budget').requests,2);
 assert.equal((await ledger.fetch(new Request('https://test/restore',{method:'POST',body:'{"character":"outsider"}'}))).status,403);
});

test('B2 retention keeps eight receipts and freezes after an ambiguous upload',async()=>{
 const original=globalThis.fetch,values=new Map();let uploads=0,deletes=0,requests=0,fail=false;
 const storage={get:async k=>values.get(k),put:async(k,v)=>{values.set(k,structuredClone(v));},transaction:async fn=>fn(storage)};
 globalThis.fetch=async(url,options)=>{requests++;const path=String(url);
  if(path.includes('b2_authorize_account'))return Response.json({apiUrl:'https://api001.backblazeb2.com',authorizationToken:'test'});
  if(path.includes('b2_delete_file_version')){deletes++;return Response.json({});}
  if(path.includes('b2_get_upload_url'))return Response.json({uploadUrl:'https://pod.backblazeb2.com/upload',authorizationToken:'test'});
  if(path.endsWith('/upload')){uploads++;if(fail)throw Error('lost receipt');return Response.json({fileId:'id'+uploads,fileName:decodeURIComponent(options.headers['X-Bz-File-Name'])});}
  throw Error('Unexpected provider');
 };
 try{
  const env={FREE_PLANS_CONFIRMED:'true',BUDGET_VERIFIED_AT:new Date().toISOString(),CHARACTERS:'M',BOUNDED_RETENTION:'true',B2_ENABLED:'true',B2_KEY_ID:'test',B2_APPLICATION_KEY:'test',B2_BUCKET_ID:'new-test'};
  const ledger=new BudgetLedger({storage},env),time=Date.now();
  const request=n=>new Request('https://test/snapshot',{method:'POST',body:JSON.stringify({version:1,character:'M',at:time+n,learning:[]})});
  for(let n=0;n<9;n++)assert.equal((await ledger.fetch(request(n))).status,200);
  assert.equal(uploads,9);assert.equal(deletes,1);assert.equal(values.get('archive:M').rows.length,8);
  fail=true;assert.equal((await ledger.fetch(request(10))).status,502);const before=requests;
  assert.equal(values.get('archive:M').pending,true);
  assert.equal((await ledger.fetch(request(11))).status,502);assert.equal(requests,before,'uncertain upload is never retried');
 }finally{globalThis.fetch=original;}
});

test('boss team preferences select fast physical attackers while fixed members remain authoritative',()=>{
 const members=[['P','priest'],['W','warrior'],['R1','ranger'],['R2','ranger'],['M','mage']].map(([name,c])=>({name,class:c,running:true,level:80,rotation:true}));
 assert.deepEqual(selectAccountTeam(members,3,{boss:true,preferredClasses:['priest','ranger','ranger']}),['P','R1','R2']);
 assert.ok(selectAccountTeam(members,3,{boss:true,leader:'W',preferredClasses:['priest','ranger','ranger']}).includes('W'));
});

test('reflection excludes magical damage, vampire reward is not an aura, and shell needs real burst margin',()=>{
 const G={monsters:{greenjr:{hp:10,attack:1,frequency:1,reflection:100},mvampire:{hp:10,attack:1,frequency:1,rbuff:'mlifesteal'},rimedjinn:{hp:10000,attack:1,frequency:1,abilities:{rimeshell:{duration:3000,break_fraction:.05}}}}};
 const mage={name:'M',ctype:'mage',hp:10000,max_hp:10000,mp:1000,max_mp:1000,attack:1000,frequency:1};
 assert.equal(bossReadiness(G,'greenjr',null,[mage]).safe,false);
 assert.equal(bossReadiness(G,'greenjr',null,[{...mage,ctype:'ranger'}]).safe,true);
 assert.equal(bossProfile(G,'mvampire').supported,true);
 assert.equal(bossReadiness(G,'rimedjinn',{s:{rimeshell:{ms:100,remaining:500}}},[mage]).safe,false);
 assert.equal(bossReadiness(G,'rimedjinn',{s:{rimeshell:{ms:3000,remaining:500}}},[mage]).phase,'BREAK_SHELL');
});

test('boss readiness includes freeze slowdown, accumulated burn, critical burst and lifesteal',()=>{
 const G={monsters:{icegolem:{hp:1000,attack:10,frequency:1,abilities:{multi_freeze:{damage:10,cooldown:2000}}},dragold:{hp:1000,attack:100,frequency:1,abilities:{multi_burn:{damage:100,cooldown:4000}}},jr:{hp:1000,attack:100,frequency:1,crit:100,critdamage:200}}};
 const c={name:'P',ctype:'priest',hp:10000,max_hp:10000,mp:1000,max_mp:1000,attack:100,frequency:1};
 const frozen=bossReadiness(G,'icegolem',null,[c]);
 assert.ok(frozen.dps>0&&frozen.dps<30,'typed shadow gate applies a conservative planning margin');
 assert.ok(frozen.damageShadow.newEstimate<frozen.damageShadow.oldEstimate);
 assert.ok(bossReadiness(G,'dragold',null,[c]).incoming>350,'burn damage must include its accumulating five-second DoT');
 assert.equal(bossReadiness(G,'jr',null,[{...c,hp:1000,max_hp:1000}]).safe,false);
 G.monsters.jr.lifesteal=100;assert.equal(bossReadiness(G,'jr',null,[c]).safe,false);
});

test('learning does not attribute an old-context episode to new gear and force-flush preserves recent evidence',()=>{
 const {bot,memory}=adaptiveFixture(),a=createAdaptive(bot),old=a.context();
 a.episode({target:'goo',seconds:10,reward:10});a.flush();
 a.episode({target:'goo',seconds:10,reward:10});a.flush(true);
 assert.equal(memory.get('albot:adaptive:v1:A').rows[0].samples,2);
 bot.p.G.version=2;assert.equal(a.episode({target:'goo',seconds:10,reward:10,contextKey:old}),false);
 assert.equal(a.snapshot().rows.length,0);
});

test('cloud lifetime roster and retention mode cannot be reset by changing environment flags',async()=>{
 const values=new Map(),storage={get:async k=>values.get(k),put:async(k,v)=>{values.set(k,structuredClone(v));},transaction:async fn=>fn(storage)};
 const env={FREE_PLANS_CONFIRMED:'true',BUDGET_VERIFIED_AT:new Date().toISOString(),CHARACTERS:'A,B,C,D',BOUNDED_RETENTION:'true'};
 const ledger=new BudgetLedger({storage},env),at=Date.now();
 const req=(character,n)=>new Request('https://test/snapshot',{method:'POST',body:JSON.stringify({version:1,character,at:at+n,learning:[]})});
 for(const [n,c] of [...'ABCD'].entries())assert.equal((await ledger.fetch(req(c,n))).status,200);
 env.CHARACTERS='A,B,C,E';assert.equal((await ledger.fetch(req('E',5))).status,429);
 env.BOUNDED_RETENTION='false';assert.equal((await ledger.fetch(req('A',6))).status,429);
 env.BUDGET_VERIFIED_AT=new Date(at-8*86400000).toISOString();assert.equal((await ledger.fetch(req('A',7))).status,503);
});

test('runtime learning consumes only its own advice from a fresh same-realm merchant',()=>{
 const {bot}=adaptiveFixture();bot.cfg.party={merchant:'M'};const a=createAdaptive(bot);
 for(let n=0;n<5;n++)a.episode({target:'goo',seconds:10,reward:100});
 const peer={running:true,realm:'US1',advice:[{character:'A',proposals:[{target:'goo',factor:1.1,context:a.context(),expires:Date.now()+10000}]}]};
 bot.transport.fresh=name=>name==='M'?peer:null;
 a.tick();assert.equal(a.factor('goo'),1);
 peer.realm='EU1';a.tick();assert.equal(a.factor('goo'),1.1);
 a.episode({target:'goo',seconds:10,failed:true});a.tick();assert.ok(a.factor('goo')<1,'replayed heartbeat must not restore a rolled-back proposal');
});
