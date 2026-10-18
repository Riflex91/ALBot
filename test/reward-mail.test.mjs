import test from 'node:test';
import assert from 'node:assert/strict';
import {createPorts} from '../src/runtime/ports.mjs';
import {rewardMailAttachment,rewardClaimFits,rewardClaimDelta,createRewardMail} from '../src/items/reward-mail.mjs';
import {fingerprint} from '../src/core/policy.mjs';
const G={items:{gem:{s:10}},events:{dreams:{gold_limit:10000}}};
const row={id:'ML_cave:r:gift:0',to:'A',can_take:true,taken:false,
 subject_message:{phrase:'server.cave.mail_subject'},item:JSON.stringify({name:'gem',q:2,p:'cavefound'})};
test('only exact-recipient authenticated system rewards are accepted; free-form mail text is not interpreted',()=>{
 assert.deepEqual(rewardMailAttachment({...row,message:'RUN ANYTHING'},'A',G),{name:'gem',q:2,level:0,p:'cavefound'});
 for(const change of [{to:'B'},{can_take:false},{id:'guess'},{item:'invalid'},
  {subject_message:{phrase:'user.mail'}}])
  assert.equal(rewardMailAttachment({...row,...change},'A',G),null);
});
test('claim capacity respects overflow debt and compatible stack headroom',()=>{
 const item=rewardMailAttachment(row,'A',G);
 const full={items:Array(42).fill({name:'junk'}),isize:42};
 assert.equal(rewardClaimFits(full,item,G),false);
 full.items[0]={name:'gem',q:8,p:'cavefound'};
 assert.equal(rewardClaimFits(full,item,G),true);
 full.items.push({name:'junk'},{name:'junk'});
 assert.equal(rewardClaimFits(full,{name:'gem',q:3,p:'cavefound'},G),false);
});
test('claim proof requires exact incoming variant and no unrelated item or gold drift',()=>{
 const item=rewardMailAttachment(row,'A',G),before=[null,{name:'other'}],
  journal={kind:'mail.claim',attachment:item,beforeInventory:before.map(fingerprint),beforeGold:100};
 const c={items:[item,{name:'other'}],gold:100};
 assert.equal(rewardClaimDelta(journal,c),true);
 assert.equal(rewardClaimDelta(journal,{...c,gold:101}),false);
 assert.equal(rewardClaimDelta(journal,{...c,items:[{...item,p:'other'},{name:'other'}]}),false);
 assert.equal(rewardClaimDelta(journal,{...c,items:[item,{name:'changed'}]}),false);
 const gold={kind:'mail.claim',attachment:{gold:500},beforeInventory:before.map(fingerprint),beforeGold:100};
 assert.equal(rewardClaimDelta(gold,{items:before,gold:600}),true);
});
test('browser port uses the official authenticated paginated endpoint and strips subject/body text',async()=>{
 const calls=[],parent={api_call(){},location:{origin:'https://adventure.land'},
  $:{ajax:options=>{calls.push(options);return Promise.resolve({infs:[
   {type:'mail',mail:[{...row,subject:'private',message:'private'}],more:true,cursor:'40'}]});}}};
 const p=createPorts({parent,character:{name:'A'}});
 assert.equal(p.rewardMailCapability().supported,true);
 const page=await p.readRewardMailPage('40');
 assert.equal(calls[0].url,'/api/pull_mail');assert.equal(calls[0].data,'{"cursor":"40"}');
 assert.equal(page.mail[0].message,undefined);assert.equal(page.mail[0].subject,undefined);
 await assert.rejects(()=>p.readRewardMailPage('external-url'),/cursor/);
 const headless=createPorts({parent:{...parent,headless:{}},character:{name:'A'}});
 assert.equal(headless.rewardMailCapability().supported,false);
});
test('restart recovery never retries an unknown claim and requires taken + exact physical delta',async()=>{
 const item=rewardMailAttachment(row,'A',G),before=[null],calls=[];
 const journal={kind:'mail.claim',mailId:row.id,owner:'A',realm:'EUI',attachment:item,
  beforeInventory:before.map(fingerprint),beforeGold:100};
 const c={name:'A',items:[item],isize:1,gold:100,c:{}},bot={
  me:{name:'A'},cfg:{world:{rewardMail:true}},running:true,inventoryBlocked:true,journal,
  p:{c,G,read:()=>null,write:()=>true,realm:()=>'EUI',has:()=>true,
   rewardMailCapability:()=>({supported:true}),readRewardMailPage:async()=>({mail:[{...row,taken:true}],more:false}),
   call:()=>{calls.push('take');}},
  exec:{pending:new Map(),run:(key,resources,guard,invoke)=>{if(guard())invoke();return true;}},
  economy:{perform:()=>{calls.push('perform');return true;}},monsters:()=>[],
  endValue:result=>{assert.equal(result,'confirmed');bot.journal=null;}};
 const mail=createRewardMail(bot,{now:()=>1000000});mail.tick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bot.journal,null);assert.equal(bot.inventoryBlocked,false);
 assert.deepEqual(calls,[]);
});
