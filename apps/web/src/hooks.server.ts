import type {Handle} from '@sveltejs/kit';
import {authHandle} from '$lib/server/auth';

export const handle: Handle = async ({event, resolve}) => {
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) {
    event.locals.auth = async () => null;
    if (event.url.pathname.startsWith('/api/auth/')) {
      return Response.json({error: 'Sign-in is not configured'}, {status: 503});
    }
    return resolve(event);
  }
  return authHandle({event, resolve});
};
