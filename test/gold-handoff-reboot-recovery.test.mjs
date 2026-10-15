import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery,inspectGoldRecovery,goldRecoveryEvidence} from '../src/core/recovery.mjs';

function oldGoldPair({receiverExtra=15,receiverLoss=0,sendLoss=14150}={}){
 const id='My_Ranger1-old-sender-session:gold:1',amount=14150;
 const stored={My_Ranger1:new Map(),My_Merchant:new Map()}, bots={};
 const entries=[
  ['My_Ranger1','My_Merchant','gold.send','old-merchant-session',24150,
    24150-sendLoss],
  ['My_Merchant','My_Ranger1','gold.receive','My_Ranger1-old-sender-session',
    200000,200000+amount+receiverExtra-receiverLoss]
 ];
 for(const [name,other,kind,session,before,gold] of entries){
  const journal={kind,id,peer:other,session,quantity:amount,before,at:Date.now()-10000,
   evidence:{realm:'USIV',gold:before,inventory:[]}};
  const bot={journal,inventoryBlocked:true,me:{name},
   cfg:{party:{merchant:'My_Merchant'},general:{messageTtlMs:10000}},
   running:true,checkpoint:{durable:true},exec:{pending:new Map()},
   p:{c:{gold,items:[]},realm:()=> 'USIV',
     read:key=>stored[name].get(key)??null,
     write:(key,v)=>{stored[name].set(key,v);return true;}},
   event:()=>{},endValue(result){
    assert.equal(result,'confirmed');
    this.journal=null;
   }};
  bots[name]=bot;
 }
 for(const [name,bot] of Object.entries(bots)){
  const other=name==='My_Ranger1'?'My_Merchant':'My_Ranger1';
  bot.transport={fresh:n=>{
   if(n!==other)return null;
   const b=bots[other];
   return {name:other,realm:'USIV',running:true,rip:false,
    inventoryBlocked:b.inventoryBlocked,journal:!!b.journal,
    goldBalance:b.p.c.gold,
    goldReconcile:b.recovery.goldEvidence()};
  }};
  bot.recovery=createRecovery(bot);
 }
 return {bots,stored,id,amount};
}

test('paired old gold journals automatically clear exact sender loss despite +15 Merchant income',()=>{
 const {bots,id,amount,stored}=oldGoldPair();
 const farmer=bots.My_Ranger1,merchant=bots.My_Merchant;
 const first=inspectGoldRecovery(farmer);
 const second=inspectGoldRecovery(merchant);
 assert.equal(first.eligible,true);
 assert.equal(second.eligible,true);
 assert.equal(second.extraReceived,15);
 assert.equal(first.local.id,id);
 assert.equal(first.local.quantity,amount);
 const old=Date.now;let now=old();
 Date.now=()=>now;
 try{
  assert.equal(farmer.recovery.reconcile(),false,'stable sample required');
  assert.equal(merchant.recovery.reconcile(),false);
  now+=1500;
  assert.equal(farmer.recovery.reconcile(),true);
  assert.equal(farmer.journal,null);
  assert.equal(farmer.inventoryBlocked,false);
  assert.equal(farmer.recovery.goldEvidence()?.verified,true);
  // Merchant must still be able to finish after farmer clears its journal.
  assert.equal(merchant.recovery.reconcile(),true);
  assert.equal(merchant.journal,null);
  assert.equal(merchant.inventoryBlocked,false);
  assert.equal(merchant.p.c.gold,214165);
  assert.equal(farmer.p.c.gold,10000);
  assert.ok(stored.My_Ranger1.get('albot:gold:My_Ranger1:recovery-receipt'));
  assert.ok(stored.My_Merchant.get('albot:gold:My_Merchant:recovery-receipt'));
 }finally{Date.now=old;}
});

test('already-verified peer remains usable when its gold balance changes after unlocking',()=>{
 const {bots}=oldGoldPair();
 const farmer=bots.My_Ranger1,merchant=bots.My_Merchant;
 const original=Date.now;let now=original();
 Date.now=()=>now;
 try{
  farmer.recovery.reconcile();merchant.recovery.reconcile();
  now+=1200;
  assert.equal(farmer.recovery.reconcile(),true);
  farmer.p.c.gold+=10;
  assert.equal(merchant.recovery.reconcile(),true);
 }finally{Date.now=original;}
});

test('fail closed when peer, amount, session, realm or observed value cannot be proved',()=>{
 const make=()=>oldGoldPair().bots;
 let b=make();b.My_Ranger1.transport.fresh=()=>null;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Merchant.journal.id='unrelated';
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Merchant.journal.quantity=999;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Merchant.journal.session='wrong';
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Ranger1.p.c.gold=10001;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=oldGoldPair({receiverLoss:100}).bots;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Merchant.p.realm=()=> 'EUII';
 assert.equal(inspectGoldRecovery(b.My_Merchant).eligible,false);
 b=make();b.My_Merchant.inventoryBlocked=false;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Ranger1.checkpoint.durable=false;
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
 b=make();b.My_Ranger1.exec.pending.set('gold.send',{});
 assert.equal(inspectGoldRecovery(b.My_Ranger1).eligible,false);
});

test('persistent receipt write failure preserves old journal and cannot repeat gold dispatch',()=>{
 const {bots}=oldGoldPair(),farmer=bots.My_Ranger1;
 const old=Date.now;let now=old();Date.now=()=>now;
 try{
  assert.equal(farmer.recovery.reconcile(),false);
  now+=2000;
  farmer.p.write=()=>false;
  assert.equal(farmer.recovery.reconcile(),false);
  assert.ok(farmer.journal);
  assert.equal(farmer.inventoryBlocked,true);
  assert.equal(farmer.recovery.status().gold.reason,'recovery-receipt-write-failed');
 }finally{Date.now=old;}
});

test('gold journal evidence rejects malformed, unsigned, wrong-realm or unlocked state',()=>{
 const {bots}=oldGoldPair(),j=bots.My_Ranger1.journal;
 assert.equal(goldRecoveryEvidence(j,10000,'USIV').quantity,14150);
 assert.equal(goldRecoveryEvidence(j,10000,'EUII'),null);
 assert.equal(goldRecoveryEvidence(j,10000,'USIV',false),null);
 assert.equal(goldRecoveryEvidence({...j,quantity:-10},10000,'USIV'),null);
 assert.equal(goldRecoveryEvidence({...j,id:'unrelated'},10000,'USIV'),null);
 assert.equal(goldRecoveryEvidence({...j,kind:'sell'},10000,'USIV'),null);
});
