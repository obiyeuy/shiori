ALTER TABLE drafts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE versions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE versions ADD COLUMN source text NOT NULL DEFAULT 'publish' CHECK(source IN ('manual','checkpoint','publish','schedule'));
ALTER TABLE schedules ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE schedules ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE schedules ADD COLUMN important boolean NOT NULL DEFAULT false;
CREATE TABLE media (
 key uuid PRIMARY KEY, name text NOT NULL, mime text NOT NULL, bytes bigint NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','processing','ready','failed')),
 width integer, height integer, animated boolean NOT NULL DEFAULT false,
 error text, processor text, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE media_variants (
 media_key uuid NOT NULL REFERENCES media(key), variant text NOT NULL CHECK(variant IN ('original','display')),
 file_key text NOT NULL UNIQUE, mime text NOT NULL, bytes bigint NOT NULL, public_at timestamptz,
 PRIMARY KEY(media_key,variant)
);
CREATE TABLE media_references (
 id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES content_items(id), version_id uuid REFERENCES versions(id),
 media_key uuid NOT NULL REFERENCES media(key), variant text NOT NULL, scope text NOT NULL CHECK(scope IN ('draft','version')), revision integer NOT NULL
);
CREATE TABLE publication_operations (
 key uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES content_items(id), fingerprint text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE publication_events (
 id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES content_items(id), version_id uuid NOT NULL REFERENCES versions(id),
 kind text NOT NULL CHECK(kind IN ('first','important','revision')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public_content (
 content_id uuid PRIMARY KEY REFERENCES content_items(id), version_id uuid NOT NULL REFERENCES versions(id),
 type text NOT NULL, slug text NOT NULL, title text NOT NULL, summary text NOT NULL, body_text text NOT NULL,
 rendered_html text NOT NULL, payload jsonb NOT NULL, published_at timestamptz NOT NULL, rss_id text NOT NULL UNIQUE
);
CREATE TABLE operation_status (
 key text PRIMARY KEY, event_at timestamptz NOT NULL, collected_at timestamptz NOT NULL,
 last_success_at timestamptz,last_failure_at timestamptz,state text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE drafts ADD COLUMN checkpoint_at timestamptz NOT NULL DEFAULT now();
