import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Platform,useColorScheme} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {MobileSession,MobileUser} from '@frontlanejobs/contracts';
import {ApiError,createApi,type RequestOptions} from './api.mjs';

export type Appearance='system'|'light'|'dark';
const palettes={
  light:{background:'#f8fafc',card:'#ffffff',text:'#172033',muted:'#53657d',primary:'#2563eb',soft:'#eaf1ff',border:'#d9e2ee',error:'#b42318'},
  dark:{background:'#101827',card:'#182438',text:'#f1f5fb',muted:'#b0bfd3',primary:'#93baff',soft:'#203651',border:'#34465e',error:'#ffb4a6'},
};
type AppContext={
  colors:typeof palettes.light;dark:boolean;appearance:Appearance;setAppearance:(value:Appearance)=>void;
  user:MobileUser|null;ready:boolean;authBusy:boolean;authError:string;restore:()=>Promise<void>;signIn:()=>Promise<void>;signOut:()=>Promise<void>;
  request:<T>(path:string,options?:RequestOptions)=>Promise<T>;
};
const Context=createContext<AppContext|null>(null);
const storageKey='frontlane-mobile-session';
export const apiOrigin=process.env.EXPO_PUBLIC_API_URL||'';
const api=createApi(apiOrigin,fetch,{allowHttp:__DEV__});
export function AppProvider({children}:{children:ReactNode}){
  const system=useColorScheme();
  const [appearance,setAppearance]=useState<Appearance>('system');
  const [user,setUser]=useState<MobileUser|null>(null),[ready,setReady]=useState(false),[authBusy,setAuthBusy]=useState(false),[authError,setAuthError]=useState('');
  const token=useRef<string|null>(null),generation=useRef(0),busy=useRef(false);
  const clear=useCallback(async()=>{
    generation.current++;token.current=null;setUser(null);
    await SecureStore.deleteItemAsync(storageKey);
  },[]);
  const request=useCallback(async<T,>(path:string,options:RequestOptions={})=>{
    const version=generation.current;
    return api.request<T>(path,{...options,token:token.current,onUnauthorized:()=>{
      if(version===generation.current){void clear().catch(()=>{});setAuthError('Your session expired. Sign in again to continue.')}
    }});
  },[clear]);
  const restore=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;setAuthBusy(true);setAuthError('');
    try{
      token.current=Platform.OS==='web'?null:await SecureStore.getItemAsync(storageKey);
      if(token.current){const session=await request<Omit<MobileSession,'token'>>('/api/mobile/session');setUser(session.user)}
    }catch(error){setAuthError(error instanceof Error?error.message:'Could not restore your session. Try again.')}
    finally{busy.current=false;setAuthBusy(false);setReady(true)}
  },[request]);
  useEffect(()=>{void restore()},[restore]);
  const signIn=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;setAuthBusy(true);setAuthError('');
    try{
      const webClientId=process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const iosClientId=process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      if(Platform.OS==='web')throw Error('Google sign-in is available in the iOS and Android app.');
      if(!webClientId||Platform.OS==='ios'&&!iosClientId)throw Error('Google sign-in needs to be configured for this build.');
      const google=await import('react-native-nitro-google-signin');
      google.GoogleOneTapSignIn.configure({webClientId,iosClientId,scopes:['email','profile']});
      await google.GoogleOneTapSignIn.checkPlayServices();
      const result=await google.GoogleOneTapSignIn.presentExplicitSignIn();
      if(google.isCancelledResponse(result))return;
      if(!google.isSuccessResponse(result)||!result.data.idToken)throw Error('Google sign-in did not complete. Try again.');
      const session=await api.request<MobileSession>('/api/mobile/session',{method:'POST',body:{idToken:result.data.idToken}});
      try{await SecureStore.setItemAsync(storageKey,session.token)}catch(error){
        await api.request('/api/mobile/session',{method:'DELETE',token:session.token}).catch(()=>{});throw error;
      }
      generation.current++;token.current=session.token;setUser(session.user);
    }catch(error){
      if(!(typeof error==='object'&&error!==null&&'code' in error&&error.code==='SIGN_IN_CANCELLED'))setAuthError(error instanceof Error?error.message:'Could not sign in. Try again.');
    }finally{busy.current=false;setAuthBusy(false)}
  },[]);
  const signOut=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;setAuthBusy(true);setAuthError('');
    try{
      try{await request('/api/mobile/session',{method:'DELETE'})}catch(error){if(!(error instanceof ApiError&&error.status===401))throw error}
      await clear();
      try{const google=await import('react-native-nitro-google-signin');await google.GoogleOneTapSignIn.signOut()}catch{/* Server session is already revoked. */}
    }catch(error){setAuthError(error instanceof Error?error.message:'Could not sign out. Try again.')}
    finally{busy.current=false;setAuthBusy(false)}
  },[request,clear]);
  const dark=appearance==='dark'||appearance==='system'&&system==='dark';
  const value=useMemo(()=>({colors:palettes[dark?'dark':'light'],dark,appearance,setAppearance,user,ready,authBusy,authError,restore,signIn,signOut,request}),[dark,appearance,user,ready,authBusy,authError,restore,signIn,signOut,request]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp(){const context=useContext(Context);if(!context)throw Error('Missing app provider');return context}
