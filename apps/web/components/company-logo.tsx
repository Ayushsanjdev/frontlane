'use client';
import {useState} from 'react';
import assets from '@/lib/company-logos.json';
const logos:Record<string,{path:string}>=assets;
export function CompanyLogo({company}:{company:string}){
  const [failed,setFailed]=useState(false),logo=logos[company];
  return <span className="company-icon company-logo">{logo&&!failed?<img src={logo.path} alt="" width={32} height={32} loading="lazy" onError={()=>setFailed(true)}/>:company.slice(0,1).toUpperCase()}</span>;
}
