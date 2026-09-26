CREATE TABLE content_items (
 id uuid PRIMARY KEY, type text NOT NULL CHECK(type IN ('article','note','moment','project','tool','resource')),
 archived boolean NOT NULL DEFAULT false, public_version_id uuid, first_published_at timestamptz,
 UNIQUE(id,type)
);
CREATE TABLE drafts (
 id uuid PRIMARY KEY, content_id uuid NOT NULL UNIQUE REFERENCES content_items(id),
 revision integer NOT NULL CHECK(revision>0), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object')
);
CREATE TABLE versions (
 id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES content_items(id), revision integer NOT NULL CHECK(revision>=0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), published_at timestamptz NOT NULL,
 UNIQUE(content_id,id)
);
ALTER TABLE content_items ADD CONSTRAINT public_version_ownership FOREIGN KEY(id,public_version_id) REFERENCES versions(content_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE url_aliases (
 content_id uuid NOT NULL, type text NOT NULL, slug text NOT NULL CHECK(length(slug)<=100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 PRIMARY KEY(type,slug), FOREIGN KEY(content_id,type) REFERENCES content_items(id,type)
);
CREATE FUNCTION reject_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'versions are immutable'; END $$;
CREATE TRIGGER immutable_versions BEFORE UPDATE OR DELETE ON versions FOR EACH ROW EXECUTE FUNCTION reject_version_mutation();
CREATE FUNCTION reject_alias_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'aliases retain permanent ownership'; END $$;
CREATE TRIGGER immutable_aliases BEFORE UPDATE OR DELETE ON url_aliases FOR EACH ROW EXECUTE FUNCTION reject_alias_mutation();
CREATE FUNCTION preserve_content_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.first_published_at IS NOT NULL AND (NEW.type<>OLD.type OR NEW.first_published_at IS DISTINCT FROM OLD.first_published_at) THEN RAISE EXCEPTION 'published identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stable_content BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION preserve_content_identity();
CREATE TABLE tags (id uuid PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE series (id uuid PRIMARY KEY, name text NOT NULL UNIQUE, archived boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','public')));
CREATE TABLE series_members (content_id uuid PRIMARY KEY REFERENCES content_items(id), series_id uuid NOT NULL REFERENCES series(id), position integer NOT NULL CHECK(position>=0), UNIQUE(series_id,position) DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE version_tags (version_id uuid NOT NULL REFERENCES versions(id), tag_id uuid NOT NULL REFERENCES tags(id), name_snapshot text NOT NULL, PRIMARY KEY(version_id,tag_id));
CREATE TABLE schedules (
 id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES content_items(id), version_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','running','retrying','failed','cancelled','completed')),
 run_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error text,
 FOREIGN KEY(content_id,version_id) REFERENCES versions(content_id,id)
);
CREATE UNIQUE INDEX schedules_one_open_per_content ON schedules(content_id) WHERE status IN ('pending','running','retrying','failed');
CREATE TABLE users (
 id uuid PRIMARY KEY, role text NOT NULL UNIQUE CHECK(role='owner'), password_digest text,
 github_numeric_id text UNIQUE CHECK(github_numeric_id ~ '^[0-9]+$'),
 CHECK(password_digest IS NOT NULL OR github_numeric_id IS NOT NULL)
);
CREATE TABLE oauth_accounts (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), provider text NOT NULL CHECK(provider='github'), provider_numeric_id text NOT NULL CHECK(provider_numeric_id ~ '^[0-9]+$'), UNIQUE(provider,provider_numeric_id), UNIQUE(user_id,provider));
CREATE TABLE sessions (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),token_digest text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL,last_seen_at timestamptz NOT NULL,reauthenticated_at timestamptz NOT NULL,
 revoked_at timestamptz, CHECK(last_seen_at>=created_at)
);
CREATE TABLE oauth_attempts (state_digest text PRIMARY KEY, verifier text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE audit_events (id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),action text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE site_settings (key text PRIMARY KEY,value jsonb NOT NULL);
CREATE TABLE service_links (id uuid PRIMARY KEY,name text NOT NULL,url text NOT NULL,status text NOT NULL CHECK(status IN ('unchecked','available','maintenance','unavailable')),status_updated_at timestamptz NOT NULL DEFAULT now());
