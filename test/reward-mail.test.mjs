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
   rewardMailCapability:()=>({supported:true}),readRewardMailPage:async()=>({mail:[{...row,taken:true,can_take:false}],more:false}),
   call:()=>{calls.push('take');}},
  exec:{pending:new Map(),run:(key,resources,guard,invoke)=>{if(guard())invoke();return true;}},
  economy:{perform:()=>{calls.push('perform');return true;}},monsters:()=>[],
  endValue:result=>{assert.equal(result,'confirmed');bot.journal=null;}};
 const mail=createRewardMail(bot,{now:()=>1000000});mail.tick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bot.journal,null);assert.equal(bot.inventoryBlocked,false);
 assert.deepEqual(calls,[]);
});

test('recovered taken mail is attested without re-enabling ordinary mail claims',()=>{
 const taken={...row,taken:true,can_take:false};
 const item=rewardMailAttachment(row,'A',G);
 assert.equal(rewardMailAttachment(taken,'A',G),null);
 assert.deepEqual(rewardMailAttachment(taken,'A',G,{recoverTaken:true}),item);
 assert.equal(rewardMailAttachment({...row,can_take:false},'A',G,{recoverTaken:true}),null,
  'recovery must require the server taken marker');
 assert.equal(rewardMailAttachment({...taken,to:'B'},'A',G,{recoverTaken:true}),null);
 assert.equal(rewardMailAttachment({...taken,subject_message:{phrase:'user.mail'}},'A',G,
  {recoverTaken:true}),null);
});

test('taken mail recovery refuses a different attachment or contradictory physical balance',async()=>{
 const attachment=rewardMailAttachment(row,'A',G);
 const before=[null],badReplies=[
  {...row,taken:false,can_take:false},
  {...row,taken:true,can_take:false,
   item:JSON.stringify({name:'gem',q:2,p:'different'})},
  {...row,taken:true,can_take:false,to:'Other'},
  {...row,taken:true,can_take:false,subject_message:{phrase:'user.mail'}}
 ];
 for(const mailRow of badReplies){
  const journal={kind:'mail.claim',mailId:row.id,owner:'A',realm:'EUI',
   attachment,beforeInventory:before.map(fingerprint),beforeGold:100};
  const calls=[];
  const bot={me:{name:'A'},cfg:{world:{rewardMail:true}},running:true,
   inventoryBlocked:true,journal,
   p:{c:{name:'A',items:[attachment],isize:1,gold:100,c:{}},
    G,read:()=>null,write:()=>true,realm:()=>'EUI',has:()=>true,
    rewardMailCapability:()=>({supported:true}),
    readRewardMailPage:async()=>({mail:[mailRow],more:false}),
    call:()=>calls.push('unexpected-take')},
   exec:{pending:new Map(),run:(key,res,guard,invoke)=>{
    if(guard())invoke();return true;}},
   economy:{perform:()=>calls.push('unexpected-value-attempt')},
   monsters:()=>[],endValue:()=>calls.push('unexpected-confirm')};
  createRewardMail(bot,{now:()=>1000000}).tick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(bot.journal,journal,'unproven value outcome stays durable');
  assert.equal(bot.inventoryBlocked,true);
  assert.deepEqual(calls,[],'no claim replay or settlement on weak evidence');
 }
});

test('G03 failed cursor persistence cannot authorize a subsequent reward claim',async()=>{
 const scheduled=[],attempts=[];
 const bot={me:{name:'A'},cfg:{world:{rewardMail:true}},running:true,
  journal:null,inventoryBlocked:false,
  p:{c:{name:'A',items:[null,null],isize:2,gold:100,c:{}},
   G,read:()=>null,write:()=>false,realm:()=>'EUI',has:()=>true,
   rewardMailCapability:()=>({supported:true}),
   readRewardMailPage:async()=>({mail:[{...row}],more:false})},
  bank:{pending:false},logistics:{reserved:false},monsters:()=>[],
  exec:{pending:new Map(),run:(key,resources,guard,invoke)=>{
   if(guard())scheduled.push(Promise.resolve(invoke()).catch(()=>{}));
   return true;}},
  economy:{perform:()=>{attempts.push('claim');return true;}}
 };
 const mail=createRewardMail(bot,{now:()=>1000000});
 mail.tick();await Promise.all(scheduled);
 assert.equal(mail.status().reason,'mail-cursor-storage-unavailable');
 assert.equal(mail.status().queued,0);
 mail.tick();
 assert.deepEqual(attempts,[],'the next tick cannot act on an uncommitted page');
});

test('G03 malformed cursor pagination cannot leak claimable rows into queue',async()=>{
 const scheduled=[],attempts=[];
 const bot={me:{name:'A'},cfg:{world:{rewardMail:true}},running:true,
  journal:null,inventoryBlocked:false,
  p:{c:{name:'A',items:[null,null],isize:2,gold:100,c:{}},
   G,read:()=>null,write:()=>true,realm:()=>'EUI',has:()=>true,
   rewardMailCapability:()=>({supported:true}),
   readRewardMailPage:async()=>({mail:[{...row}],more:true,cursor:'0'})},
  bank:{pending:false},logistics:{reserved:false},monsters:()=>[],
  exec:{pending:new Map(),run:(key,resources,guard,invoke)=>{
   if(guard())scheduled.push(Promise.resolve(invoke()).catch(()=>{}));
   return true;}},
  economy:{perform:()=>{attempts.push('claim');return true;}}
 };
 const mail=createRewardMail(bot,{now:()=>1000000});
 mail.tick();await Promise.all(scheduled);
 assert.equal(mail.status().queued,0);
 mail.tick();
 assert.deepEqual(attempts,[]);
});

test('W10/W13 explicit null reward quantity or level is never implicit one',()=>{
 for(const key of ['q','level'])for(const value of [
  null,-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1
 ]){
  const attachment={name:'gem',q:1,level:0};
  attachment[key]=value;
  assert.equal(rewardMailAttachment({...row,item:JSON.stringify(attachment)},'A',G),
   null,key+':'+String(value));
 }
 assert.equal(rewardMailAttachment({...row,item:'{"name":"gem"}'},'A',G)?.q,1);
 assert.equal(rewardMailAttachment({...row,item:'{"name":"gem","level":0,"q":1}'},'A',G)?.q,1);
});

test('W10/W13 physical claim capacity cannot depend on malformed inventory copies',()=>{
 const base={items:[null,{name:'gem',q:5,p:'cavefound'}],isize:2};
 assert.equal(rewardClaimFits(base,{name:'gem',q:1,p:'cavefound'},G),true);
 for(const quantity of [null,0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const c={...base,items:[null,{name:'gem',q:quantity,p:'cavefound'}]};
  assert.equal(rewardClaimFits(c,{name:'gem',q:1,p:'cavefound'},G),
   false,String(quantity));
 }
 assert.equal(rewardClaimFits(base,{name:'gem',q:null,p:'cavefound'},G),false);
});

test('W10/W13 exact server receipt plus q:null physical item never confirms claim',()=>{
 const attachment={name:'gem',level:0,q:1,p:'cavefound'},
  before=[null],journal={kind:'mail.claim',attachment,
   beforeInventory:before.map(fingerprint),beforeGold:100};
 assert.equal(rewardClaimDelta(journal,{items:[attachment],gold:100}),true);
 for(const quantity of [null,0,-1,0.5,NaN,Infinity]){
  const c={items:[{...attachment,q:quantity}],gold:100};
  assert.equal(rewardClaimDelta(journal,c),false,String(quantity));
 }
 const corruptedBefore={items:[{name:'junk',q:null},null],isize:2};
 assert.equal(rewardClaimFits(corruptedBefore,attachment,G),false,
  'malformed unrelated before-image cannot certify the action');
});
