export const runtime = "nodejs"

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
    const supabase = await createClient()
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

    // 1. Flatten the tree to identify all categories and bookmarks
    const flattenedBookmarks: any[] = []
    const rawCategories = new Set<string>()

    function traverse(items: any[], pathPrefix: string[] = []) {
      for (const item of items) {
        if ("children" in item) {
          const newPath = [...pathPrefix, item.name]
          rawCategories.add(newPath.join("/"))
          traverse(item.children, newPath)
        } else {
          const folderPath = pathPrefix.join("/")
          if (folderPath) rawCategories.add(folderPath)

          flattenedBookmarks.push({
            ...item,
            folderPath: folderPath || "Imported",
          })
        }
      }
    }

    traverse(bookmarkTree)

    // 2. Load existing categories into memory
    const { data: existingTabs } = await supabase
      .from("categories")
      .select("id, path")
      .eq("user_id", user.id)

    const categoryMap = new Map<string, number>()
    if (existingTabs) {
      for (const cat of existingTabs) {
        categoryMap.set(cat.path, cat.id)
      }
    }

    // Helper: Ensure category exists (using local cache first)
    // We still do this sequentially or carefully because parent IDs depend on previous inserts
    // But since we have the full map, we only insert what's missing.
    async function ensureCategoryPath(fullPath: string): Promise<number | null> {
      if (!fullPath) return null
      if (categoryMap.has(fullPath)) return categoryMap.get(fullPath)!

      const parts = fullPath.split("/")
      let currentPath = ""
      let parentId: number | null = null

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part

        if (categoryMap.has(currentPath)) {
          parentId = categoryMap.get(currentPath)!
        } else {
          // Create it
          const { data: created, error } = await supabase
            .from("categories")
            .insert({
              user_id: user.id,
              name: part,
              path: currentPath,
              parent_id: parentId
            })
            .select("id")
            .single()

          if (error || !created) {
            console.error(`Failed to create category ${currentPath}`, error)
            // If update failed (race condition?), try fetching it
            const { data: retry } = await supabase
              .from("categories")
              .select("id")
              .eq("user_id", user.id)
              .eq("path", currentPath)
              .single()

            if (retry) {
              parentId = retry.id
              categoryMap.set(currentPath, retry.id)
              continue
            }
            return parentId // Fallback to last known parent
          }

          parentId = created.id
          categoryMap.set(currentPath, created.id)
        }
      }
      return parentId
    }

    // 3. Ensure all needed categories exist
    const sortedPaths = Array.from(rawCategories).sort()
    for (const path of sortedPaths) {
      await ensureCategoryPath(path)
    }

    // 4. Prepare batch inserts
    const validBookmarks = []
    const errors: string[] = []

    for (const item of flattenedBookmarks) {
      try {
        validateUrl(item.href)

        // Resolve category ID from map (should exist now)
        const categoryId = categoryMap.get(item.folderPath) || await ensureCategoryPath(item.folderPath) || null

        validBookmarks.push({
          user_id: user.id,
          category_id: categoryId,
          title: item.title || item.href,
          url: item.href,
          // Use simple fallback description
          description: item.title || "",
          // favicon_url: null, // Let frontend generic icon handle null
          folder_path: item.folderPath,
        })
      } catch (e: any) {
        errors.push(e.message)
      }
    }

    if (validBookmarks.length === 0) {
      return NextResponse.json({ imported: 0, failed: errors.length, errors }, { status: 400 })
    }

    // 5. Batch insert in chunks
    const CHUNK_SIZE = 100
    let insertedCount = 0
    let failedCount = 0

    for (let i = 0; i < validBookmarks.length; i += CHUNK_SIZE) {
      const chunk = validBookmarks.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from("bookmarks").insert(chunk)

      if (error) {
        console.error("Batch insert failed:", error)
        failedCount += chunk.length // All in this chunk failed
        errors.push(`Batch ${i / CHUNK_SIZE + 1} failed: ${error.message}`)
      } else {
        insertedCount += chunk.length
      }
    }

    return NextResponse.json({
      imported: insertedCount,
      failed: failedCount + errors.length, // approximation
      errors
    })

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to process bookmark file" }, { status: 500 })
  }
}
