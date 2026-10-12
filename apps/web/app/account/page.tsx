import {requireUser} from '@/lib/session';
import {database} from '@frontlanejobs/database/client';
import {loadProfile} from '@frontlanejobs/core/profile';
import Account from './profile';

export default async function Page(){
  const user=await requireUser('/account');
  let profile;
  try{profile=await loadProfile(database(),user.userId)}
  catch{
    return <section className="wrap profile-page"><h1>Your profile</h1><p role="alert">We could not load your profile. Please try again before editing your details.</p><a className="quiet-link" href="/account">Try again</a></section>;
  }
  return <Account name={user.displayName} initialProfile={profile}/>;
}
