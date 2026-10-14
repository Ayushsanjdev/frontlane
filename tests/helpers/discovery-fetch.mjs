globalThis.fetch=async(input,options)=>{
  const url=new URL(input);
  if(url.pathname!=='/api/cron/discovery'||options.headers.Authorization!=='Bearer '+'c'.repeat(32))throw Error('Unexpected discovery request');
  if(process.env.DISCOVERY_FIXTURE==='unavailable')return new Response('unavailable',{status:503});
  if(process.env.DISCOVERY_FIXTURE==='malformed')return Response.json({message:'not a receipt'});
  return Response.json({runId:'fixture-run',status:'complete',searchesReserved:2,registered:1});
};
