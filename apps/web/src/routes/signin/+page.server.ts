import {fail} from '@sveltejs/kit';
import {signIn, authConfigured} from '$lib/server/auth';
import {safeReturnTo} from '$lib/server/session';
import type {Actions, PageServerLoad} from './$types';

export const load: PageServerLoad = ({url}) => ({configured: authConfigured(), returnTo: safeReturnTo(url.searchParams.get('returnTo'))});

export const actions: Actions = {
  default: async (event) => {
    if (!authConfigured()) return fail(503, {error: 'Sign-in is being configured. Please try again later.'});
    return signIn(event);
  }
};
