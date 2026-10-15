import {ArrowUpRight,Building2,GraduationCap,TrendingUp} from 'lucide-react';
import {exploreCollections} from '@frontlanejobs/core/explore';
import {companies} from '@frontlanejobs/database/companies';
import {CompanyLogo} from '@/components/company-logo';

export const metadata={title:'Explore frontend careers | FrontlaneJobs',description:'Find frontend jobs at FAANG, Big Tech, product companies and startups. Explore recently funded companies and fresher opportunities.'};
export default function Page(){
  return <section className="wrap explore-hub">
    <div className="explore-intro"><div><p className="explore-kicker">A place for your next move</p><h1>Different ambitions.<br/>A lane for each.</h1><p>Choose the companies you want to build with, or find the place to start. Frontend careers in India and remote roles open to you.</p></div><a className="quiet-link" href="/companies">All companies <ArrowUpRight size={17}/></a></div>
    <div className="explore-featured">{exploreCollections.filter(c=>['freshers','recently-funded'].includes(c.slug)).reverse().map(collection=><a className={'explore-feature explore-feature-'+collection.slug} href={'/explore/'+collection.slug} key={collection.slug}><span className="explore-feature-icon">{collection.slug==='freshers'?<GraduationCap size={30}/>:<TrendingUp size={30}/>}</span><h2>{collection.title}</h2><p>{collection.description}</p><span className="explore-feature-link">{collection.slug==='freshers'?'Find your first role':'Meet the companies'}<ArrowUpRight size={20}/></span></a>)}</div>
    <div className="explore-section-heading"><h2>Find your kind of company</h2><p>Grouped by what they do. No numbered tiers.</p></div>
    <div className="explore-group-list">{exploreCollections.filter(c=>'companyGroup' in c.filters).map(collection=><a href={'/explore/'+collection.slug} className="explore-group" key={collection.slug}><div><h3>{collection.title}</h3><p>{collection.description}</p></div><div className="explore-logo-stack" aria-hidden="true">{companies.filter(c=>c.groups.includes(collection.slug)).slice(0,3).map(company=><CompanyLogo company={company.name} key={company.id}/>)}</div><ArrowUpRight size={22}/></a>)}</div>
    <p className="explore-method"><Building2 size={17}/>These are curated, overlapping groups based on company products and services. They are not rankings or employer partnerships. Each company profile links to its official source.</p>
  </section>;
}
