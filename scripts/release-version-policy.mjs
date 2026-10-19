// User contract: each newly signed runtime advances the minor version by
// exactly one and resets patch to zero. Sequence remains the replay guard.
export function nextMinorReleaseVersion(previous){
 const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-candidate)?$/.exec(previous??'');
 if(!match)throw Error('Previous signed release has an unsupported version');
 const [major,minor,patch]=match.slice(1,4).map(Number);
 if(![major,minor,patch,minor+1].every(Number.isSafeInteger))throw Error('Release version exceeds safe integers');
 return `${major}.${minor+1}.0${match[4]??''}`;
}
