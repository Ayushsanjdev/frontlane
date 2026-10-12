import {readFile} from 'node:fs/promises';
import ts from 'typescript';

export async function resolve(specifier,context,next){
  if(specifier==='@/auth')return {url:'fixture:auth',shortCircuit:true};
  if(specifier==='next/navigation')return {url:'fixture:navigation',shortCircuit:true};
  return next(specifier,context);
}
export async function load(url,context,next){
  if(url==='fixture:auth')return {format:'module',source:'export async function auth(){return globalThis.__sessionFixture.auth()}',shortCircuit:true};
  if(url==='fixture:navigation')return {format:'module',source:'export function redirect(path){throw Error("Redirect: "+path)}',shortCircuit:true};
  if(url.endsWith('/lib/session.ts'))return {format:'module',source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
  return next(url,context);
}
