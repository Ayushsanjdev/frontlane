ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_available boolean;
CREATE TABLE IF NOT EXISTS job_first_publications (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  canonical_url text PRIMARY KEY,
  job_id text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  baseline boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS job_publication_sequence ON job_first_publications(sequence);
INSERT INTO job_first_publications(canonical_url,job_id,published_at,baseline) SELECT canonical_url,min(id),min(discovered_at),true FROM jobs WHERE active=true GROUP BY canonical_url ON CONFLICT DO NOTHING;
