import {database} from '@frontlanejobs/database/client';
import {requireUser} from '$lib/server/session';
import type {Application} from '$lib/types';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({locals}) => {
  const user = await requireUser(locals, '/tracker');
  try {
    const result = await database().query('SELECT payload FROM applications WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1000', [user.userId]);
    return {items: result.rows.map((row: {payload: Application}) => row.payload), loadError: ''};
  } catch {
    return {items: [] as Application[], loadError: 'Unable to load your tracker. Please try again.'};
  }
};
