/* Push only: application pages, sessions and API responses are never cached. */
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification('New jobs on FrontlaneJobs',{
    body:typeof data.body==='string'?data.body.slice(0,180):'New frontend jobs are available. Open your inbox to explore.',
    icon:'/icons/push-192.png',badge:'/icons/push-192.png',tag:typeof data.tag==='string'?data.tag:'frontlane-daily',
    data:{url:'/inbox'},renotify:false,
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL('/inbox',self.location.origin).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){await existing.navigate(target);return existing.focus()}
    return self.clients.openWindow(target);
  })());
});
