export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { fetchPageMetadata } from "@/lib/scrape-meta"
import { validateUrl } from "@/lib/validate-url"
import { summarizeUrlWithGemini } from "@/lib/ai/gemini"
import { upsertBookmarkEmbedding } from "@/lib/embeddings"

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

    const { url, categoryPath } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL and reject private network targets
    try {
      validateUrl(url)
    } catch {
      return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 })
    }

    let categoryId: number | null = null

    // Handle category if provided
    if (categoryPath) {
      const pathParts = categoryPath.split("/").filter(Boolean)
      let parentId: number | null = null
      let currentPath = ""

      for (const name of pathParts) {
        currentPath = currentPath ? `${currentPath}/${name}` : name

        const { data: existing } = await supabase
          .from("categories")
          .select("id")
          .eq("user_id", user.id)
          .eq("path", currentPath)
          .maybeSingle()

        if (existing?.id) {
          parentId = existing.id
          continue
        }

        const { data: created, error } = await supabase
          .from("categories")
          .insert({
            user_id: user.id,
            name,
            parent_id: parentId,
            path: currentPath,
          })
          .select("id")
          .single()

        if (error) throw error
        parentId = created.id
      }

      categoryId = parentId
    }

    // Fetch metadata
    const metadata = await fetchPageMetadata(url)

    // Generate AI summary
    let summary = ""
    try {
      summary = await summarizeUrlWithGemini(user.id, url, metadata.title, metadata.description)
    } catch (error) {
      console.warn("Failed to generate summary:", error)
      summary = metadata.description || "No description available"
    }

    // Insert bookmark
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        title: metadata.title,
        url,
        description: summary,
        favicon_url: metadata.favicon,
        folder_path: categoryPath || "",
      })
      .select("id, title, url, description")
      .single()

    if (bookmarkError) {
      return NextResponse.json({ error: bookmarkError.message }, { status: 400 })
    }

    // Create embedding (async)
    if (bookmark) {
      const embeddingText = [bookmark.title, bookmark.url, bookmark.description].filter(Boolean).join(" ")

      upsertBookmarkEmbedding(user.id, bookmark.id, embeddingText).catch((error) =>
        console.warn("Embedding failed:", error),
      )
    }

    return NextResponse.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
      },
    })
  } catch (error) {
    console.error("Add link error:", error)
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 })
  }
}
