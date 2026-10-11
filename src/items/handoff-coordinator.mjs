// Shared admission for gold and item handoffs. A heartbeat is only a hint:
// both protocols still verify live range, receiver session, journals,
// source inventory and authoritative post-action deltas before settlement.
export function peerReadyForHandoff(peer,{requiresSlot=false}={}){
 if(!peer?.running||peer.rip||peer.journal||peer.inventoryBlocked||
    peer.reserved||peer.goldTransferPending)return false;
 if(requiresSlot&&Number.isFinite(peer.free)&&peer.free<1)return false;
 return true;
}

// Accelerate ONLY after an acknowledged and locally verified completion.
// Unknown, timed-out and in-flight value actions retain full TTL and
// durable-journal recovery rules.
export function confirmedHandoffCooldown(messageTtlMs=10000){
 const ttl=Number.isFinite(messageTtlMs)?messageTtlMs:10000;
 return Math.max(800,Math.min(2000,Math.floor(ttl/6)));
}
