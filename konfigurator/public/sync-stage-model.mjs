// Evidence-driven sync phases. A protected download endpoint is NOT evidence
// that a game character has received, validated, applied or acknowledged data.
const sha40=/^[a-f0-9]{40}$/;
const sha64=/^[a-f0-9]{64}$/;
export function profileSyncStages(status){
 const saved=status?.configured===true&&sha40.test(status.profile?.githubSha??'')&&
  sha64.test(status.profile?.sha256??'');
 const signed=saved&&status.signed===true&&status.releasePrepared===true&&
  status.releaseMatchesCurrent===true&&status.releaseExpired===false&&
  Number.isSafeInteger(status.release?.sequence)&&status.release.sequence>=1&&
  status.release?.sha256===status.profile?.sha256;
 const ready=signed&&status.deliveryReady===true;
 return [
  {id:'saved',label:'Privates Profil in GitHub gespeichert',
   state:saved?'confirmed':'pending'},
  {id:'signed',label:'Aktuelle Profilrevision privat signiert',
   state:signed?'confirmed':'pending'},
  {id:'ready',label:'Über Cloudflare Access und Popup abrufbar',
   state:ready?'ready':'pending'},
  {id:'received',label:'Von der Ingame-Runtime empfangen',state:'unknown'},
  {id:'verified',label:'In der Ingame-Runtime validiert',state:'unknown'},
  {id:'applied',label:'Sicher in der Runtime übernommen',state:'unavailable'},
  {id:'acknowledged',label:'Vom einzelnen Charakter bestätigt',state:'unavailable'}
 ];
}
