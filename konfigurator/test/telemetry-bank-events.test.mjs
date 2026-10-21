import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticTelemetrySender,AUTO_TELEMETRY_INTERVAL_MS}
 from '../../src/runtime/telemetry-auto-sender.mjs';

const token='k'.repeat(64);
const base=1760000000000;
function game(){
 let time=base,reply=()=>({ok:true,status:200,headers:{get:()=> 'application/json'},
  json:async()=>({ok:true})});
 const sent=[];
 const c={name:'My_Merchant',map:'main',level:70,hp:1000,mp:500,
  max_hp:1000,max_mp:500,x:0,y:0,items:[]};
 const sender=createAutomaticTelemetrySender({
  role:'merchant',getCredential:()=>token,getCharacter:()=>c,
  getRealm:()=> 'EUI',getBankDefinitions:()=>({items0:['bank'],items1:['bank']}),
  now:()=>time,fetcher:async(_url,options)=>{
   const packet=JSON.parse(options.body);sent.push(packet);
   return reply(packet,options);
  }
 });
 return {sender,c,sent,advance:ms=>{time+=ms;},
  setReply:fn=>{reply=fn;},
  openBank(){c.map='bank';c.bank={items0:Array(42).fill(null),items1:Array(42).fill(null)};},
  leaveBank(){c.map='main';delete c.bank;sender.observeBank();}
 };
}

test('short bank visit captures real packs and drains them after departure, never invents packs',async()=>{
 const f=game();
 assert.deepEqual(await f.sender.sendOnce(),{character:true,bank:false});
 assert.equal(f.sender.status().lastBank,null);
 f.advance(2500);
 f.openBank();
 assert.equal(f.sender.observeBank(),true);
 assert.equal(f.sender.status().pendingBankPacks,2);
 assert.deepEqual(await f.sender.sendOnce(),{character:false,bank:true});
 assert.equal(f.sent.length,2);
 assert.equal(f.sent[1].data.pack,'items0');
 assert.equal(f.sender.status().pendingBankPacks,1);
 f.leaveBank();
 assert.equal(f.sender.status().pendingBankPacks,1);
 f.advance(AUTO_TELEMETRY_INTERVAL_MS-1);
 await f.sender.sendOnce();
 assert.equal(f.sent.length,2);
 f.advance(1);
 assert.deepEqual(await f.sender.sendOnce(),{character:true,bank:true});
 assert.equal(f.sent[3].data.pack,'items1');
 assert.equal(f.sender.status().pendingBankPacks,0);
 assert.equal(f.sender.status().lastBankSuccess,base+2500+AUTO_TELEMETRY_INTERVAL_MS);
 f.sender.dispose();
});

test('bank initially unloaded does not start bank cooldown; pack becomes eligible when loaded',async()=>{
 const f=game();
 f.c.map='bank';
 assert.deepEqual(await f.sender.sendOnce(),{character:true,bank:false});
 assert.equal(f.sender.status().lastBank,null);
 f.advance(300);
 f.c.bank={items0:Array(42).fill(null)};
 assert.equal(f.sender.observeBank(),true);
 assert.deepEqual(await f.sender.sendOnce(),{character:false,bank:true});
 assert.equal(f.sender.status().lastBank,base+300);
 assert.equal(f.sender.status().lastBankCapture,base+300);
 f.sender.dispose();
});

test('429 preserves captured snapshot and respects retry cooldown outside bank',async()=>{
 const f=game();
 f.openBank();delete f.c.bank.items1;
 let accepted=false;
 f.setReply(async packet=>packet.kind==='bank'&&!accepted?
  {ok:false,status:429,headers:{get:()=> 'application/json'}}:
  {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({ok:true})});
 await f.sender.sendOnce();
 assert.equal(f.sender.status().lastResult,'bank-rejected-429');
 assert.equal(f.sender.status().pendingBankPacks,1);
 f.leaveBank();
 f.advance(AUTO_TELEMETRY_INTERVAL_MS-1);
 await f.sender.sendOnce();
 assert.equal(f.sent.length,2);
 accepted=true;
 f.advance(1);
 await f.sender.sendOnce();
 assert.equal(f.sent[3].kind,'bank');
 assert.equal(f.sender.status().pendingBankPacks,0);
 assert.equal(f.sender.status().lastResult,'bank-success');
 assert.equal(f.sender.status().lastError,null);
 f.sender.dispose();
});

test('a new observation during an in-flight bank request is not lost',async()=>{
 const f=game();
 f.openBank();delete f.c.bank.items1;
 let release;
 f.setReply(async packet=>{
  if(packet.kind!=='bank')return {ok:true,status:200,
    headers:{get:()=> 'application/json'},json:async()=>({ok:true})};
  await new Promise(resolve=>{release=resolve;});
  return {ok:true,status:200,
   headers:{get:()=> 'application/json'},json:async()=>({ok:true})};
 });
 const sending=f.sender.sendOnce();
 for(let n=0;n<20&&!release;n++)await Promise.resolve();
 assert.equal(typeof release,'function');
 f.c.bank.items0[0]={name:'beewings',q:5};
 f.advance(300);
 assert.equal(f.sender.observeBank(),false); // in flight; observed and queued
 release();
 await sending;
 assert.equal(f.sender.status().pendingBankPacks,1);
 f.leaveBank();
 f.advance(AUTO_TELEMETRY_INTERVAL_MS);
 // Replace waiting mock with instant success.
 f.setReply(async()=>({ok:true,status:200,
  headers:{get:()=> 'application/json'},json:async()=>({ok:true})}));
 await f.sender.sendOnce();
 const bankPackets=f.sent.filter(p=>p.kind==='bank');
 assert.equal(bankPackets.length,2);
 assert.equal(bankPackets[1].data.slots[0].q,5);
 f.sender.dispose();
});

test('success clears stale network error and bank data is removed on dispose',async()=>{
 const f=game();
 f.setReply(async()=>{throw Error('offline');});
 await f.sender.sendOnce();
 assert.equal(f.sender.status().lastError,'character-network-error');
 f.openBank();
 f.advance(500);
 f.setReply(async()=>({ok:true,status:200,
  headers:{get:()=> 'application/json'},json:async()=>({ok:true})}));
 assert.equal(f.sender.observeBank(),true);
 assert.equal((await f.sender.sendOnce()).bank,true);
 assert.equal(f.sender.status().lastError,null);
 assert.ok(f.sender.status().pendingBankPacks>0);
 f.sender.dispose();
 assert.equal(f.sender.status().pendingBankPacks,0);
});
