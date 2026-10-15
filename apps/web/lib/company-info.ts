import {resolveCompany} from '@frontlanejobs/database/companies';
export const companyInfo:Record<string,{name:string;website:string;description:string;industry:string}>={
  'greenhouse:gitlab':{name:'GitLab',website:'https://about.gitlab.com',description:'GitLab develops a platform for software development and delivery.',industry:'Developer tools'},
  'greenhouse:canonical':{name:'Canonical',website:'https://canonical.com',description:'Canonical develops Ubuntu and open source infrastructure software.',industry:'Open source software'},
  'greenhouse:mongodb':{name:'MongoDB',website:'https://www.mongodb.com',description:'MongoDB develops database software and a developer data platform.',industry:'Database software'},
  'greenhouse:sonicwall':{name:'SonicWall',website:'https://www.sonicwall.com',description:'SonicWall develops cybersecurity products and services.',industry:'Cybersecurity'},
  'greenhouse:cloudsek':{name:'CloudSEK',website:'https://www.cloudsek.com',description:'CloudSEK develops digital threat monitoring and cybersecurity tools.',industry:'Cybersecurity'},
};
export function companyPath(source:string,company=''){const known=resolveCompany({source,company});if(known)return '/companies/'+known.id;return /^(greenhouse|lever|smartrecruiters|ashby|amazon):[a-z0-9_-]+$/.test(source)?'/companies/'+encodeURIComponent(source):(/^(remoteok|wwr|hn):/.test(source)?'/jobs/remote?q=':'/jobs?q=')+encodeURIComponent(company)}
