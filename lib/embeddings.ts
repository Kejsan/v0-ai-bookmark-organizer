import { createClient } from "@/lib/supabase/server"
import { embedTextWithGemini } from "./ai/gemini"

export async function upsertBookmarkEmbedding(userId: string, bookmarkId: number, text: string): Promise<void> {
  try {
    const embedding = await embedTextWithGemini(userId, text)
    const supabase = createClient()

    const { error } = await supabase.from("bookmark_embeddings").upsert({
      bookmark_id: bookmarkId,
      embedding: embedding,
    })

    if (error) {
      console.error("Failed to upsert embedding:", error)
      throw error
    }
  } catch (error) {
    console.error("Error creating embedding:", error)
    // Don't throw - allow bookmark creation to succeed even if embedding fails
  }
}

export async function semanticSearch(userId: string, query: string, matchCount = 8): Promise<any[]> {
  try {
    const queryEmbedding = await embedTextWithGemini(userId, query)
    const supabase = createClient()

    const { data, error } = await supabase.rpc("match_bookmarks", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Semantic search error:", error)
    return []
  }
}
