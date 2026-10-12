import {jobCollection} from '$lib/server/jobs';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({url}) => {
  const params = new URLSearchParams(url.searchParams);
  params.set('limit', '12');
  return {
    collection: await jobCollection(params),
    filters: {
      q: params.get('q') || '', type: params.get('type') || 'All', mode: params.get('mode') || 'All',
      stack: params.get('stack') || 'All', sort: params.get('sort') || 'recommended'
    }
  };
};
