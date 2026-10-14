ALTER TABLE applications ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS application_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_activity_owner ON application_activity(user_id,application_id,created_at);
CREATE OR REPLACE FUNCTION record_application_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.payload IS NOT DISTINCT FROM OLD.payload THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN NEW.revision=OLD.revision+1; END IF;
  NEW.payload=jsonb_set(jsonb_set(NEW.payload,'{revision}',to_jsonb(NEW.revision)),'{updatedAt}',to_jsonb(NEW.updated_at));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS application_revision ON applications;
CREATE TRIGGER application_revision BEFORE INSERT OR UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION record_application_activity();
CREATE OR REPLACE FUNCTION record_application_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO application_activity(application_id,user_id,kind,detail) VALUES(NEW.id,NEW.user_id,'saved',jsonb_build_object('stage',NEW.payload->>'stage'));
  ELSE
    IF NEW.payload->>'stage' IS DISTINCT FROM OLD.payload->>'stage' THEN
      INSERT INTO application_activity(application_id,user_id,kind,detail) VALUES(NEW.id,NEW.user_id,'stage',jsonb_build_object('from',OLD.payload->>'stage','to',NEW.payload->>'stage'));
    END IF;
    IF NEW.payload->>'followUp' IS DISTINCT FROM OLD.payload->>'followUp' THEN
      INSERT INTO application_activity(application_id,user_id,kind,detail) VALUES(NEW.id,NEW.user_id,'follow-up',jsonb_build_object('from',OLD.payload->>'followUp','to',NEW.payload->>'followUp'));
    END IF;
    IF COALESCE(NEW.payload->'workspace'->>'archived','false') IS DISTINCT FROM COALESCE(OLD.payload->'workspace'->>'archived','false') THEN
      INSERT INTO application_activity(application_id,user_id,kind) VALUES(NEW.id,NEW.user_id,CASE WHEN NEW.payload->'workspace'->>'archived'='true' THEN 'archived' ELSE 'restored' END);
    END IF;
    IF NEW.payload->'workspace'->'interviews' IS DISTINCT FROM OLD.payload->'workspace'->'interviews' THEN
      INSERT INTO application_activity(application_id,user_id,kind) VALUES(NEW.id,NEW.user_id,'interviews-updated');
    END IF;
    IF NEW.payload->'workspace' IS DISTINCT FROM OLD.payload->'workspace' THEN
      INSERT INTO application_activity(application_id,user_id,kind) VALUES(NEW.id,NEW.user_id,'workspace-updated');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS application_history ON applications;
CREATE TRIGGER application_history AFTER INSERT OR UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION record_application_event();
CREATE TABLE IF NOT EXISTS job_feedback(user_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('job','company')),target text NOT NULL,PRIMARY KEY(user_id,kind,target));
