-- Search documents contain only the current public projection; drafts never enter these columns.
ALTER TABLE public_content ADD COLUMN search_title text GENERATED ALWAYS AS (lower(normalize(title,NFKC))) STORED;
ALTER TABLE public_content ADD COLUMN search_summary text GENERATED ALWAYS AS (lower(normalize(summary,NFKC))) STORED;
ALTER TABLE public_content ADD COLUMN search_body text GENERATED ALWAYS AS (lower(normalize(body_text || ' ' || COALESCE(payload->>'body',''),NFKC))) STORED;
