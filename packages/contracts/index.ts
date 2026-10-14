export type Job={id:string;title:string;company:string;location:string;mode:'Remote'|'Hybrid'|'Onsite';type:'Full-time'|'Freelance'|'Part-time'|'Contract';salary:string;tags:string[];experience:string;summary:string;caveat:string;url:string;source:string;discovered:string;checked:string;posted:string|null;eligibility:string;degree:string};
export const stages=['Saved','Preparing','Applied','Interview','Offer','Rejected','Withdrawn'] as const;
export type Stage=typeof stages[number];
export type Application={id:string;jobId:string;job:Job;stage:Stage;notes:string;answers:string;appliedAt:string;followUp:string;evidence:string;updatedAt:string};
export type Profile={name:string;location:string;skills:string;experience:string;salary:string;availability:string;portfolio:string;resumeUrl:string;preference:string};

export type JobCollection={jobs:Job[];total:number;page:number;limit:number;lastSync:string|null;warning?:string;sources?:unknown[]};

export type MobileUser={userId:string;name:string;email:string};
export type MobileSession={token:string;user:MobileUser;expiresAt:string};
export type Publication={submissionId:string;title:string;company:string;location:string;mode:Job["mode"];type:Job["type"];url:string;summary:string;salary:string;experience:string;eligibility:string;degree:string;tags:string[]};

export type SaveJobRequest={action:'save';job:Job};
