import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAccountStockPolicy} from '../src/items/account-stock-policy.mjs';

const item={name:'beewings',level:0};
const row={item,quantity:8000,protectedUnits:0,reservedUnits:0};
const baseline=()=>({mode:'shadow-only',executable:false,
 complete:true,bankScope:'verified-current-map',
 variants:[structuredClone(row)]});
const policy={item,keep:1000,targetCount:3000,maxCount:5000};

test('account target shows Bee Wings provisional excess without sale authority',()=>{
 const result=previewAccountStockPolicy({ledger:baseline(),...policy});
 assert.equal(result.quantity,8000);
 assert.equal(result.protectedFloor,5000);
 assert.equal(result.provisionalExcess,3000);
 assert.equal(result.reason,'global-bank-coverage-unverified');
 assert.equal(result.saleAuthorized,false);
 assert.equal(result.executable,false);
});
test('current-map completeness is NOT global bank completeness',()=>{
 const b=baseline();b.complete=true;b.bankScope='verified-current-map';
 b.coverage={allBankPacks:true};
 const result=previewAccountStockPolicy({ledger:b,...policy});
 assert.equal(result.status,'unverified');
 assert.equal(result.saleAuthorized,false);
});
test('protected and reserved units raise the protected floor',()=>{
 const b=baseline();
 b.variants[0].reservedUnits=3500;
 b.variants[0].protectedUnits=2000;
 const result=previewAccountStockPolicy({ledger:b,...policy});
 assert.equal(result.protectedFloor,6500);
 assert.equal(result.provisionalExcess,1500);
 assert.equal(result.saleAuthorized,false);
});
test('partial ledger never interprets an unobserved item as zero',()=>{
 const b=baseline();b.complete=false;b.variants=[];
 const result=previewAccountStockPolicy({ledger:b,...policy});
 assert.equal(result.quantity,null);
 assert.equal(result.provisionalExcess,0);
 assert.equal(result.status,'unverified');
});
test('unproven variants, duplicate rows and invalid limits fail closed',()=>{
 const b=baseline();b.variants.push(structuredClone(row));
 assert.equal(previewAccountStockPolicy({ledger:b,...policy}).reason,'duplicate-account-variant');
 assert.equal(previewAccountStockPolicy({ledger:baseline(),
  ...policy,item:{...item,data:{unknown:1}}}).reason,'invalid-or-opaque-item-variant');
 assert.equal(previewAccountStockPolicy({ledger:baseline(),
  ...policy,maxCount:500}).reason,'invalid-stock-limits');
});
test('even synthetic full evidence is an economic review candidate, not a permit',()=>{
 const b=baseline();b.bankScope='verified-all-bank-packs';
 b.coverage={allBankPacks:true};
 const result=previewAccountStockPolicy({ledger:b,...policy});
 assert.equal(result.status,'review-candidate');
 assert.equal(result.provisionalExcess,3000);
 assert.equal(result.saleAuthorized,false);
});
