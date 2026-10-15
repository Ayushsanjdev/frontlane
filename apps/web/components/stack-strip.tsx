'use client';
import {Button} from '@/components/ui/button';

import {useState} from 'react';
import {Pause,Play} from 'lucide-react';

const stacks=[
  {name:'JavaScript',logo:'javascript',color:'#c49c00'},
  {name:'TypeScript',logo:'typescript',color:'#3178c6'},
  {name:'React',logo:'react',color:'#149eca'},
  {name:'Vue.js',logo:'vuedotjs',color:'#42b883'},
  {name:'Angular',logo:'angular',color:'#dd244c'},
  {name:'Svelte',logo:'svelte',color:'#ff3e00'},
  {name:'Next.js',logo:'nextdotjs',color:'currentColor'},
  {name:'Nuxt',logo:'nuxt',color:'#00a878'},
  {name:'Tailwind CSS',logo:'tailwindcss',color:'#06b6d4'},
];

export function StackStrip(){
  const [paused,setPaused]=useState(false);
  return <section className="stack-strip" aria-label="Frontend technologies">
    <div className="stack-heading">
      <span>Your stack. Your opportunities.</span>
      <Button variant="ghost" size="sm" className="stack-motion-toggle" type="button" onClick={()=>setPaused(!paused)} aria-label={paused?'Play stack animation':'Pause stack animation'} aria-pressed={paused}>
        {paused?<Play size={14}/>:<Pause size={14}/>}
      </Button>
    </div>
    <div className="stack-window">
      <div className="stack-track" style={{animationPlayState:paused?'paused':'running'}}>
        {[0,1].map(copy=><ul className="stack-list" key={copy} aria-hidden={copy===1?true:undefined}>
          {stacks.map(stack=><li key={stack.name}>
            <span className="stack-logo" aria-hidden="true" style={{backgroundColor:stack.color,maskImage:`url(/stack-logos/${stack.logo}.svg)`,WebkitMaskImage:`url(/stack-logos/${stack.logo}.svg)`}}/>
            <span>{stack.name}</span>
          </li>)}
        </ul>)}
      </div>
    </div>
  </section>;
}
