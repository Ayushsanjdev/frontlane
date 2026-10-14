export class ApiError extends Error {
  constructor(message,status=0){super(message);this.name='ApiError';this.status=status}
}
export function createApi(origin,transport=fetch,{allowHttp=false}={}){
  return {async request(path,{token,method='GET',body,signal,onUnauthorized}={}){
    if(!/^\/api\//.test(path)||path.includes('\\'))throw new ApiError('Invalid API path');
    let base;
    try{
      base=new URL(origin);
      if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error();
    }catch{throw new ApiError('Set the mobile API URL before connecting.')}
    if(base.protocol!=='https:'&&!allowHttp)throw new ApiError('Use an HTTPS backend for this build.');
    let response;
    try{
      response=await transport(base.origin+path,{method,signal,credentials:'omit',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    }catch(error){if(error.name==='AbortError')throw error;throw new ApiError('Check your connection and try again.')}
    let data;
    try{data=await response.json()}catch{throw new ApiError('The server returned an unexpected response. Please try again.',response.status)}
    if(!response.ok){
      if(response.status===401&&token)onUnauthorized?.();
      throw new ApiError(data.error||'Request could not be completed. Please try again.',response.status);
    }
    return data;
  }};
}
