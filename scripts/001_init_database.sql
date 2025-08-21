-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Users profiles table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default now()
);

-- Store the user's Gemini API key encrypted (not plaintext)
create table if not exists public.user_api_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'gemini',
  encrypted_key bytea not null,
  nonce bytea not null,
  created_at timestamp with time zone default now()
);

-- Bookmark categories derived from folders in Netscape export
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id bigint references public.categories(id) on delete set null,
  path text not null, -- e.g. "Work/AI/Research"
  created_at timestamp with time zone default now()
);
create index on public.categories(user_id);
create unique index on public.categories(user_id, path);

-- Bookmarks (flattened)
create table if not exists public.bookmarks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id bigint references public.categories(id) on delete set null,
  title text,
  url text not null,
  description text,
  favicon_url text,
  folder_path text, -- original path from export
  created_at timestamp with time zone default now()
);
create index on public.bookmarks(user_id);
create index on public.bookmarks(user_id, category_id);
create unique index on public.bookmarks(user_id, url);

-- Embeddings (separate for flexibility)
create table if not exists public.bookmark_embeddings (
  bookmark_id bigint primary key references public.bookmarks(id) on delete cascade,
  embedding vector(768) -- match EMBEDDING_DIM
);

-- Simple activity log (optional)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  meta jsonb,
  created_at timestamp with time zone default now()
);
