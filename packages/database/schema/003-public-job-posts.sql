CREATE TABLE IF NOT EXISTS job_publications (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  job_id text NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  body_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_publications_owner_created ON job_publications(owner_id,created_at);
CREATE INDEX IF NOT EXISTS jobs_canonical_lookup ON jobs(canonical_url);
