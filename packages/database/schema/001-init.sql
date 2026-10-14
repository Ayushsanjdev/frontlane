CREATE TABLE IF NOT EXISTS jobs (id text PRIMARY KEY, source text NOT NULL, canonical_url text NOT NULL, payload jsonb NOT NULL, active boolean NOT NULL DEFAULT true, discovered_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_url ON jobs(source,canonical_url);
CREATE INDEX IF NOT EXISTS jobs_active_discovery ON jobs(active,discovered_at DESC,id);
CREATE INDEX IF NOT EXISTS jobs_source ON jobs(source);
CREATE TABLE IF NOT EXISTS applications (id uuid PRIMARY KEY, user_id text NOT NULL, job_id text NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,job_id));
CREATE INDEX IF NOT EXISTS applications_user_updated ON applications(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS profiles (user_id text PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ingestion_runs(source text NOT NULL,run_id text NOT NULL,body_hash text NOT NULL,receipt jsonb NOT NULL,completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,run_id));
CREATE INDEX IF NOT EXISTS ingestion_runs_completed ON ingestion_runs(completed_at DESC);
CREATE TABLE IF NOT EXISTS source_checks(source text PRIMARY KEY, checked_at timestamptz NOT NULL, status text NOT NULL,matched integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS viewers (id uuid PRIMARY KEY, last_seen_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS viewers_last_seen ON viewers(last_seen_at);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_available boolean;
CREATE TABLE IF NOT EXISTS job_first_publications (
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  canonical_url text PRIMARY KEY,
  job_id text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  baseline boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS job_publication_sequence ON job_first_publications(sequence);
