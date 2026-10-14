export class ApiError extends Error {status:number;constructor(message:string,status?:number)}
export type RequestOptions={token?:string|null;method?:string;body?:unknown;signal?:AbortSignal;onUnauthorized?:()=>void};
export function createApi(origin:string,transport?:typeof fetch,options?:{allowHttp?:boolean}):{request<T>(path:string,options?:RequestOptions):Promise<T>};
