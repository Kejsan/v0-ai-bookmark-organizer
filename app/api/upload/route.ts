import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { parseNetscapeBookmarks } from "@/lib/parse-bookmarks"
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

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const html = await file.text()
    const bookmarkTree = parseNetscapeBookmarks(html)

    if (bookmarkTree.length === 0) {
      return NextResponse.json({ error: "No bookmarks found in file" }, { status: 400 })
    }

    // Helper function to ensure category path exists
    async function ensureCategory(path: string): Promise<number | null> {
      if (!path) return null

      const pathParts = path.split("/").filter(Boolean)
      let parentId: number | null = null
      let currentPath = ""

      for (const name of pathParts) {
        currentPath = currentPath ? `${currentPath}/${name}` : name

        // Check if category already exists
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

        // Create new category
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

        if (error) {
          console.error("Failed to create category:", error)
          throw error
        }

        parentId = created.id
      }

      return parentId
    }

    // Process bookmarks recursively
    async function processBookmarks(items: any[], pathPrefix: string[] = []): Promise<void> {
      for (const item of items) {
        if ("children" in item) {
          // This is a folder
          await processBookmarks(item.children, [...pathPrefix, item.name])
        } else {
          // This is a bookmark
          const folderPath = pathPrefix.join("/")
          const categoryId = await ensureCategory(folderPath || "Imported")

          try {
            // Validate URL before fetching
            validateUrl(item.href)
            // Fetch metadata
            const metadata = await fetchPageMetadata(item.href)

            // Generate AI summary (with fallback)
            let summary = ""
            try {
              summary = await summarizeUrlWithGemini(user.id, item.href, metadata.title, metadata.description)
            } catch (error) {
              console.warn("Failed to generate summary:", error)
              summary = metadata.description || metadata.title || "No description available"
            }

            // Insert bookmark
            const { data: bookmark, error: bookmarkError } = await supabase
              .from("bookmarks")
              .insert({
                user_id: user.id,
                category_id: categoryId,
                title: metadata.title || item.title,
                url: item.href,
                description: summary,
                favicon_url: metadata.favicon,
                folder_path: folderPath,
              })
              .select("id, title, url, description")
              .single()

            if (bookmarkError) {
              console.error("Failed to insert bookmark:", bookmarkError)
              continue // Skip this bookmark but continue processing others
            }

            // Create embedding (async, don't wait)
            if (bookmark) {
              const embeddingText = [bookmark.title, bookmark.url, bookmark.description].filter(Boolean).join(" ")

              // Don't await - let embeddings process in background
              upsertBookmarkEmbedding(user.id, bookmark.id, embeddingText).catch((error) =>
                console.warn("Embedding failed:", error),
              )
            }
          } catch (error) {
            console.error(`Failed to process bookmark ${item.href}:`, error)
            // Continue processing other bookmarks
          }
        }
      }
    }

    await processBookmarks(bookmarkTree)

    return NextResponse.json({
      success: true,
      message: "Bookmarks imported successfully",
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to process bookmark file" }, { status: 500 })
  }
}
