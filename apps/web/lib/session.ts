import {auth} from '@/auth';import {redirect} from 'next/navigation';
export async function getUser(){
  // Public pages remain available before authentication is configured.
  if(!process.env.AUTH_SECRET?.trim()&&!process.env.NEXTAUTH_SECRET?.trim())return null;
  const s=await auth();
  if(!s?.user?.id)return null;
  return {userId:s.user.id,displayName:s.user.name||'Developer',fullName:s.user.name,email:s.user.email};
}
export function signInPath(path='/tracker'){return '/signin?returnTo='+encodeURIComponent(path.startsWith('/')&&!path.startsWith('//')?path:'/tracker')}
export async function requireUser(path:string){const u=await getUser();if(!u)redirect(signInPath(path));return u}
