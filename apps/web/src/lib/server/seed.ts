import data from '@frontlane/database/seed';
import type {Job} from '../types';

// The database seed and public fallback share one curated dataset.
export const seedJobs:Job[]=data.map(({requisitionId,...job})=>job as Job);
