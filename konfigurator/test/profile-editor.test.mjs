import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,validateProfile} from '../../editor/lib/contract.mjs';
import {
 PROFILE_VIEWS,checkedProfileDocument,profileValue,scalarValue,schemaNode,
 setProfileScalar,addProfileArrayItem,removeProfileArrayItem,profileEnvelope
} from '../public/profile-model.mjs';

const descriptor=FULL_DESCRIPTOR;
const fixture=JSON.parse(await readFile(
 new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const fresh=()=>checkedProfileDocument(fixture,descriptor);

test('four native tabs derive from the authoritative Full-v1 schema',()=>{
 assert.deepEqual(Object.keys(PROFILE_VIEWS),['combat','farming','merchant','team']);
 for(const names of Object.values(PROFILE_VIEWS))
  for(const name of names)assert.ok(descriptor.schema.properties[name]);
 assert.equal(schemaNode(descriptor.schema,['farming','autoTargets']).type,'boolean');
 assert.equal(schemaNode(descriptor.schema,['merchant','maxSpendPerHour']).type,'integer');
 assert.throws(()=>schemaNode(descriptor.schema,['__proto__']),/Unbekannter/);
 assert.throws(()=>schemaNode(descriptor.schema,['merchant','constructor']),/Unbekannter/);
});

test('editing a farming setting preserves all unrelated item and skill rules',()=>{
 const profile=fresh(),original=structuredClone(profile);
 setProfileScalar(profile,descriptor,['farming','maxAggro'],'5');
 assert.equal(profile.config.farming.maxAggro,5);
 assert.deepEqual(profile.config.items,original.config.items);
 assert.deepEqual(profile.config.skills,original.config.skills);
 assert.deepEqual(profile.config.party,original.config.party);
 assert.equal(profileEnvelope(profile).schemaId,'albot.full/v1');
 assert.equal(validateProfile(descriptor,importProfile(descriptor,profile)).length,0);
});

test('numeric limits and enumerations reject malformed values without mutation',()=>{
 const p=fresh(),orig=p.config.merchant.maxSpendPerHour;
 assert.throws(()=>setProfileScalar(p,descriptor,['merchant','maxSpendPerHour'],'Infinity'));
 assert.throws(()=>setProfileScalar(p,descriptor,['merchant','maxSpendPerHour'],'-10'));
 assert.throws(()=>setProfileScalar(p,descriptor,['merchant','maxSpendPerHour'],'5.2'));
 assert.throws(()=>setProfileScalar(p,descriptor,['merchant','maxSpendPerHour'],''));
 assert.equal(p.config.merchant.maxSpendPerHour,orig);
 const mode=schemaNode(descriptor.schema,['farming','mode']);
 assert.throws(()=>scalarValue(mode,'NOT_AN_OPTION'));
 assert.throws(()=>setProfileScalar(p,descriptor,['party','enabled'],'true'));
 assert.equal(p.config.party.enabled,fixture.config.party.enabled);
});

test('list changes preserve original order and do not alter other sections',()=>{
 const p=fresh(),before=structuredClone(p);
 const list=['characters']; const initial=p.config.characters.length;
 addProfileArrayItem(p,descriptor,list);
 assert.equal(p.config.characters.length,initial+1);
 assert.equal(p.config.characters.at(-1).merchantMobility,'mobile');
 removeProfileArrayItem(p,descriptor,list,initial);
 assert.deepEqual(p.config.characters,before.config.characters);
 assert.deepEqual(p.config.production,before.config.production);
 assert.deepEqual(p.config.items,before.config.items);
 assert.throws(()=>removeProfileArrayItem(p,descriptor,['characters'],999));
 assert.throws(()=>addProfileArrayItem(p,descriptor,['party','aoe']));
});

test('unknown, absent, and different profile formats never silently initialize a new profile',()=>{
 assert.throws(()=>checkedProfileDocument(null,descriptor));
 assert.throws(()=>checkedProfileDocument({format:'albot-profile',formatVersion:1,
  schemaId:'albot.live-a/v1',config:{}},descriptor));
 const p=fresh();
 const value=profileValue(p,descriptor,['merchant','bankWorkspace']);
 assert.equal(typeof value,'number');
});

test('browser editors explicitly do not claim activation or store credentials',async()=>{
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 const schema=await readFile(new URL('../public/profile-editor.mjs',import.meta.url),'utf8');
 const model=await readFile(new URL('../public/profile-model.mjs',import.meta.url),'utf8');
 assert.match(app,/api\('\/api\/profile-schema'\)/);
 assert.match(app,/api\('\/api\/profile'\)/);
 assert.match(app,/method:'PUT'/);
 assert.match(app,/sha:profileState.sha/);
 assert.match(app,/Keine Änderung wurde im Spiel aktiviert/);
 assert.match(app,/profileState.dirty&&!window.confirm/);
 assert.match(app,/profileView\(state.view\)\?\(\)=>profileEditorView\(state.view\)/);
 assert.doesNotMatch(app+schema+model,/localStorage|eval\(|new Function\(/);
 assert.doesNotMatch(schema,/innerHTML/);
});

test('Merchant view edits explicitly approved market purchase item rules and relative price caps',()=>{
 assert.ok(PROFILE_VIEWS.merchant.includes('items'),
  'merchant purchase rules must be editable in the native Konfigurator');
 const p=fresh(),initial=p.config.items.length;
 addProfileArrayItem(p,descriptor,['items']);
 const path=['items',initial];
 setProfileScalar(p,descriptor,[...path,'name'],'Testkauf nur mit Freigabe');
 setProfileScalar(p,descriptor,[...path,'item'],'seashell');
 setProfileScalar(p,descriptor,[...path,'role'],'merchant');
 setProfileScalar(p,descriptor,[...path,'action'],'marketBuy');
 setProfileScalar(p,descriptor,[...path,'enabled'],true);
 setProfileScalar(p,descriptor,[...path,'priceSource'],'marketRatio');
 setProfileScalar(p,descriptor,[...path,'marketPercent'],'80');
 setProfileScalar(p,descriptor,[...path,'maxPrice'],'150000');
 assert.equal(p.config.items[initial].marketPercent,80);
 assert.equal(p.config.items[initial].maxPrice,150000);
 assert.equal(p.config.items[initial].enabled,true);
 assert.equal(p.config.items[initial].action,'marketBuy');
 assert.throws(()=>setProfileScalar(p,descriptor,[...path,'marketPercent'],'151'));
 assert.throws(()=>setProfileScalar(p,descriptor,[...path,'marketPercent'],'0'));
 assert.equal(p.config.items[initial].marketPercent,80);
 assert.equal(validateProfile(descriptor,importProfile(descriptor,p)).length,0);
});
