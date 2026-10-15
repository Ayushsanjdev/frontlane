'use client';

import {useEffect,useState} from 'react';
import {ArrowRight,X} from 'lucide-react';
import {Button} from '@/components/ui/button';

const dismissalKey='frontlane-announcement:explore-collections-v1';
// The launch announcement retires automatically; the hero shortcuts remain.
const expiresAt=Date.parse('2026-11-14T00:00:00Z');

export function CollectionsAnnouncement(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(Date.now()>=expiresAt)return;
    try{setVisible(localStorage.getItem(dismissalKey)!=='dismissed')}
    catch{setVisible(true)}
  },[]);

  function dismiss(){
    setVisible(false);
    try{localStorage.setItem(dismissalKey,'dismissed')}catch{}
  }

  if(!visible)return null;
  return <aside className="collections-announcement" aria-label="What's new">
    <div className="wrap collections-announcement-inner">
      <span className="announcement-new">New</span>
      <p>Company collections and Fresher Special are here.</p>
      <a href="/explore">Explore collections <ArrowRight size={15} aria-hidden="true"/></a>
      <Button type="button" variant="ghost" size="icon" className="announcement-dismiss" aria-label="Dismiss announcement" onClick={dismiss}><X size={16} aria-hidden="true"/></Button>
    </div>
  </aside>;
}
