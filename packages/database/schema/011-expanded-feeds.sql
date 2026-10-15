-- Public read-only employer adapters; application submission stays on employer sites.
ALTER TABLE employer_sources DROP CONSTRAINT IF EXISTS employer_sources_provider_check;
ALTER TABLE employer_sources ADD CONSTRAINT employer_sources_provider_check CHECK(provider IN ('greenhouse','lever','smartrecruiters','ashby','amazon'));
