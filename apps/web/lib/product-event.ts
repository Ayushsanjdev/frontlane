'use client';
export function productEvent(event:'search'|'role-view'|'save'|'application-confirmed'|'follow-up-completed'){
  fetch('/api/product-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event}),keepalive:true}).catch(()=>{});
}
