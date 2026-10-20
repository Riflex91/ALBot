// ALBot Konfigurator v1 policy. Strictly advisory: no runtime dispatch authority.
export const POLICY_VERSION=1;
export const POLICY_ACTIONS=Object.freeze(['hold','store','economic-sell']);
const idOk=x=>typeof x==='string'&&/^[a-zA-Z0-9_]{1,100}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000000;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function validatePolicyDocument(document){
 const errors=[];
 if(!document||typeof document!=='object'||Array.isArray(document))return ['Dokument muss ein Objekt sein'];
 if(document.version!==POLICY_VERSION)errors.push('Unbekannte Dokumentversion');
 if(!Array.isArray(document.items)||document.items.length>300)errors.push('Items muss eine Liste mit höchstens 300 Einträgen sein');
 if(Object.keys(document).some(k=>!['version','items'].includes(k)))errors.push('Unbekannte Dokumentfelder');
 const seen=new Set();
 for(const [n,p] of (Array.isArray(document.items)?document.items:[]).entries()){
  const where='Eintrag '+(n+1);
  if(!p||typeof p!=='object'||Array.isArray(p)){errors.push(where+': ungültiges Objekt');continue;}
  if(Object.keys(p).some(k=>!['item','level','action','minimum','target','maximum','minNpcPrice'].includes(k)))errors.push(where+': unbekannte Felder');
  if(!idOk(p.item)||!Number.isSafeInteger(p.level)||p.level<0||p.level>99){errors.push(where+': ungültige Item-ID oder Level');continue;}
  const key=p.item+'#'+p.level;if(seen.has(key))errors.push(where+': doppelte Itemvariante');seen.add(key);
  if(!POLICY_ACTIONS.includes(p.action))errors.push(where+': unbekannte Aktion');
  if(![p.minimum,p.target,p.maximum,p.minNpcPrice].every(int))errors.push(where+': Mengen/Preis müssen sichere nichtnegative ganze Zahlen sein');
  else if(p.minimum>p.target||p.target>p.maximum)errors.push(where+': Mindestmenge ≤ Ziel ≤ Maximum erforderlich');
 }
 return errors.slice(0,32);
}
export function defaultPolicy(item,level=0){
 return {item,level,action:'hold',minimum:0,target:100,maximum:1000,minNpcPrice:1};
}
// Monitoring records can be partial, stale or missing; nothing in this module can
// turn the read-only snapshot into permission to mutate bank/inventory state.
export function previewGlobalItem(policy,snapshot,{now=Date.now(),ttlMs=30000}={}){
 const blank={mode:'read-only',saleAuthorized:false,executable:false,item:policy?.item??null,
  observed:null,protectedFloor:null,provisionalExcess:0,
  saleCandidate:0,reason:'unknown'};
 if(validatePolicyDocument({version:1,items:[policy]}).length)return {...blank,reason:'invalid-policy'};
 if(!snapshot||typeof snapshot!=='object'||!Array.isArray(snapshot.variants)||
    !Number.isSafeInteger(snapshot.at)||snapshot.at>now||now-snapshot.at>ttlMs||
    snapshot.variants.length>300)return {...blank,reason:'missing-or-stale-snapshot'};
 const rows=snapshot.variants.filter(v=>v?.item===policy.item&&v.level===policy.level);
 if(rows.length!==1){
  return {...blank,reason:rows.length>1?'duplicate-variant':'variant-not-proven'};
 }
 const r=rows[0];
 if(![r.quantity,r.protectedUnits,r.reservedUnits].every(int)||
    r.protectedUnits>r.quantity||r.reservedUnits>r.quantity)
  return {...blank,reason:'invalid-quantity'};
 const floor=Math.max(policy.maximum,policy.minimum+r.protectedUnits+r.reservedUnits);
 const excess=Math.max(0,r.quantity-floor);
 const coverage=snapshot.coverage;
 const complete=snapshot.complete===true&&
   coverage?.allCharacters===true&&coverage?.allBankPacks===true&&
   coverage?.noPendingTransfers===true;
 const reason=!complete?'incomplete-account-coverage':
  policy.action==='hold'?'policy-hold':
  policy.action==='store'?'policy-store':
  excess>0?'economic-review-required':'within-maximum';
 return {...blank,observed:r.quantity,protectedFloor:floor,
  provisionalExcess:excess,reason,coverageVerified:complete};
}
export function reviewEconomicSale(policy,preview,evidence){
 const denied=reason=>({mode:'read-only',saleAuthorized:false,executable:false,review:'hold',reason});
 if(policy?.action!=='economic-sell')return denied('policy-not-sell');
 if(!preview?.coverageVerified||preview.reason!=='economic-review-required'||
    !int(preview.provisionalExcess)||preview.provisionalExcess<1)
  return denied('stock-not-proven');
 if(!evidence||evidence.protected===true||evidence.purposeKnown!==true)
  return denied('purpose-unknown-or-protected');
 if(!Number.isFinite(evidence.npcValue)||evidence.npcValue<policy.minNpcPrice)
  return denied('npc-price-below-minimum');
 // A market/crafting/exchange/upgrade alternative must have a bounded,
 // independently verified conservative net value to be compared.
 if(!Array.isArray(evidence.alternatives)||!evidence.alternatives.length)
  return denied('economic-alternatives-unverified');
 for(const alt of evidence.alternatives){
  if(!alt||alt.verified!==true||!Number.isFinite(alt.netValue)||
    alt.netValue<0)return denied('economic-alternatives-unverified');
  if(alt.netValue>evidence.npcValue)return denied('higher-value-alternative');
 }
 return {mode:'read-only',saleAuthorized:false,executable:false,review:'candidate',
  reason:'economic-review-passed-dispatch-proof-still-required',
  provisionalQuantity:preview.provisionalExcess};
}
export const EMPTY_POLICIES=Object.freeze({version:POLICY_VERSION,items:[]});
