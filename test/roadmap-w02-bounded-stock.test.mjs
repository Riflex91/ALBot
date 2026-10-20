import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedStockSurplus,boundedExcessSaleRule,localVariantQuantity} from '../src/items/stock-policy.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {ITEM_RULE} from '../editor/lib/schema.mjs';

const G={items:{
 ore:{type:'material'},potion:{type:'pot'},magicring:{compound:true},
 dungeonkey:{type:'key'},currency:{type:'token'},mystery:{type:'material',action:'special'}
},craft:{forging:{items:[[3,'ore',0]]}}};
const keep=(changes={})=>({...defaultsFor(ITEM_RULE),
 name:'Limit ore',enabled:true,action:'keep',item:'ore',
 role:'all',minLevel:0,maxLevel:99,keep:2,teamReserve:0,
 targetCount:10,maxCount:12,batch:100,excessAction:'sell',
 minPrice:500,...changes});
function fixture(item,rule=keep(),custom={}){
 let reserved=custom.reserved??0;
 const p={c:{name:'Merchant',items:[item],map:'main',gold:10000,slots:{}},
  G,read:()=>null,realm:()=> 'EUI',call:()=>1000};
 const cfg={items:[rule],merchant:{
  budgetMode:'bounded',maxSpendPerHour:5000,goldReserve:0
 },production:{lossBudget:5000}};
 const me={name:'Merchant',role:'merchant',goldReserve:0};
 const bot={p,cfg,me,production:{reservedQuantity:()=>reserved}};
 const economy=createEconomy(bot);
 return {bot,economy,p,rule,setReserved:n=>{reserved=n;}};
}

test('W02 maximum caps only truly disjoint uncommitted physical copies',()=>{
 assert.deepEqual(boundedStockSurplus({
  held:20,reserved:6,keep:2,maximum:10}),{
  valid:true,reason:'bounded-excess',held:20,reserved:6,
  keep:2,teamReserve:0,maximum:10,protectedFloor:10,excess:10});
 const busy=boundedStockSurplus({
  held:20,reserved:14,keep:2,maximum:10});
 assert.equal(busy.protectedFloor,16);
 assert.equal(busy.excess,4);
 assert.equal(boundedStockSurplus({
  held:20,reserved:20,keep:2,maximum:10}).excess,0);
});
test('W02 unknown, overflow, negative and fractional stocks fail closed',()=>{
 for(const held of [null,Infinity,NaN,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  const result=boundedStockSurplus({held,maximum:10});
  assert.equal(result.valid,false);
  assert.equal(result.excess,0);
 }
 assert.equal(boundedStockSurplus({
  held:20,reserved:Number.MAX_SAFE_INTEGER,keep:1,maximum:10
 }).valid,false);
});
test('W02 local variant counts exclude other levels and stat variants',()=>{
 const own={name:'ore',q:12,level:0};
 const otherLevel={name:'ore',q:500,level:1};
 const otherStat={name:'ore',q:500,level:0,stat_type:'str'};
 assert.equal(localVariantQuantity([own,otherLevel,otherStat],own),12);
 assert.equal(localVariantQuantity([own,{...own,q:Infinity}],own),null);
});
test('W02 absent opt-in or an old keep rule never produces a sale',()=>{
 const item={name:'ore',q:30};
 assert.equal(boundedExcessSaleRule({
  item,inventory:[item],G,rule:keep({excessAction:'hold'})
 }),null);
 const {economy}=fixture(item,keep({excessAction:'hold'}));
 assert.equal(economy.rules(item).action,'keep');
});
test('W02 no sale from disabled rules, wrong items or insufficient excess',()=>{
 const item={name:'ore',q:12};
 for(const rule of [keep({enabled:false}),keep({item:'potion'}),
  keep({action:'sell'}),keep({excessAction:'hold'})]){
  assert.equal(boundedExcessSaleRule({item,inventory:[item],G,rule}),null);
 }
 assert.equal(boundedExcessSaleRule({
  item,inventory:[item],G,rule:keep(),reserved:1
 }),null);
});
test('W02 only ordinary known variants, not gear, keys or quest utility',()=>{
 const rule=keep({maxCount:1,keep:0,teamReserve:0,targetCount:1});
 for(const name of ['magicring','dungeonkey','currency','mystery','unlisted']){
  const item={name,q:50};
  assert.equal(boundedExcessSaleRule({
   item,inventory:[item],G,rule:{...rule,item:name}
  }),null,name);
 }
 const special={name:'ore',q:50,stat_type:'int'};
 assert.equal(boundedExcessSaleRule({
  item:special,inventory:[special],G,rule
 }),null);
 const potion={name:'potion',q:50};
 assert.equal(boundedExcessSaleRule({
  item:potion,inventory:[potion],G,
  rule:{...rule,item:'potion'}
 })?.action,'sell');
});
test('W02 derived sale remains limited by original batch, quantity and price floor',()=>{
 const item={name:'ore',q:25};
 const {economy}=fixture(item,keep({maxCount:20,keep:2,batch:100,minPrice:700}));
 const derived=economy.rules(item);
 assert.equal(derived.action,'sell');
 assert.equal(derived._autoBoundedExcess,true);
 assert.equal(derived.batch,5);
 assert.equal(derived.minPrice,700);
 assert.equal(economy.spare(0,derived),5);
});
test('W02 reservation changes before dispatch reduce or eliminate eligible sale',()=>{
 const item={name:'ore',q:30};
 const {economy,setReserved}=fixture(item,keep({maxCount:15,keep:2,batch:15}));
 const derived=economy.rules(item);
 assert.equal(economy.spare(0,derived),15);
 setReserved(20);
 assert.equal(economy.spare(0,derived),8);
 setReserved(28);
 assert.equal(economy.spare(0,derived),0);
 assert.equal(economy.rules(item).action,'keep');
});
test('W02 source rule must still match live realm/map/task at dispatch',()=>{
 const item={name:'ore',q:40};
 const rule=keep({map:'main'});
 const {economy,p}=fixture(item,rule);
 const candidate=economy.rules(item);
 assert.equal(economy.spare(0,candidate),28);
 p.c.map='other';
 assert.equal(economy.spare(0,candidate),0);
 p.c.map='main';rule.excessAction='hold';
 assert.equal(economy.spare(0,candidate),0);
});
test('W02 sale never breaks source stock floor after a partial stack change',()=>{
 const item={name:'ore',q:30};
 const {economy}=fixture(item,keep({maxCount:15,batch:15}));
 const candidate=economy.rules(item);
 item.q=17;
 assert.equal(economy.spare(0,candidate),2);
 item.q=15;
 assert.equal(economy.spare(0,candidate),0);
});
test('W02 no local copy and no derived permission from stale bank assumptions',()=>{
 const item={name:'ore',q:10};
 const {economy}=fixture(item,keep({maxCount:12}));
 assert.equal(economy.rules(item).action,'keep');
 assert.equal(boundedStockSurplus({held:null,reserved:0,
  keep:0,teamReserve:0,maximum:12}).valid,false);
});

test('W02 physical variant total distinguishes omitted q from explicit null',()=>{
 const item={name:'ore',level:0};
 assert.equal(localVariantQuantity([{...item}],item),1);
 assert.equal(localVariantQuantity([{...item,q:null}],item),null);
 assert.equal(localVariantQuantity([{...item,q:0}],item),null);
 assert.equal(localVariantQuantity([{...item,q:5},{...item,q:3}],item),8);
 assert.equal(localVariantQuantity([{...item,q:-1},{...item,q:1}],item),null);
});
