import {requireUser} from '@/lib/session';import Account from './profile';
export default async function Page(){const u=await requireUser('/account');return <Account name={u.displayName}/>}
