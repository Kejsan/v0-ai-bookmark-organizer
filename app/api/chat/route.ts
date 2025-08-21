import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { semanticSearch } from "@/lib/embeddings"

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase environment variables are not set" },
      { status: 500 },
    )
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Perform semantic search
    const matches = await semanticSearch(user.id, query, 8)

    if (matches.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: "No relevant bookmarks found for your query.",
      })
    }

    // Get bookmark details for matched IDs
    const bookmarkIds = matches.map((match: any) => match.bookmark_id)

    const { data: bookmarks, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, description, folder_path, favicon_url")
      .in("id", bookmarkIds)

    if (error) {
      console.error("Failed to fetch bookmark details:", error)
      return NextResponse.json({ error: "Failed to retrieve bookmarks" }, { status: 500 })
    }

    // Combine matches with bookmark details and sort by similarity
    const enrichedResults = matches
      .map((match: any) => {
        const bookmark = bookmarks?.find((b) => b.id === match.bookmark_id)
        return bookmark
          ? {
              ...bookmark,
              similarity: match.similarity,
            }
          : null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.similarity - a.similarity)

    return NextResponse.json({
      suggestions: enrichedResults,
      message: `Found ${enrichedResults.length} relevant bookmarks for "${query}"`,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 })
  }
}
