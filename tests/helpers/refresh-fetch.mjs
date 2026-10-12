globalThis.fetch=async(url,options)=>{
  const target=new URL(url);
  if(target.hostname==='frontlane.example'){
    if(options.headers.Authorization!=='Bearer '+'t'.repeat(32))throw Error('Missing ingestion token');
    if(target.pathname==='/api/ingest/status')return {ok:JSON.parse(options.body).length<=20,status:400};
    const batch=JSON.parse(options.body);
    if(!batch.completeSnapshot)throw Error('Expected selection snapshot');
    return {ok:true,json:async()=>({accepted:batch.jobs.length})};
  }
  if(process.env.FAIL_FEEDS==='true')return {ok:false,status:503};
  if(target.hostname==='api.smartrecruiters.com')return {ok:true,json:async()=>({content:[],totalFound:0})};
  const slug=target.hostname==='boards-api.greenhouse.io'?target.pathname.split('/').at(-2):target.pathname.split('/').at(-1);
  const jobs=Array.from({length:10},(_,id)=>({
    id:String(id),title:'Frontend Engineer',text:'Frontend Engineer',location:{name:'India'},categories:{location:'India'},
    content:'React frontend',descriptionPlain:'React frontend',
    absolute_url:`https://careers.example/${slug}/${id}`,hostedUrl:`https://careers.example/${slug}/${id}`,
  }));
  return {ok:true,json:async()=>target.hostname==='boards-api.greenhouse.io'?{jobs}:jobs};
};
