import {z} from 'zod';
import {decodeHTMLStrict} from 'entities';

const sourceUrl=z.string().url().max(2000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password});
export const RemoteInput=z.object({
  scope:z.enum(['worldwide','india']),evidence:z.string().min(1).max(1200),
  timezone:z.string().max(400).optional(),lastSeen:z.string().datetime({offset:true}),
  sourceName:z.enum(['Remote OK','We Work Remotely','Hacker News']).optional(),sourceUrl:sourceUrl.optional(),
}).strict();
export const REMOTE_SOURCES=['remoteok:public','wwr:programming','hn:whoishiring'];
export function isRemoteSource(source){return REMOTE_SOURCES.includes(source)}

export function classifyRemote({location='',description='',arrangement,checked=new Date().toISOString()}){
  const plain=value=>decodeHTMLStrict(String(value)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  location=plain(location);description=plain(description);
  const text=(location+' . '+description).replace(/\bU\.S\.(?:A\.)?/g,'United States');
  if(arrangement!=='Remote'||/\bhybrid\b|\bon[- ]?site\b|\boffice[- ]based\b|\b(?:days?|times?) (?:a|per) week (?:in|at) (?:the )?office/i.test(text))return null;
  if(/\bIndia\b[^.!?;]{0,30}\b(?:not eligible|not supported|not permitted)\b/i.test(text))return null;
  if(/\b(?:not hiring|cannot hire|can['’]?t hire|unavailable|not (?:available|open)|excluding|except)\b[^.!?;]{0,60}\bIndia\b|\bIndia\b[^.!?;]{0,30}\bexcluded\b/i.test(text))return null;
  let indiaRestricted=false;
  const residency=/\b(?:(?:must|need to|required to) (?:be (?:based|located|resident) in|reside in|live in)|(?:can|may|are able to) only hire (?:in|from)|(?:only (?:hiring|accepting|considering)(?: candidates?| applicants?)? (?:in|from)))\s+[^.!?;]{1,120}/gi;
  for(const match of text.matchAll(residency)){
    if(!/\bIndia\b/i.test(match[0]))return null;
    indiaRestricted=true;
  }
  const authorization=/\b(?:must|need to|required to) (?:be (?:legally )?(?:authorized|eligible) to work in|have (?:the )?right to work in)\s+[^.!?;]{1,120}|\b(?:cannot|can['’]?t|unable to) hire (?:outside|beyond)\s+[^.!?;]{1,120}/gi;
  for(const match of text.matchAll(authorization)){
    if(!/\bIndia\b/i.test(match[0]))return null;
    indiaRestricted=true;
  }
  // Explicit residency restrictions override broad board labels such as Worldwide.
  const restricted=/\b(?:must|need to|required to) (?:be |reside |live |work )?(?:based |located |resident )?(?:in|within)\b[^.!?;]{0,140}|\b(?:US|U\.S\.|United States|Canada|UK|Europe|EU|Australia)(?:[- ]based)? (?:citizens?|residents?|only)\b[^.!?;]{0,80}|\b(?:remote|hiring|open to|candidates? (?:must be|based|located)|applicants? (?:must be|based|located)) (?:only )?(?:in|within|from)\b[^.!?;]{0,140}|\bonly (?:open|available) to (?:candidates?|applicants?|residents?) (?:in|from|of)\b[^.!?;]{0,140}/gi;
  for(const match of text.matchAll(restricted)){
    if(!/\bIndia\b|\bworldwide\b|anywhere/i.test(match[0])&&/\b(?:US|USA|U\.S\.|United States|Canada|UK|United Kingdom|Europe|EU|Australia|Germany|France|Singapore|Americas|EMEA)\b/i.test(match[0]))return null;
  }
  if(/^(?:(?:remote|fully remote)\s*[-:,(]?\s*)?(?:US|USA|United States|Canada|UK|Europe|EU|Australia|EMEA|Americas)(?:\s*(?:only|remote))?\)?$/i.test(location))return null;
  const worldwide=/\bworldwide\b|anywhere in the world|work from anywhere|\bglobal(?:ly)? remote\b/i.test(location)||/\bremote(?: work| role| position)?\s*[-:,(]?\s*worldwide\b|\bhiring(?: [a-z-]+){0,3} worldwide\b|\b(?:candidates?|applicants?) (?:from )?worldwide (?:are )?(?:welcome|eligible|accepted|can apply|may apply)\b|work from anywhere|anywhere in the world/i.test(description);
  const india=/\bIndia\b/i.test(location)||indiaRestricted||/\b(?:remote|hiring)(?: work| roles?| positions?)?(?: is| available)? (?:in|from) India\b|\b(?:candidates?|applicants?) (?:based |located |living )?(?:in|from) India (?:are )?(?:welcome|eligible|accepted|encouraged|can apply|may apply)\b/i.test(description);
  if(!worldwide&&!india)return null;
  const sentences=description.split(/(?<=[.!?;])\s+/);
  const timezone=sentences.filter(sentence=>/time\s*zone|\boverlap\b|\b(?:UTC|GMT|IST|CET|CEST|EST|EDT|PST|PDT)\b|(?:US|European) (?:business|working) hours/i.test(sentence)).join(' ').slice(0,400);
  const evidence=[location,...sentences.filter(sentence=>/worldwide|anywhere|\bIndia\b|\bremote\b/i.test(sentence)).slice(0,3)].filter(Boolean).join(' · ').slice(0,1200);
  return {scope:worldwide&&!indiaRestricted?'worldwide':'india',evidence,...(timezone?{timezone}:{}),lastSeen:checked};
}
