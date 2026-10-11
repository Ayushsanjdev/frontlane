'use client';
import {ThemeProvider,useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
export function ThemeRoot({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="frontlane-theme" disableTransitionOnChange>{children}</ThemeProvider>}
export function ThemeControl(){const {theme,setTheme}=useTheme();const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const current=ready?theme||'system':'system';const Icon=current==='light'?Sun:current==='dark'?Moon:Monitor;return <label className="theme-control"><Icon size={16} aria-hidden="true"/><select aria-label="Color theme" value={current} onChange={e=>setTheme(e.target.value)} disabled={!ready}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>}
