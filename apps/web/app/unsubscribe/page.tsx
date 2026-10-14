import Unsubscribe from './unsubscribe';
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <Unsubscribe token={typeof token==='string'?token:''}/>}
