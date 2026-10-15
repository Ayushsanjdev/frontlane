'use client';

import {Avatar,AvatarFallback,AvatarImage} from '@/components/ui/avatar';
import assets from '@/lib/company-logos.json';

const logos = new Map(Object.entries(assets).map(([company, logo]) => [company.trim().toLowerCase(), logo]));

export function CompanyLogo({company}:{company:string}) {
  const logo = logos.get(company.trim().toLowerCase());
  const initials = company.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';

  return (
    <Avatar className="company-icon company-logo" aria-hidden="true">
      {logo && <AvatarImage src={logo.path} alt="" className="object-contain"/>}
      <AvatarFallback className="company-logo-fallback">{initials}</AvatarFallback>
    </Avatar>
  );
}
