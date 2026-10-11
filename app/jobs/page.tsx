import {getUser} from '@/lib/session';import Board from './board';
export default async function Page(){const user=await getUser();return <Board signedIn={!!user}/>}
