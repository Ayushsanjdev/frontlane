'use client';

import {useEffect,useRef} from 'react';
import {attachHeroVideo} from '@/lib/hero-video';

export function HeroVideo(){
  const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    if(ref.current) return attachHeroVideo(ref.current);
  },[]);

  return <video
    ref={ref}
    className="hero-video"
    poster="/videos/hero-cf6853fa68f7.webp"
    loop
    muted
    playsInline
    preload="none"
    aria-hidden="true"
    tabIndex={-1}
    width={1280}
    height={720}
  >
    <source data-src="/videos/hero-66067520ddb1.mp4" type="video/mp4"/>
    <source data-src="/videos/hero-0b4e8c356441.webm" type="video/webm"/>
  </video>;
}
