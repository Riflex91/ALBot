import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectReceiveSenderSession} from '../src/items/transfer-reconciliation.mjs';
import {createRecovery} from '../src/core/recovery.mjs';
import {createLogistics} from '../src/items/logistics.mjs';
import {fingerprint} from '../src/core/policy.mjs';

const old='My_Ranger1-old-session',current='My_Ranger1-new-session';
const journal={
 kind:'receive',id:old+':2',from:'My_Ranger1',session:old,
 ownerSession:'My_Merchant-s1',quantity:1,before:0,at:10000,
 item:{name:'ringsj',level:0,stat_type:'',p:'',title:''},
 evidence:{realm:'USV',gold:200000,inventory:[null,null]}
};
const sender=(patch={})=>({name:'My_Ranger1',session:current,
 realm:'USV',running:true,rip:false,received:20000,...patch});
function check(peer=sender(),j=journal){
 return inspectReceiveSenderSession({journal:j,peer,
  ownerSession:'My_Merchant-s1',realm:'USV',now:20500,ttlMs:10000});
}
test('real live Ranger1 sender restart is identifiable but never transaction proof',()=>{
 const r=check();
 assert.equal(r.changed,true);
 assert.equal(r.reason,'sender-session-changed-during-receive');
 assert.equal(r.newSession,current);
 assert.equal(r.authority,'none');
 assert.equal(r.executable,false);
 assert.equal(r.unlock,false);
 assert.equal(r.retry,false);
 assert.equal(r.requiresManualReview,true);
});
test('same sender session and missing peer evidence never imply any restart',()=>{
 assert.equal(check(sender({session:old})).reason,
  'original-sender-session-still-live');
 assert.equal(check(null).changed,false);
 assert.equal(check(sender({received:1000})).changed,false);
 assert.equal(check(sender({received:21000})).changed,false);
 assert.equal(check(sender({realm:'EU2'})).changed,false);
 assert.equal(check(sender({name:'Imposter'})).changed,false);
 assert.equal(check(sender({running:false})).changed,false);
 assert.equal(check(sender({rip:true})).changed,false);
});
test('receiver itself restarted or old journal lacks session pin; never infer sender restart',()=>{
 assert.equal(inspectReceiveSenderSession({journal,peer:sender(),
  ownerSession:'My_Merchant-new',realm:'USV',now:20500}).reason,
  'receiver-session-unpinned-or-restarted');
 assert.equal(check(sender(),{...journal,ownerSession:null}).changed,false);
 assert.equal(check(sender(),{...journal,id:'other:2'}).changed,false);
 assert.equal(check(sender(),{...journal,kind:'send'}).changed,false);
});
test('saved receive journal shows restart even if original mutable incoming job was lost',()=>{
 const event=[];
 const c={name:'My_Merchant',map:'main',items:[null,null],gold:200000};
 const bot={
  journal:{...journal,at:Date.now()-1000,evidence:{
   realm:'USV',gold:200000,inventory:[null,null]}},
  inventoryBlocked:true,session:'My_Merchant-s1',
  me:{name:'My_Merchant',role:'merchant'},
  cfg:{general:{messageTtlMs:10000}},p:{c,realm:()=> 'USV',
   read:()=>null,write:()=>true},checkpoint:{durable:true},
  transport:{fresh:()=>sender({received:Date.now()-100})},
  event:(type,data)=>event.push({type,data}),
  exec:{pending:new Map()}
 };
 const status=createRecovery(bot).itemStatus();
 assert.equal(status.senderSessionChanged,true);
 assert.equal(status.senderSessionReason,'sender-session-changed-during-receive');
 assert.equal(status.originalSenderSession,old);
 assert.equal(status.peerSession,current);
 assert.equal(status.localVerified,false);
 assert.equal(status.paired,false);
 assert.equal(status.unlocksValueActions,false);
 assert.equal(bot.inventoryBlocked,true);
 assert.equal(bot.journal.kind,'receive');
 assert.deepEqual(event,[]);
});
function liveFixture(){
 let t=10000,removed=0;
 const events=[],messages=[],item={name:'ringsj',level:0,
  stat_type:'',p:'',title:''};
 const me={name:'My_Merchant',role:'merchant'};
 const c={name:me.name,map:'main',in:'main',x:0,y:0,gold:100,
  items:Array(42).fill(null)};
 const cfg={merchant:{enabled:true,pickup:true,maxDelivery:10,minFreeSlots:4},
  general:{messageTtlMs:1000},party:{merchant:me.name},
  farming:{freeSlots:4},items:[]};
 const bot={me,cfg,session:'My_Merchant-s1',running:true,
  inventoryBlocked:false,journal:null,free:()=>42,
  p:{c,realm:()=> 'USV',G:{items:{ringsj:{type:'ring'}}}},
  entity:n=>n==='My_Ranger1'?{name:n,map:'main',in:'main',x:10,y:0}:null,
  rule:()=>null,
  transport:{
   fresh:()=>({name:'My_Ranger1',session:current,
    realm:'USV',running:true,rip:false,received:Date.now()}),
   send:(to,type,data,id)=>{messages.push({to,type,data,id});return true;}
  },
  economy:{safe:()=>true},
  exec:{now:()=>t,pending:new Map(),busy:()=>false,run:()=>false},
  event:(type,data)=>events.push({type,data}),
  beginValue(j){this.journal=j;},
  endValue(state){if(state==='unknown')this.inventoryBlocked=true;
   else if(state==='confirmed'){this.journal=null;removed++;}},
 };
 bot.logistics=createLogistics(bot);
 return {bot,c,events,messages,item,advance(ms){t+=ms;},
  removed:()=>removed};
}
test('actual receive poll emits once on sender session change; timeout keeps durable journal',()=>{
 const f=liveFixture();
 // initial acceptance had the original session, then fresh peer reloaded.
 f.bot.transport.fresh=()=>({name:'My_Ranger1',session:old,
  realm:'USV',running:true,rip:false,received:Date.now()});
 f.bot.logistics.receive('My_Ranger1',{type:'offer',
  id:old+':2',session:old,data:{item:f.item,quantity:1}});
 assert.equal(f.bot.journal?.kind,'receive');
 f.bot.transport.fresh=()=>({name:'My_Ranger1',session:current,
  realm:'USV',running:true,rip:false,received:Date.now()});
 f.bot.logistics.poll(false);
 f.bot.logistics.poll(false);
 const notices=f.events.filter(x=>x.type==='logistics.senderSessionChangedDuringReceive');
 assert.equal(notices.length,1);
 assert.equal(notices[0].data.originalSession,old);
 assert.equal(notices[0].data.newSession,current);
 assert.equal(notices[0].data.senderAnnouncedDispatch,false);
 assert.equal(notices[0].data.autoRetry,false);
 assert.equal(f.bot.journal.kind,'receive');
 f.advance(1001);
 f.bot.logistics.poll(false);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.journal.kind,'receive');
 assert.equal(f.removed(),0);
 assert.equal(f.events.find(x=>x.type==='logistics.timeout')?.data.senderSessionChanged,true);
 assert.equal(f.messages.filter(x=>x.type==='accept').length,1);
 assert.equal(f.messages.filter(x=>x.type==='offer').length,0);
});
