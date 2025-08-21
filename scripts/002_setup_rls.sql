-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.user_api_credentials enable row level security;
alter table public.categories enable row level security;
alter table public.bookmarks enable row level security;
alter table public.bookmark_embeddings enable row level security;
alter table public.audit_log enable row level security;

-- RLS policies: user can only see own rows
create policy "own_profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_creds" on public.user_api_credentials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_categories" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_bookmarks" on public.bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_embeddings" on public.bookmark_embeddings
  for all using (
    exists (
      select 1 from public.bookmarks b
      where b.id = bookmark_id and b.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.bookmarks b
      where b.id = bookmark_id and b.user_id = auth.uid()
    )
  );

create policy "own_audit" on public.audit_log
  for insert using (user_id = auth.uid()) with check (user_id = auth.uid());
