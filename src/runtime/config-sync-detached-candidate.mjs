// Fully detached Full-v1 runtime candidate analysis. No live state is
// mutated, no private profile bytes leave this function, and restart is always
// mandatory until transactional reconstruction of every controller exists.
import {FULL_DESCRIPTOR} from '../config/full.mjs';
import {addMissingDefaults,applyAutonomousMode,validateProfile}
 from '../../editor/lib/contract.mjs';

export const evaluateDetachedConfigCandidate=(()=>{
const FORMAT='albot-config-detached-candidate/v1';
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fail(reason){throw Error('Detached Full-v1 candidate rejected: '+reason);}
function validCharacter(value){
 return typeof value==='string'&&/^[A-Za-z0-9_]{1,100}$/.test(value);
}
function evaluateDetachedConfigCandidate(profile,activeConfig,character){
 if(!validCharacter(character)||!obj(activeConfig)||
  profile?.format!=='albot-profile'||profile.formatVersion!==1||
  profile.schemaId!==FULL_DESCRIPTOR.schemaId||!obj(profile.config))
  fail('input or character unavailable');
 // Always allocate independent copies. The profile is verified upstream;
 // repeating complete schema validation here protects against later mutation.
 const incoming=structuredClone(profile.config);
 const sourceErrors=validateProfile(FULL_DESCRIPTOR,incoming);
 if(sourceErrors.length)fail('signed profile schema mismatch');
 const proposed=applyAutonomousMode(
  addMissingDefaults(FULL_DESCRIPTOR.schema,structuredClone(incoming)));
 const errors=validateProfile(FULL_DESCRIPTOR,proposed);
 if(errors.length)fail('normalized runtime schema mismatch');
 const enabled=proposed.characters.filter(x=>x.enabled===true);
 const target=enabled.find(x=>x.name===character);
 if(!target||!['farmer','merchant'].includes(target.role))
  fail('active character not enabled as a supported role');
 const names=new Set(enabled.map(x=>x.name));
 if(enabled.length!==names.size)fail('enabled character names conflict');
 if(enabled.some(x=>x.group!==proposed.party.group))
  fail('enabled characters disagree on configured team');
 const merchants=enabled.filter(x=>x.role==='merchant');
 if(merchants.length>1)fail('multiple active merchants');
 if(merchants.length&&proposed.merchant?.enabled===true&&
  merchants[0].name!==proposed.party.merchant)
  fail('merchant ownership mismatch');
 if(proposed.party.leader&&
  !enabled.some(x=>x.name===proposed.party.leader&&x.role==='farmer'))
  fail('configured leader is not an enabled farmer');
 if(proposed.party.selection!=='adaptive'&&
  enabled.filter(x=>x.role==='farmer'&&x.group===proposed.party.group).length>
   proposed.party.maxFarmers)
  fail('farmer count exceeds maximum');
 if(proposed.items.some(x=>x.enabled===true&&x.action==='send'&&
  (!x.recipient||!names.has(x.recipient))))
  fail('item transfer recipient not enabled');
 // This remains detached: bot.cfg is deeply referenced by controller modules,
 // closure-captured startup locals and immutable role/party bindings.
 // It cannot be safely replaced by swapping a single JS object.
 const sections=Object.keys(proposed).filter(k=>
  JSON.stringify(proposed[k])!==JSON.stringify(activeConfig[k])).sort();
 return {
  format:FORMAT,mode:'detached-validation-only',character,
  role:target.role,enabledCharacters:enabled.length,
  changedSections:sections,
  roleChange:activeConfig.characters?.find(x=>x.name===character&&x.enabled)?.role!==
   target.role,
  restartRequired:true,inPlaceSwapSupported:false,
  rollbackSnapshotCreated:false,transactionCommitted:false,
  readyForActivation:false,applied:false,acknowledged:false
 };
}
return evaluateDetachedConfigCandidate;
})();
