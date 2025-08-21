-- Similarity function for semantic search
create or replace function public.match_bookmarks(query_embedding vector, match_count int default 8)
returns table(
  bookmark_id bigint,
  similarity float
) language sql stable as $$
  select be.bookmark_id,
         1 - (be.embedding <=> query_embedding) as similarity
  from public.bookmark_embeddings be
  join public.bookmarks b on b.id = be.bookmark_id
  where b.user_id = auth.uid()
  order by be.embedding <=> query_embedding
  limit match_count;
$$;
