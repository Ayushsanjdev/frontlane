export function viewerHeartbeat(signal:AbortSignal){
  const send=()=>fetch('/api/viewers',{method:'POST',cache:'no-store',credentials:'same-origin',signal});
  // Finish setting the first cookie before another tab sends its heartbeat.
  if(navigator.locks)return navigator.locks.request('frontlane-viewer-heartbeat',{signal},send);
  return send();
}
