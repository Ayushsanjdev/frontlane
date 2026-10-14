export type JobEnrichment={description:string;arrangement:'Remote'|'Hybrid'|'Onsite'|'Unknown';seniority?:'Junior'|'Mid'|'Senior'|'Lead'|'Staff';yearsMin?:number;yearsMax?:number;compensation?:{min:number;max:number;currency:string;period:'year'|'month'|'hour';sourceText:string};requiredSkills?:string[];preferredSkills?:string[];benefits?:string[];evidence?:string};
export type Job={id:string;title:string;company:string;location:string;mode:'Remote'|'Hybrid'|'Onsite';type:'Full-time'|'Freelance'|'Part-time'|'Contract';salary:string;tags:string[];experience:string;summary:string;caveat:string;url:string;source:string;discovered:string;checked:string;posted:string|null;eligibility:string;degree:string;enrichment?:JobEnrichment;companyId?:string;availability?:'available'|'closed'|'unknown'};
export const stages=['Saved','Preparing','Applied','Interview','Offer','Rejected','Withdrawn'] as const;
export type Stage=typeof stages[number];
export type Application={workspace?:ApplicationWorkspace;revision?:number;id:string;jobId:string;job:Job;stage:Stage;notes:string;answers:string;appliedAt:string;followUp:string;evidence:string;updatedAt:string};
export type Profile={matchingPreferences?:MatchingPreferences;name:string;location:string;skills:string;experience:string;salary:string;availability:string;portfolio:string;resumeUrl:string;preference:string};

export type JobCollection={jobs:Job[];total:number;page:number;limit:number;lastSync:string|null;warning?:string;sources?:unknown[]};

export type MobileUser={userId:string;name:string;email:string};
export type MobileSession={token:string;user:MobileUser;expiresAt:string};
export type Publication={submissionId:string;title:string;company:string;location:string;mode:Job["mode"];type:Job["type"];url:string;summary:string;salary:string;experience:string;eligibility:string;degree:string;tags:string[]};

export type SaveJobRequest={action:'save';job:Job};

export type MatchingPreferences={skills:string[];roles:string[];cities:string[];arrangements:('Remote'|'Hybrid'|'Onsite')[];types:Job['type'][];years?:number;salaryMin?:number;currency?:string;payPeriod?:'year'|'month'|'hour'};
export type ApplicationWorkspace={archived:boolean;priority:'high'|'normal'|'low';nextAction:string;timezone:string;contacts:{id:string;name:string;role:string;email:string;url:string;notes:string}[];interviews:{id:string;title:string;at:string;duration:number;url:string;notes:string;outcome:string;status:'scheduled'|'completed'|'cancelled'}[];documents:{id:string;label:string;url:string;usedAt:string}[];checklist:{id:string;label:string;done:boolean}[];preparation:string;followUpDraft?:string;thankYouDraft?:string;offers:{id:string;base:number;variable:number;equity:string;currency:string;period:'year'|'month'|'hour';startDate:string;deadline:string;location:string}[]};
