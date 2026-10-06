import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {DESCRIPTOR,ITEM_RULE} from '../lib/schema.mjs';
import {checkDescriptor,defaultsFor,parseData,validateProfile,resolveItem,envelope,importProfile,exportBundle,checkPackage,addMissingDefaults,SLOT_LIMIT} from '../lib/contract.mjs';
const profile=()=>defaultsFor(DESCRIPTOR.schema);
const rule=changes=>({...defaultsFor(ITEM_RULE),...changes});
const query={item:'hpot1',role:'farmer',character:'Ranger',level:0,quantity:500,phase:'inventory'};
const runtime={version:'test',schemaId:DESCRIPTOR.schemaId,contractVersion:1,code:'globalThis.started=globalThis.ALBotConfig.general.name;'};

test('complete default contract is valid and a saved profile round trips without omissions',()=>{
  checkDescriptor(DESCRIPTOR);const c=profile();assert.deepEqual(validateProfile(DESCRIPTOR,c),[]);
  assert.deepEqual(importProfile(DESCRIPTOR,parseData(JSON.stringify(envelope(DESCRIPTOR,c)))),c);
  assert.throws(()=>importProfile(DESCRIPTOR,{name:'legacy'}),/Generatorprofile/);
  const e=envelope(DESCRIPTOR,c);e.schemaId='future/v3';assert.throws(()=>importProfile(DESCRIPTOR,e),/Schema/);
});
test('item priority, character overrides, phases and protected items have one predictable result',()=>{
  const c=profile();c.items=[rule({name:'Global',action:'sell'}),rule({name:'Rolle',role:'farmer',action:'send',recipient:'Merchant',keep:100,targetCount:100}),rule({name:'Persönlich',character:'Ranger',action:'keep',priority:-100})];
  assert.equal(resolveItem(c,query).rule.name,'Persönlich');
  assert.equal(resolveItem(c,{...query,character:'Other'}).quantity,100);
  assert.equal(resolveItem(c,{...query,locked:true}).rule,null);
  assert.equal(resolveItem(c,{...query,reserved:true}).quantity,0);
  assert.equal(resolveItem(c,{...query,character:'Other',phase:'production'}).rule,null);
});
test('overlapping equal priority actions are blocked, separate levels and acquisition are allowed',()=>{
  const c=profile();c.items=[rule({name:'Sell',action:'sell'}),rule({name:'Bank',action:'bank'})];
  assert.match(validateProfile(DESCRIPTOR,c).join('\n'),/Regelkonflikt/);
  c.items[1].priority=1;assert.deepEqual(validateProfile(DESCRIPTOR,c),[]);
  c.items[1].priority=0;c.items[1].action='buy';assert.deepEqual(validateProfile(DESCRIPTOR,c),[]);
  c.items[1].action='bank';c.items[0].maxLevel=2;c.items[1].minLevel=3;assert.deepEqual(validateProfile(DESCRIPTOR,c),[]);
});
test('budgets, recipient references, reserved quantities, thresholds and conditions reject invalid profiles',()=>{
  const c=profile();c.items=[rule({action:'send',recipient:'Missing',keep:200,targetCount:100})];
  c.farming.restBelow=.9;c.farming.resumeAbove=.5;
  c.merchant.expandBank=true;c.merchant.bankBudget=0;
  const errors=validateProfile(DESCRIPTOR,c).join('\n');
  for(const word of ['unbekannter Charakter','Reserve','Schwelle','Budget'])assert.ok(errors.includes(word));
  c.items[0].keep=NaN;assert.match(validateProfile(DESCRIPTOR,c).join('\n'),/Endliche/);
});
test('prototype keys, unsupported executable schema, and schema pretending to be v1 are rejected',()=>{
  assert.throws(()=>parseData('{"__proto__":{"polluted":true}}'),/Datenschlüssel/);
  assert.equal({}.polluted,undefined);
  const d=structuredClone(DESCRIPTOR);d.schema.properties.general.properties.name.pattern='(a+)+';assert.throws(()=>checkDescriptor(d),/Nicht unterstütztes/);
  const minimal={...DESCRIPTOR,schema:{type:'object',properties:{},required:[],additionalProperties:false}};
  assert.ok(validateProfile(minimal,{}).length);
});
test('future additive settings preserve existing values and unknown fields are never silently discarded',()=>{
  const d=structuredClone(DESCRIPTOR),c=profile();c.general.name='My settings';
  d.schema.properties.general.properties.newOption={type:'integer',title:'Neu',default:7,minimum:0,maximum:10};d.schema.properties.general.required.push('newOption');checkDescriptor(d);
  const additions=[],next=addMissingDefaults(d.schema,c,'',additions);
  assert.equal(next.general.name,'My settings');assert.equal(next.general.newOption,7);assert.deepEqual(additions,['general.newOption']);assert.deepEqual(validateProfile(d,next),[]);
  c.general.unrecognized='keep me';const n=addMissingDefaults(d.schema,c);assert.equal(n.general.unrecognized,'keep me');assert.match(validateProfile(d,n).join('\n'),/unbekanntes Feld/);
});
test('compact export reconstructs exact config including Unicode and runs the supplied runtime afterwards',()=>{
  const c=profile();c.general.name='Äpfel </script> 🍎';c.items=[rule({name:'Öl & Items'})];
  const out=exportBundle(DESCRIPTOR,c,runtime),context=vm.createContext({});vm.runInContext(out.code,context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.ALBotConfig)),c);assert.equal(context.started,c.general.name);
  assert.equal(out.bytes,Buffer.byteLength(out.code,'utf8'));assert.ok(!out.code.includes('</script>'));
  assert.throws(()=>exportBundle(DESCRIPTOR,c,null),/Bot-Paket fehlt/);
  assert.throws(()=>exportBundle(DESCRIPTOR,c,{...runtime,code:' '.repeat(SLOT_LIMIT)}),/zu groß/);
});
test('all 638 catalog items can have farmer and merchant rules within the configuration byte budget',async()=>{
  const {readFile}=await import('node:fs/promises');const catalog=JSON.parse(await readFile(new URL('../item-catalog.json',import.meta.url),'utf8'));
  const c=profile();c.items=catalog.items.flatMap(x=>['farmer','merchant'].map(role=>rule({name:x.id+' '+role,item:x.id,role})));
  assert.deepEqual(validateProfile(DESCRIPTOR,c),[]);const out=exportBundle(DESCRIPTOR,c,runtime);assert.ok(out.bytes<500000,out.bytes+' bytes');
});
test('package integrity and contract checked without running the runtime',async()=>{
  const r={...runtime,code:'throw new Error("Do not execute in workshop")'};r.sha256=createHash('sha256').update(r.code).digest('hex');
  const p={format:'albot-package',formatVersion:1,descriptor:DESCRIPTOR,runtime:r};assert.equal(await checkPackage(p),p);
  p.runtime.code+=' ';await assert.rejects(checkPackage(p),/SHA-256/);
});
