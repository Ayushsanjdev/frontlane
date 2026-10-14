'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
export default function InboxLink(){const [count,setCount]=useState(0);useEffect(()=>{const check=()=>{if(document.visibilityState!=='visible')return;fetch('/api/notifications').then(async r=>r.ok?r.json():null).then(data=>{if(data)setCount(data.unread)}).catch(()=>{})};check();const timer=setInterval(check,120000);return()=>clearInterval(timer)},[]);return <a className="inbox-nav" href="/inbox" aria-label={'Job inbox'+(count?', '+count+' unread alerts':'')}><Bell size={18}/>{count>0&&<span>{count>99?'99+':count}</span>}</a>}
