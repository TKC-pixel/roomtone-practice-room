// Read-only inspection; audio devices are listed without opening a microphone.
window.connectionCheck=async function(){
  const state=window.roomState,report={at:new Date().toISOString(),secureContext:window.isSecureContext,audioCapture:!!navigator.mediaDevices?.getUserMedia,midi:!!navigator.requestMIDIAccess,audioState:state.audio?.state||'not started',room:state.joined?state.room:null,clockMetrics:state.syncMetrics||[],peers:[]};
  try{const config=await fetch('/config').then(r=>r.json());report.turnConfigured=config.iceServers.some(s=>[s.urls].flat().some(u=>/^turns?:/.test(u)));report.transportPolicy=config.iceTransportPolicy||'all';}catch{report.serverUnavailable=true;}
  try{report.inputs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput').map(d=>d.label||'Input label hidden until permission is granted');}catch(e){report.inputError=e.message;}
  for(const [id,item] of state.pcs){
    const row={name:item.name,state:item.pc.connectionState,streams:[]};
    try{const stats=await item.pc.getStats();let selected;for(const r of stats.values())if(r.type==='transport'&&r.selectedCandidatePairId)selected=stats.get(r.selectedCandidatePairId);
      if(selected){row.rttMs=(selected.currentRoundTripTime||0)*1000;row.path=stats.get(selected.localCandidateId)?.candidateType;}
      for(const r of stats.values())if(r.type==='inbound-rtp'&&r.kind==='audio')row.streams.push({packetsReceived:r.packetsReceived,packetsLost:r.packetsLost,jitterMs:(r.jitter||0)*1000});
    }catch(e){row.error=e.message;}report.peers.push(row);
  }
  const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.showModal('Connection check','RTT and jitter describe the connection. They do not measure sound arriving at the headphones.',`<pre style="white-space:pre-wrap;max-height:45vh;overflow:auto">${safe(JSON.stringify(report,null,2))}</pre>`,'Download report',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='roomtone-connection-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
};
