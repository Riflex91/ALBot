// Proof-of-mechanics for future Full-v1 restart recovery. Every write is
// confined to a detached throwaway object. No live Controller, CODE, storage,
// applied cursor, signed receipt or game action is ever modified. Even a clean
// rehearsal is NOT authority to install anything in an Adventure Land runtime.
import {FULL_DESCRIPTOR} from '../config/full.mjs';
import {addMissingDefaults,applyAutonomousMode} from '../../editor/lib/contract.mjs';
import {evaluateDetachedConfigCandidate} from './config-sync-detached-candidate.mjs';

export const simulateDetachedRestartRecovery=(()=>{
 const FORMAT='albot-config-recovery-rehearsal/v1';
 const FAULTS=['before-snapshot','after-snapshot','after-build',
  'after-sandbox-cutover','before-sandbox-restore','sandbox-restore-failure'];
 const errorText=error=>String(error?.message??error).slice(0,125);
 const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 function blocked(reason){
  return {format:FORMAT,mode:'detached-sandbox-only',ok:false,
   reason,phase:'blocked',fault:null,phases:[],
   snapshotVerified:false,sandboxRollbackVerified:false,
   liveConfigUntouched:false,controllerReconstructionTested:false,
   remoteAccountRollbackVerified:false,restartAuthorized:false,
   transactionCommitted:false,readyForActivation:false,
   applied:false,acknowledged:false};
 }
 function simulateDetachedRestartRecovery({activeConfig,profile,character,
  faultAt=null}={}){
  if(faultAt!==null&&!FAULTS.includes(faultAt))
   return blocked('Unsupported sandbox fault injection');
  if(!obj(activeConfig)||!obj(profile)||typeof character!=='string')
   return blocked('Detached rehearsal inputs unavailable');
  let before,working=null,originalText=null;
  const phases=[];let phase='validate',rollbackVerified=false;
  let snapshotVerified=false,untouched=false,cutoverReached=false;
  const faultAtPhase=name=>{
   if(faultAt===name)throw Error('Injected synthetic failure: '+name);
  };
  try{
   const candidateReport=evaluateDetachedConfigCandidate(profile,
    activeConfig,character);
   // Full-v1 normalization is repeated in an isolated graph. No shared
   // mutable values or signed profile references are installed in the game.
   const normalized=applyAutonomousMode(addMissingDefaults(
    FULL_DESCRIPTOR.schema,structuredClone(profile.config)));
   originalText=JSON.stringify(activeConfig);
   faultAtPhase('before-snapshot');
   before=structuredClone(activeConfig);
   phases.push('snapshot');phase='snapshot';
   snapshotVerified=JSON.stringify(before)===originalText;
   if(!snapshotVerified)throw Error('Snapshot mismatch');
   faultAtPhase('after-snapshot');
   working={configuration:structuredClone(before),modules:{}};
   for(const name of Object.keys(normalized)){
    // Stand-in reconstructed modules, NOT actual runtime controllers.
    working.modules[name]=structuredClone(normalized[name]);
   }
   phases.push('build-detached-graph');phase='build';
   faultAtPhase('after-build');
   working.configuration=structuredClone(normalized);
   phases.push('sandbox-cutover');phase='cutover';
   cutoverReached=true;
   faultAtPhase('after-sandbox-cutover');
   if(JSON.stringify(working.configuration)!==JSON.stringify(normalized))
    throw Error('Detached candidate changed during rehearsal');
   faultAtPhase('before-sandbox-restore');
   phase='restore';
   if(faultAt==='sandbox-restore-failure')
    throw Error('Injected synthetic failure: sandbox-restore-failure');
   working.configuration=structuredClone(before);
   working.modules={};
   phases.push('sandbox-restore');
   rollbackVerified=JSON.stringify(working.configuration)===originalText&&
    Object.keys(working.modules).length===0;
   untouched=JSON.stringify(activeConfig)===originalText;
   if(!rollbackVerified||!untouched)
    throw Error('Sandbox rollback did not match the snapshot');
   return {format:FORMAT,mode:'detached-sandbox-only',ok:true,
    reason:null,phase:'restored',fault:null,phases,
    sequence:null,character,candidateChangedSections:candidateReport.changedSections,
    snapshotVerified,cutoverReached,sandboxRollbackVerified:rollbackVerified,
    liveConfigUntouched:untouched,controllerReconstructionTested:false,
    remoteAccountRollbackVerified:false,restartAuthorized:false,
    transactionCommitted:false,readyForActivation:false,
    applied:false,acknowledged:false};
  }catch(e){
   let restorationFault=false;
   if(working&&before){
    try{
     if(faultAt==='sandbox-restore-failure')throw Error('Simulated sandbox restore failure');
     working.configuration=structuredClone(before);
     working.modules={};
     rollbackVerified=JSON.stringify(working.configuration)===originalText&&
      Object.keys(working.modules).length===0;
     if(rollbackVerified)phases.push('sandbox-restore');
    }catch{restorationFault=true;rollbackVerified=false;}
   }
   try{untouched=originalText!==null&&JSON.stringify(activeConfig)===originalText;}
   catch{untouched=false;}
   return {format:FORMAT,mode:'detached-sandbox-only',ok:false,
    reason:errorText(e),phase:restorationFault?'sandbox-recovery-unproven':
     rollbackVerified?'failed-and-restored':phase,
    fault:faultAt,phases,snapshotVerified,
    cutoverReached,sandboxRollbackVerified:rollbackVerified,
    liveConfigUntouched:untouched,
    controllerReconstructionTested:false,remoteAccountRollbackVerified:false,
    restartAuthorized:false,transactionCommitted:false,
    readyForActivation:false,applied:false,acknowledged:false};
  }finally{
   // Releasing the entire scratch graph is part of the safety boundary.
   working=null;before=null;
  }
 }
 simulateDetachedRestartRecovery.allowedFaults=[...FAULTS];
 return simulateDetachedRestartRecovery;
})();
