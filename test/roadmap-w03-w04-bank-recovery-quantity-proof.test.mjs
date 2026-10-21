import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedBankVariantCount} from '../src/merchant/bank-recovery-quantities.mjs';

const item={name:'beewing',level:0};

test('W03/W04 only exact positive safe item stack quantities form a bank receipt',()=>{
 assert.equal(verifiedBankVariantCount([
  {name:'beewing',q:50},{name:'other',q:-10},
  {name:'beewing',q:49},{name:'beewing'}
 ],item),100,'an absent q is the ordinary one-item form');
 for(const invalid of [null,0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(verifiedBankVariantCount([
   {name:'beewing',q:10},{name:'beewing',q:invalid}
  ],item),null,String(invalid));
 }
 assert.equal(verifiedBankVariantCount([
  {name:'beewing',q:Number.MAX_SAFE_INTEGER},
  {name:'beewing',q:1}
 ],item),null,'safe individually but overflowing aggregate cannot prove stock');
 assert.equal(verifiedBankVariantCount([null,{name:'other',q:Infinity}],item),0,
  'unrelated items do not modify this variant receipt');
 assert.equal(verifiedBankVariantCount(null,item),null);
});

test('W03/W04 bank quantity proofs reject physically impossible game stacks',()=>{
 const G={items:{beewing:{s:99},ring:{}}};
 assert.equal(verifiedBankVariantCount([
  {name:'beewing',q:50},{name:'beewing',q:49}],item,G),99);
 for(const q of [null,0,100,Number.MAX_SAFE_INTEGER]){
  assert.equal(verifiedBankVariantCount([
   {name:'beewing',q:1},{name:'beewing',q}],item,G),null,String(q));
 }
 assert.equal(verifiedBankVariantCount([{name:'ring'},{name:'ring'}],
  {name:'ring'},G),2,'separate single-copy physical slots remain valid');
 assert.equal(verifiedBankVariantCount([{name:'ring',q:2}],
  {name:'ring'},G),null,'one invalid non-stackable row is not two copies');
 assert.equal(verifiedBankVariantCount([{name:'beewing',q:1}],item,
  {items:{}}),null,'unknown source metadata cannot prove bank stock');
});
