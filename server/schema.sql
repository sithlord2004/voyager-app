-- Voyager backend schema (Postgres / Supabase)
-- The server is "dumb storage": it holds ciphertext blobs plus the minimal
-- clear metadata the dashboard and expiry-alert email need. It never sees a key.

create table if not exists documents (
  family_id    text        not null,
  id           text        not null,
  updated_at   bigint      not null,          -- client clock (ms) for last-write-wins
  expiry_date  date,                          -- clear: needed for alert emails
  doc_type     text,                          -- clear: e.g. 'Passport'
  title        text,                          -- clear: human label
  deleted      boolean     not null default false,
  payload      jsonb       not null,          -- the full ENCRYPTED client record
  primary key (family_id, id)
);

create index if not exists documents_sync_idx   on documents (family_id, updated_at);
create index if not exists documents_expiry_idx on documents (family_id, expiry_date);

-- Optional: a table of family email recipients for alerts.
create table if not exists families (
  family_id   text primary key,
  alert_email text not null
);

-- Lock the tables down: only the server (service-role key) may touch them.
alter table documents enable row level security;
alter table families  enable row level security;
-- No anon/auth policies are created, so the public anon key has zero access.
-- The serverless functions use the service-role key, which bypasses RLS.
