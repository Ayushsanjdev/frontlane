type Connection = EventTarget & {saveData?:boolean;effectiveType?:string};

/** Attach media only after the page is ready, and play only while visible. */
export function attachHeroVideo(video:HTMLVideoElement){
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection=(navigator as Navigator & {connection?:Connection}).connection;
  const sources=Array.from(video.querySelectorAll<HTMLSourceElement>('source[data-src]'));
  let ready=false;
  let visible=false;
  let attached=false;
  let disposed=false;
  let idleId:number|undefined;
  let timerId:number|undefined;

  function release(){
    video.pause();
    if(!attached) return;
    for(const source of sources) source.removeAttribute('src');
    attached=false;
    video.load();
  }

  function update(){
    if(disposed) return;
    const restricted=motion.matches||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||'');
    if(restricted){release();return}
    if(!ready||!visible||document.hidden){video.pause();return}
    if(!attached){
      for(const source of sources) source.src=source.dataset.src!;
      attached=true;
      video.load();
    }
    // Autoplay can be denied by browser or battery-saving policies; keep the poster.
    if(video.paused) void video.play().catch(()=>{});
  }

  function enable(){ready=true;update()}
  function schedule(){
    if(typeof window.requestIdleCallback==='function'){
      idleId=window.requestIdleCallback(enable,{timeout:1500});
    }else{
      timerId=window.setTimeout(enable,0);
    }
  }

  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
    visible=entries.some(entry=>entry.isIntersecting);
    update();
  });
  if(observer) observer.observe(video);
  else visible=true;
  motion.addEventListener('change',update);
  connection?.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  if(document.readyState==='complete') schedule();
  else window.addEventListener('load',schedule,{once:true});

  return ()=>{
    disposed=true;
    observer?.disconnect();
    motion.removeEventListener('change',update);
    connection?.removeEventListener('change',update);
    document.removeEventListener('visibilitychange',update);
    window.removeEventListener('load',schedule);
    if(idleId!==undefined) window.cancelIdleCallback(idleId);
    if(timerId!==undefined) window.clearTimeout(timerId);
    release();
  };
}
