// Private, owner-Access-only *signed publication* high-water, NOT an applied
// configuration cursor, game proof, or ACK. D1 executes CAS predicates atomically.
// Activation must continue to fail closed until an independently authenticated
// game-to-Worker apply/ACK protocol exists.
export const SIGNED_RELEASE_HIGHWATER_FORMAT='albot-signed-release-highwater/v1';
const TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const HASH=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const SELECT='SELECT key_id, sequence, sha256, release_sha, updated_at FROM signed_config_highwater WHERE target=?';
const UPSERT=`INSERT INTO signed_config_highwater
 (target,key_id,sequence,sha256,release_sha,updated_at) VALUES (?,?,?,?,?,?)
 ON CONFLICT(target) DO UPDATE SET
  sequence=excluded.sequence,sha256=excluded.sha256,
  release_sha=excluded.release_sha,updated_at=excluded.updated_at
 WHERE signed_config_highwater.key_id=excluded.key_id
  AND excluded.sequence>signed_config_highwater.sequence`;
function validParams({target,keyId,sequence,sha256,releaseSha,now}){
 return TARGET.test(target??'')&&HASH.test(keyId??'')&&
  Number.isSafeInteger(sequence)&&sequence>0&&sequence<Number.MAX_SAFE_INTEGER&&
  HASH.test(sha256??'')&&SHA.test(releaseSha??'')&&
  Number.isSafeInteger(now)&&now>0;
}
function validatedRow(row){
 if(row===null)return null;
 if(!row||typeof row!=='object'||!HASH.test(row.key_id??'')||
  !Number.isSafeInteger(row.sequence)||row.sequence<1||
  !HASH.test(row.sha256??'')||!SHA.test(row.release_sha??'')||
  !Number.isSafeInteger(row.updated_at)||row.updated_at<1)
  throw Error('Private signed high-water row corrupted');
 return row;
}
function evidence(row){
 return row?{sequence:row.sequence,sha256:row.sha256,
  releaseSha:row.release_sha,updatedAt:row.updated_at}:null;
}
export async function readSignedReleaseHighwater(db,{target,keyId}={}){
 if(!db||typeof db.prepare!=='function')throw Error('D1 sequence anchor unavailable');
 if(!TARGET.test(target??'')||!HASH.test(keyId??''))
  throw Error('Signed account trust invalid');
 const row=validatedRow(await db.prepare(SELECT).bind(target).first());
 if(row&&row.key_id!==keyId)throw Error('Signed account key pin mismatch');
 return {format:SIGNED_RELEASE_HIGHWATER_FORMAT,configured:true,
  anchored:!!row,anchor:evidence(row),
  issuedOnly:true,applied:false,acknowledged:false};
}
export async function recordSignedReleaseHighwater(db,input){
 if(!validParams(input))throw Error('Invalid independently signed release evidence');
 const {target,keyId,sequence,sha256,releaseSha,now}=input;
 const prior=await readSignedReleaseHighwater(db,{target,keyId});
 if(prior.anchored&&prior.anchor.sequence>=sequence){
  if(prior.anchor.sequence===sequence&&prior.anchor.sha256===sha256&&
   prior.anchor.releaseSha===releaseSha)
   return {...prior,changed:false,idempotent:true};
  throw Error('Signed release downgrade or equivocation');
 }
 const result=await db.prepare(UPSERT).bind(target,keyId,sequence,
  sha256,releaseSha,now).run();
 if(!Number.isSafeInteger(result?.meta?.changes)||
  result.meta.changes<0||result.meta.changes>1)
  throw Error('D1 high-water write confirmation missing');
 // A second writer may have won the race. Re-read the authoritative row.
 const after=await readSignedReleaseHighwater(db,{target,keyId});
 if(after.anchor?.sequence!==sequence||after.anchor?.sha256!==sha256||
  after.anchor?.releaseSha!==releaseSha)
  throw Error('Concurrent signed release update conflicted');
 if(result.meta.changes!==1)
  throw Error('Signed release CAS rejected');
 return {...after,changed:true,idempotent:false};
}
