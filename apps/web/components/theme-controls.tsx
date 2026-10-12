'use client';
import {ThemeProvider,useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Sun,Moon} from 'lucide-react';
import {Button} from '@/components/ui/button';
export function ThemeRoot({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="frontlane-theme" disableTransitionOnChange>{children}</ThemeProvider>}
export function ThemeControl(){
  const {resolvedTheme,setTheme}=useTheme();
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const isDark=ready&&resolvedTheme==='dark';
  const Icon=isDark?Sun:Moon;
  const label=ready?`Switch to ${isDark?'light':'dark'} mode`:'Toggle color theme';
  return <Button type="button" variant="outline" size="icon" className="theme-control" aria-label={label} title={label} disabled={!ready} onClick={()=>setTheme(isDark?'light':'dark')}><Icon size={16} aria-hidden="true"/></Button>;
}
