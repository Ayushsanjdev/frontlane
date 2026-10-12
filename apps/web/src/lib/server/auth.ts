import {SvelteKitAuth} from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import {authCallbacks} from './auth-policy';

export const {handle: authHandle, signIn, signOut} = SvelteKitAuth(async () => ({
  basePath: '/api/auth',
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  providers: [Google({clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET})],
  session: {strategy: 'jwt'},
  pages: {signIn: '/signin'},
  callbacks: authCallbacks
}));

export function authConfigured() {
  return !!(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim()
    && (process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()));
}
