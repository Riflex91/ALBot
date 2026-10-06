// Scoped to the bundle: jsdom CODE does not necessarily expose these browser
// helpers. Only JSON configuration/checkpoints are cloned here, never game data.
const structuredClone=value=>typeof root.structuredClone==='function'?root.structuredClone(value):value===undefined?undefined:JSON.parse(JSON.stringify(value));
const TextEncoder=root.TextEncoder??class {
  encode(value){const bytes=[];for(const ch of String(value)){let n=ch.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|(n>>6),128|(n&63));else if(n<65536)bytes.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else bytes.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return new Uint8Array(bytes);}
};
