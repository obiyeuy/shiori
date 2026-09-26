ALTER TABLE series ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE series ADD COLUMN cover uuid REFERENCES media(key);
ALTER TABLE oauth_attempts ADD COLUMN binding_session_id uuid REFERENCES sessions(id);
