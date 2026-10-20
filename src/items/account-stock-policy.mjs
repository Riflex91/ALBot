// Read-only account-wide item target preview.
// Existing physical evidence covers only current visible bank maps; it is
// deliberately not a sale permit even when its local "complete" flag is true.
const fields=['stat_type','p','title','acc','rid','data'];
const validInt=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
function key(item){
 if(!item||typeof item!=='object'||typeof item.name!=='string'||
    !/^[A-Za-z0-9_]{1,100}$/.test(item.name)||!validInt(item.level??0)||
    (item.level??0)>99)return null;
 const values=[];
 for(const field of fields){
  const v=item[field];
  if(v===undefined||v===null){values.push(null);continue;}
  if(['acc','rid'].includes(field)&&
     (typeof v==='string'&&v.length<=80||
      typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)){
   values.push(v);continue;
  }
  if(typeof v!=='string'||v.length>(field==='data'?120:80)||
     v.startsWith('json:'))return null;
  values.push(v);
 }
 return JSON.stringify([item.name,item.level??0,...values]);
}
export function previewAccountStockPolicy({
 ledger,item,keep=0,targetCount=0,maxCount,teamReserve=0,
 additionalReservations=0
}={}){
 const base={version:1,mode:'read-only',executable:false,
  saleAuthorized:false,source:'observed-account-ledger',
  quantity:null,protectedFloor:null,provisionalExcess:0,
  targetCount,maximum:maxCount,scope:'account'};
 const invalid=reason=>({...base,status:'invalid',reason});
 const wanted=key(item);
 if(!wanted)return invalid('invalid-or-opaque-item-variant');
 if(![keep,targetCount,maxCount,teamReserve,additionalReservations].every(validInt)||
    keep+teamReserve>maxCount||targetCount<keep+teamReserve||
    targetCount>maxCount)return invalid('invalid-stock-limits');
 if(!ledger||ledger.mode!=='shadow-only'||ledger.executable!==false||
    !Array.isArray(ledger.variants)||ledger.variants.length>120)
  return {...base,status:'unverified',reason:'missing-stock-ledger'};
 const rows=ledger.variants.filter(row=>key(row?.item)===wanted);
 if(rows.length>1)return invalid('duplicate-account-variant');
 const row=rows[0];
 if(row&&![row.quantity,row.protectedUnits,row.reservedUnits].every(validInt))
  return invalid('invalid-observed-quantity');
 if(row&&(row.protectedUnits>row.quantity||row.reservedUnits>row.quantity))
  return invalid('invalid-observed-reservations');
 // A partial account ledger can omit an entire location. Never interpret
 // absence of an item as an observed zero outside a complete account proof.
 const known=!!row||ledger.complete===true;
 const quantity=known?(row?.quantity??0):null;
 const obligations=(row?.protectedUnits??0)+(row?.reservedUnits??0)+
  keep+teamReserve+additionalReservations;
 if(!Number.isSafeInteger(obligations)||obligations>10000000)
  return invalid('reservation-overflow');
 const protectedFloor=Math.max(maxCount,obligations);
 const provisionalExcess=quantity===null?0:Math.max(0,quantity-protectedFloor);
 // Current ALBot has no proven complete cross-map bank coverage.
 // Future data sources must provide explicit proof of ALL packs, not merely
 // set ledger.complete (which means only observed current-map coverage).
 const globalVerified=ledger.complete===true&&
  ledger.bankScope==='verified-all-bank-packs'&&
  ledger.coverage?.allBankPacks===true;
 const status=!globalVerified?'unverified':
  provisionalExcess>0?'review-candidate':'within-limit';
 const reason=!globalVerified?'global-bank-coverage-unverified':
  provisionalExcess>0?'economic-review-and-dispatch-proof-required':
  'no-provisional-excess';
 return {...base,status,reason,quantity,protectedFloor,
  provisionalExcess,reservedObserved:row?.reservedUnits??null,
  physicallyProtectedObserved:row?.protectedUnits??null,
  coverage:globalVerified?'all-bank-packs-verified':'incomplete-or-current-map-only',
  // This function is a UI/diagnostic projection, not an execution guard.
  saleAuthorized:false};
}
