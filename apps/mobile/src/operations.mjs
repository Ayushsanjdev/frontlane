export function latestRequest(){
  let controller=null,version=0;
  return {
    begin(){controller?.abort();controller=new AbortController();const current=++version;return {signal:controller.signal,current:()=>current===version}},
    cancel(){controller?.abort();version++},
  };
}
export function jobQuery({q='',type='All',mode='All',stack='All',sort='recommended',page=1}){
  return new URLSearchParams({q,type,mode,stack,sort,page:String(page),limit:'12'}).toString();
}
export function publicationAttempt(uuid){
  let previous;
  return {get(fields){const body=JSON.stringify(fields);if(previous?.body!==body)previous={body,id:uuid()};return {...fields,submissionId:previous.id}}};
}
