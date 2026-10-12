import {getUser} from '$lib/server/session';
import type {LayoutServerLoad} from './$types';

// Public navigation remains available during an authentication outage. Private
// pages and APIs call getUser/requireUser independently and still fail closed.
export const load: LayoutServerLoad = async ({locals}) => ({user: await getUser(locals).catch(() => null)});
