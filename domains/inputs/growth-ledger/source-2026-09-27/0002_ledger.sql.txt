create table if not exists ledger_entries (
  content_hash text primary key,
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE', 'PROVEN')),
  created_at timestamptz not null default now(),
  attested_at timestamptz,
  payload text not null
);
