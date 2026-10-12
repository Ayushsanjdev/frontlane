import {jobCollection} from '$lib/server/jobs';

export const load = async () => ({collection: await jobCollection(new URLSearchParams({limit: '3'}))});
