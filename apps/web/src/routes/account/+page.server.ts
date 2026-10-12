import {database} from '@frontlanejobs/database/client';
import {loadProfile} from '@frontlanejobs/core/profile';
import {requireUser} from '$lib/server/session';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({locals}) => {
  const user = await requireUser(locals, '/account');
  try {
    return {profile: await loadProfile(database(), user.userId), loadError: ''};
  } catch {
    return {profile: null, loadError: 'We could not load your profile. Please try again before editing your details.'};
  }
};
