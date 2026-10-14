import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const {attachHeroVideo}=await import('../apps/web/lib/hero-video.ts');

const originalGlobals=new Map(['window','document','navigator','IntersectionObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
afterEach(()=>{
  for(const [key,descriptor] of originalGlobals){
    if(descriptor) Object.defineProperty(globalThis,key,descriptor);
    else delete globalThis[key];
  }
});

function browser({reducedMotion=false,saveData=false,readyState='loading'}={}){
  const motion=Object.assign(new EventTarget(),{matches:reducedMotion});
  const connection=Object.assign(new EventTarget(),{saveData,effectiveType:'4g'});
  const document=Object.assign(new EventTarget(),{readyState,hidden:false});
  const idle=new Map();let nextId=0,intersection;
  const window=Object.assign(new EventTarget(),{
    matchMedia:()=>motion,
    requestIdleCallback:callback=>{idle.set(++nextId,callback);return nextId},
    cancelIdleCallback:id=>idle.delete(id),
  });
  let disconnected=false;
  class Observer {
    constructor(callback){intersection=callback}
    observe(){}
    disconnect(){disconnected=true}
  }
  for(const [key,value] of Object.entries({window,document,navigator:{connection},IntersectionObserver:Observer})){
    Object.defineProperty(globalThis,key,{configurable:true,value});
  }
  const sources=['video/webm','video/mp4'].map(type=>({type,dataset:{src:'/background.'+type.split('/')[1]},src:'',removeAttribute(){this.src=''}}));
  const video=Object.assign(new EventTarget(),{
    paused:true,loads:0,plays:0,
    querySelectorAll:()=>sources,
    load(){this.loads++},
    play(){this.paused=false;this.plays++;return Promise.resolve()},
    pause(){this.paused=true},
    removeAttribute(){},
  });
  return {video,sources,motion,connection,document,
    visible(value){intersection([{isIntersecting:value}])},
    loaded(){document.readyState='complete';window.dispatchEvent(new Event('load'))},
    idle(){for(const callback of idle.values()) callback();idle.clear()},
    get disconnected(){return disconnected},
  };
}

test('hero video requests no media until the page is loaded, idle, and visible',()=>{
  const b=browser();const cleanup=attachHeroVideo(b.video);
  b.visible(true);
  assert.ok(b.sources.every(source=>!source.src));
  b.loaded();
  assert.ok(b.sources.every(source=>!source.src));
  b.idle();
  assert.ok(b.sources.every(source=>source.src));
  assert.equal(b.video.paused,false);
  cleanup();
});

test('reduced motion and data saving prevent media downloads entirely',()=>{
  for(const settings of [{reducedMotion:true},{saveData:true}]){
    const b=browser(settings);const cleanup=attachHeroVideo(b.video);
    b.visible(true);b.loaded();b.idle();
    assert.ok(b.sources.every(source=>!source.src));
    assert.equal(b.video.plays,0);
    cleanup();
  }
});

test('hero pauses offscreen or in a background tab, then resumes when visible',()=>{
  const b=browser({readyState:'complete'});const cleanup=attachHeroVideo(b.video);
  b.idle();
  assert.ok(b.sources.every(source=>!source.src));
  b.visible(true);
  assert.equal(b.video.paused,false);
  b.visible(false);
  assert.equal(b.video.paused,true);
  b.visible(true);
  b.document.hidden=true;b.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(b.video.paused,true);
  b.document.hidden=false;b.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(b.video.paused,false);
  cleanup();
});

test('changing preferences cancels media and permits playback again when reenabled',()=>{
  const b=browser({readyState:'complete'});const cleanup=attachHeroVideo(b.video);
  b.visible(true);b.idle();
  b.motion.matches=true;b.motion.dispatchEvent(new Event('change'));
  assert.equal(b.video.paused,true);
  assert.ok(b.sources.every(source=>!source.src));
  b.motion.matches=false;b.motion.dispatchEvent(new Event('change'));
  assert.equal(b.video.paused,false);
  b.connection.saveData=true;b.connection.dispatchEvent(new Event('change'));
  assert.equal(b.video.paused,true);
  assert.ok(b.sources.every(source=>!source.src));
  cleanup();
});

test('unmount cancels deferred work and releases observers and media',()=>{
  const b=browser();const cleanup=attachHeroVideo(b.video);
  cleanup();b.loaded();b.idle();
  assert.ok(b.sources.every(source=>!source.src));
  assert.equal(b.video.plays,0);
  assert.equal(b.disconnected,true);
});
