const base=process.env.APP_URL,secret=process.env.CRON_SECRET;
if(!base||!secret||secret.length<32)throw Error('Set APP_URL and CRON_SECRET');
const response=await fetch(new URL('/api/cron/discovery',base),{
  headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(30000),
});
if(!response.ok)throw Error('Discovery HTTP '+response.status);
const receipt=await response.json();
const statuses=['complete','partial','missing-key','budget-exhausted','busy'];
if(!receipt||!statuses.includes(receipt.status)||receipt.status!=='busy'&&(!Number.isInteger(receipt.searchesReserved)||receipt.searchesReserved<0||receipt.searchesReserved>2||!Number.isInteger(receipt.registered)||receipt.registered<0))throw Error('Invalid discovery receipt');
console.log(JSON.stringify(receipt));
