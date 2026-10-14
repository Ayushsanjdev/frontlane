export function latestRequest():{begin():{signal:AbortSignal;current():boolean};cancel():void};
export function jobQuery(filters:{q?:string;type?:string;mode?:string;stack?:string;sort?:string;page?:number}):string;
export function publicationAttempt(uuid:()=>string):{get<T extends object>(fields:T):T & {submissionId:string}};
