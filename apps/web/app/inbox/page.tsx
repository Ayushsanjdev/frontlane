import {requireUser} from '@/lib/session';
import Inbox from './inbox';
export default async function Page(){await requireUser('/inbox');return <Inbox/>}
