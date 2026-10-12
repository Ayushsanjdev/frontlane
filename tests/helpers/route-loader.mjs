import {readFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve as pathResolve} from 'node:path';
import ts from 'typescript';

const workspace=fileURLToPath(new URL('../../',import.meta.url));
const root=pathResolve(workspace,'apps/web/src');
export async function resolve(specifier,context,next){
  if(specifier.startsWith('$lib/')){
    const path=pathResolve(root,'lib',specifier.slice(5));
    for(const suffix of ['', '.ts','.tsx','.mjs']){
      try{await access(path+suffix);return {url:pathToFileURL(path+suffix).href,shortCircuit:true}}catch{}
    }
  }
  if(specifier.startsWith('.')&&context.parentURL){
    const base=new URL(specifier,context.parentURL);
    for(const suffix of ['.ts','.tsx','.mjs']){
      try{await access(fileURLToPath(base)+suffix);return {url:base.href+suffix,shortCircuit:true}}catch{}
    }
  }
  return next(specifier,context);
}
export async function load(url,context,next){
  // Only external session and PostgreSQL boundaries are replaced. Handlers,
  // origin checks, validation, query construction and cleanup execute normally.
  if(url===pathToFileURL(pathResolve(root,'lib/server/session.ts')).href){
    return {format:'module',source:'export async function getUser(locals){return locals?.user===undefined?globalThis.__frontlanejobsRouteTest.user:locals.user}',shortCircuit:true};
  }
  if(url===pathToFileURL(pathResolve(workspace,'packages/database/src/client.mjs')).href){
    return {format:'module',source:'export function database(){return globalThis.__frontlanejobsRouteTest.db}',shortCircuit:true};
  }
  if(url.endsWith('.json'))return {format:'module',source:'export default '+await readFile(new URL(url),'utf8'),shortCircuit:true};
  if(url.endsWith('.ts')){
    const source=await readFile(new URL(url),'utf8');
    return {format:'module',source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
  }
  return next(url,context);
}
