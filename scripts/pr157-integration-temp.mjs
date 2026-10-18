import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const show=p=>execFileSync('git',['show','origin/main:'+p],{encoding:'utf8'});
const read=p=>fs.readFileSync(p,'utf8'),save=(p,s)=>fs.writeFileSync(p,s);
function replace(s,a,b,k){const n=s.indexOf(a);if(n<0){if(s.includes(b)){console.log('Already merged: '+k);return s;}throw Error('Missing integration anchor '+k);}return s.slice(0,n)+b+s.slice(n+a.length);}
function add(s,a,b,k){return replace(s,a,a+b,k);}
const cfg=s=>{const x=s.indexOf('globalThis.ALBotConfig='),y=s.indexOf('/* ALBot ',x);if(x<0||y<x)throw Error('Missing personal config');return s.slice(x,y);};
let a=read('bot.js'),b=show('bot.js');save('bot.js',a.replace(cfg(a),cfg(b)));
{
const p='scripts/build.mjs';let s=read(p);
s=replace(s,"'src/combat/team-readiness.mjs',","'src/combat/quest-detachment.mjs','src/combat/team-readiness.mjs',",'build quest');
save(p,s);
}
{
const p='src/combat/farmer.mjs';let s=read(p),m=show(p);
if(!s.includes("import {assessQuestDetachment} from './quest-detachment.mjs';"))s=add(s,"import {neutralPullReadiness,followerReassemblyDistance,followerCombatRendezvous} from './team-readiness.mjs';","\nimport {assessQuestDetachment} from './quest-detachment.mjs';",'quest import');
const x=m.indexOf('    const detachment=assessQuestDetachment(bot);'),y=m.indexOf('    // While a Ranger follows an approved native farm route',x);
if(x<0||y<0)throw Error('main quest init missing');
if(!s.includes('    const detachment=assessQuestDetachment(bot);'))s=add(s,'    const c=p.c,now=Date.now();\n',m.slice(x,y),'quest init');
s=add(s,"    if(bot.strategy?.travel()){bot.skills.rotation(null);return;}\n","    if(questVisitor&&!detachment){waitSafely('Monsterhunt-NPC-Besuch: Farmanker halten; kein sicherer Zweier-Pull');return;}\n",'quest hold');
s=replace(s,'      if(!samePlace(c,leader)||distance(c,leader)>followerReassemblyDistance(cfg)){','      if(!detachment&&(!samePlace(c,leader)||distance(c,leader)>followerReassemblyDistance(cfg))){','no follower chase');
s=replace(s,"      if(leader.questVisit===true||leader.squadQuestVisit===true){waitSafely('Monsterhunt-NPC-Besuch: bei der Gruppe bleiben');return;}","      if(!detachment&&(leader.questVisit===true||leader.squadQuestVisit===true)){waitSafely('Monsterhunt-NPC-Besuch: am Farmanker bleiben');return;}",'quest hold follower');
s=replace(s,'&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running','&&bot.farmers.some(n=>n!==me.name&&n!==detachment?.visitor&&(!bot.transport.fresh(n)?.running','quest visitor exception');
s=replace(s,'    if(me.name===bot.leader&&!bot.monsters().some(','    if(me.name===(detachment?.puller??bot.leader)&&!bot.monsters().some(','validated quest puller');
save(p,s);
}
{
const p='src/party/transport.mjs';let s=read(p);
s=replace(s,"squadQuestVisit:me.name===bot.leader&&(bot.farmers??[]).some(n=>n!==me.name&&bot.transport?.fresh?.(n)?.questVisit===true)",'squadQuestVisit:false','no force escort');
save(p,s);
}
{
const p='src/world/team-plan.mjs';let s=read(p),m=show(p);
const x=m.indexOf('  // A quest collection/turn-in is an individual errand.'),y=m.indexOf('  // Do not replace a valid shared plan while an ally still has hostile aggro.',x);
if(x<0||y<0)throw Error('main anchor logic missing');
if(!s.includes('  const questAbsent=cfg.party.enabled&&'))s=replace(s,'  // Do not replace a valid shared plan while an ally still has hostile aggro.',m.slice(x,y)+'  // Do not replace a valid shared plan while an ally still has hostile aggro.','preserve farm anchor');
const z=s.indexOf('     // When a FOLLOWER is the active hunter, escort that member to Daisy'),w=s.indexOf("     if(['farm','quest-escort'].includes(bot.movement.order?.owner))",z);
if(z>=0&&w>z)s=s.slice(0,z)+'     // Individual quest visits never redirect the remaining farm squad.\n'+s.slice(w);
else if(z<0)console.log('Already merged: no forced NPC escort');
else throw Error('Cannot safely remove conflicting escort branch');
save(p,s);
}
{
const p='src/merchant/bank.mjs';let s=read(p),m=show(p);
const x=m.indexOf('export function reclaimRollbackEvidence('),y=m.indexOf('\n}',x)+2;
if(x<0||y<=x)throw Error('No main rollback verifier');
if(!s.includes('export function reclaimRollbackEvidence('))s=add(s,"import {validateBankSwapRecord,classifyBankSwapRecord} from './bank-swap-recovery.mjs';\n",'\n'+m.slice(x,y)+'\n','main exact rollback verifier');
s=replace(s,"  }else if(evidence.phase==='unchanged'||evidence.phase==='sold'){",
"  }else if(evidence.phase==='restored'){\n   if(p.write(reclaimKey,null)===true)reclaiming=null;\n   else bot.inventoryBlocked=true;\n   return true;\n  }else if(evidence.phase==='rollback-dispatched-unchanged'){\n   bot.inventoryBlocked=true;e.note('Bankrücklagerung: Versand unklar; nicht wiederholen');return true;\n  }else if(evidence.phase==='rollback-prepared')return dispatchRollback(r);\n  else if(evidence.phase==='unchanged'||evidence.phase==='sold'){",
'reclaim rollback outcome');
const authorize=[
"  if(!r.rollback&&r.dispatch&&r.withdrawal&&e.safe(item)&&",
"     p.c.map===packMap(r.pack)&&Array.isArray(p.c.bank?.[r.pack])&&",
"     reclaimRollbackEvidence(r,item,p.c.bank[r.pack][r.slot]??null,",
"      variantCount(p.c.bank[r.pack],r.item))){",
"   const at=Date.now();",
"   const next={...r,rollback:{at,session:bot.session,realm:r.realm,",
"    pack:r.pack,source:r.dest,dest:r.slot,sourcePrint:r.sourcePrint}};",
"   if(validateBankReclaimRecord(next,{owner:me.name,realm:p.realm()}).valid&&",
"      p.write(reclaimKey,next)===true){reclaiming=next;return dispatchRollback(next);}",
"   bot.inventoryBlocked=true;e.note('Bankrücklagerung: Journal nicht gespeichert');return true;",
"  }",
"  if(r.rollback)return dispatchRollback(r);",
""].join('\n');
s=replace(s,"  e.note('Bankfreigabe: Verkaufsberechtigung widerrufen; sichere Aufklärung erforderlich');",authorize+"  e.note('Bankfreigabe: Verkaufsberechtigung widerrufen; sichere Aufklärung erforderlich');",'revoked sale rollback');
const helper=[
" function dispatchRollback(record){",
"  const state=classifyBankReclaimRecord(record,{owner:me.name,realm:p.realm(),",
"   inventory:p.c.items,bank:p.c.bank,map:p.c.map,packMap});",
"  if(state.phase==='restored'){",
"   if(p.write(reclaimKey,null)===true)reclaiming=null;else bot.inventoryBlocked=true;",
"   return true;",
"  }",
"  if(state.phase==='rollback-dispatched-unchanged'){",
"   bot.inventoryBlocked=true;e.note('Bankrücklagerung: API bereits aufgerufen');return true;",
"  }",
"  if(state.phase!=='rollback-prepared')return true;",
"  const phase=()=>classifyBankReclaimRecord(record,{owner:me.name,realm:p.realm(),",
"   inventory:p.c.items,bank:p.c.bank,map:p.c.map,packMap}).phase;",
"  const guard=()=>reclaiming===record&&phase()==='rollback-prepared'&&",
"   e.safe(p.c.items[record.dest])&&",
"   reclaimRollbackEvidence(record,p.c.items[record.dest],",
"    p.c.bank?.[record.pack]?.[record.slot]??null,",
"    variantCount(p.c.bank?.[record.pack]??[],record.item));",
"  e.perform('bank.store',{slots:[record.dest],guard,",
"   call:()=>{",
"    if(!guard()){bot.inventoryBlocked=true;throw Error('Rücklagerung: Slotbeleg verändert');}",
"    const next={...record,rollback:{...record.rollback,dispatchedAt:Date.now()}};",
"    if(!validateBankReclaimRecord(next,{owner:me.name,realm:p.realm()}).valid||",
"       p.write(reclaimKey,next)!==true){",
"     bot.inventoryBlocked=true;throw Error('Rücklagerung: Dispatchbeleg fehlt');",
"    }",
"    reclaiming=next;return p.call('bank_store',record.dest,record.pack,record.slot);",
"   },",
"   observe:()=>!!reclaiming&&classifyBankReclaimRecord(reclaiming,{",
"    owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,",
"    map:p.c.map,packMap}).phase==='restored',",
"   onConfirmed:()=>{",
"    if(!reclaiming||classifyBankReclaimRecord(reclaiming,{",
"     owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,",
"     map:p.c.map,packMap}).phase!=='restored')return false;",
"    if(p.write(reclaimKey,null)!==true){bot.inventoryBlocked=true;return false;}",
"    reclaiming=null;return true;",
"   },",
"   details:{item:record.item.name,quantity:record.quantity,",
"    pack:record.pack,sourceSlot:record.dest,bankSlot:record.slot,",
"    bankTargetBefore:fingerprint(null),bankTargetQuantity:0,",
"    reason:'revoked-emergency-sale-rollback'}});",
"  return true;",
" }",
""].join('\n');
s=replace(s,' function recoverCapacity(){',helper+' function recoverCapacity(){','same-journal rollback');
s=replace(s,'get reclaiming(){return !!reclaiming;},','get reclaiming(){return !!reclaiming;},get rollbackPending(){return !!reclaiming?.rollback&&!reclaiming.rollback.dispatchedAt;},','narrow economy rollback permission');
save(p,s);
}
{
const p='src/merchant/bank-reclaim-recovery.mjs';let s=read(p);
const validation=[
" if(record.rollback!==undefined){",
"  const b=record.rollback;",
"  if(!record.dispatch||!record.withdrawal||record.saleConfirmed||",
"     !b||typeof b!=='object'||Array.isArray(b)||",
"     !safe(b.at)||b.at<record.at||b.at>now+2000||",
"     typeof b.session!=='string'||!b.session||b.realm!==record.realm||",
"     b.pack!==record.pack||b.source!==record.dest||",
"     b.dest!==record.slot||b.sourcePrint!==record.sourcePrint||",
"     (b.dispatchedAt!==undefined&&(!safe(b.dispatchedAt)||",
"      b.dispatchedAt<b.at||b.dispatchedAt>now+2000)))",
"   return reject('invalid-bank-rollback-receipt');",
" }",
""].join('\n');
s=replace(s,' return {valid:true,reason:null};',validation+' return {valid:true,reason:null};','rollback journal validator');
const classify=[
" if(record.rollback){",
"  if(original&&empty&&count===record.before&&bankCount===record.bankBefore)",
"   return record.rollback.dispatchedAt!==undefined?",
"    {phase:'restored',reason:'exact-dispatched-rollback',confirmed:true}:",
"    {phase:'ambiguous',reason:'effect-without-dispatch',confirmed:false};",
"  if(withdrawn&&count===record.before+record.quantity&&",
"     bankCount===record.bankBefore-record.quantity)",
"   return record.rollback.dispatchedAt!==undefined?",
"    {phase:'rollback-dispatched-unchanged',reason:'sent-uncertain',confirmed:false}:",
"    {phase:'rollback-prepared',reason:'unsent-and-exact',confirmed:false};",
"  return {phase:'ambiguous',reason:'rollback-slot-mismatch',confirmed:false};",
" }",
""].join('\n');
s=replace(s,' if(!record.saleConfirmed&&original&&empty&&',classify+' if(!record.saleConfirmed&&original&&empty&&','rollback slot classification');
save(p,s);
}
{
const p='src/merchant/economy.mjs';let s=read(p);
s=replace(s,'  if(closed||!bot.running||bot.inventoryBlocked||bot.journal||bot.bank?.pending',
"  const rollback=kind==='bank.store'&&details.reason==='revoked-emergency-sale-rollback'&&bot.bank?.reclaiming===true&&bot.bank?.rollbackPending===true;\n  if(closed||!bot.running||bot.inventoryBlocked||bot.journal||bot.bank?.pending",'specific rollback admission');
s=replace(s,"!(bot.bank.reclaiming&&['bank.reclaim','sell'].includes(kind))",
"!(bot.bank.reclaiming&&['bank.reclaim','sell'].includes(kind))&&!rollback",
'no general bank bypass');
save(p,s);
}
{
const p='test/20261018-road-aggro-bank-rollback.test.mjs';let s=read(p);
s=add(s,"import {reclaimRollbackEvidence,createBank} from '../src/merchant/bank.mjs';\n","import {fingerprint} from '../src/core/policy.mjs';\n",'production fp');
const x=s.indexOf(" const record={item,pack:'items0',slot:9,dest:3,before:2,bankBefore:18,"),y=s.indexOf(" state.set('albot:bank-reclaim:My_Merchant',record);",x);
if(x<0||y<0)throw Error('outdated smoke fixture changed');
const stamp=[
" const at=Date.now(),sourcePrint=fingerprint(item);",
" const record={version:2,owner:'My_Merchant',realm:'EUII',at,item,",
"  pack:'items0',slot:9,dest:3,before:2,bankBefore:18,quantity:7,",
"  sourcePrint,gold:100,expectedSaleGold:7,explicitOnly:false,",
"  prepared:{kind:'bank.reclaim',session:'previous',at,realm:'EUII',",
"   pack:'items0',slot:9,dest:3,sourcePrint},",
"  dispatch:{kind:'bank.reclaim',session:'previous',at,realm:'EUII',",
"   pack:'items0',slot:9,dest:3,sourcePrint},",
"  withdrawal:{at,realm:'EUII',pack:'items0',slot:9,dest:3,",
"   sourcePrint,inventoryCount:9,bankCount:11}};",
""].join('\n');
s=s.slice(0,x)+stamp+s.slice(y);
s=replace(s,'root:{},parent:{}};','root:{},parent:{},call:()=>true};','mock bank store call');
s=replace(s,"  note:s=>reports.push(s),perform:(kind,data)=>{work.push({kind,data});\n   assert.equal(data.guard(),true);const old=inv[3];bank[9]=old;inv[3]=null;\n   assert.equal(data.observe(),true);return true;}};",
"  note:s=>reports.push(s),perform:(kind,data)=>{work.push({kind,data});\n   assert.equal(data.guard(),true);assert.equal(data.call(),true);\n   assert.ok(state.get('albot:bank-reclaim:My_Merchant').rollback.dispatchedAt);\n   const old=inv[3];bank[9]=old;inv[3]=null;\n   assert.equal(data.observe(),true);assert.equal(data.onConfirmed(),true);return true;}};",
'production v2 verified rollback');
save(p,s);
}
console.log('PR157_MERGE_SEMANTIC_FIXES_APPLIED');
