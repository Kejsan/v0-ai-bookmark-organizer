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

    // 3. Ensure all needed categories exist (Batched by depth)
    const sortedPaths = Array.from(rawCategories).sort()

    // Group paths by depth
    const pathsByDepth = new Map<number, string[]>()
    let maxDepth = 0

    for (const path of sortedPaths) {
      const depth = path.split("/").length
      if (!pathsByDepth.has(depth)) {
        pathsByDepth.set(depth, [])
      }
      pathsByDepth.get(depth)!.push(path)
      maxDepth = Math.max(maxDepth, depth)
    }

    // Process each depth level
    for (let depth = 1; depth <= maxDepth; depth++) {
      const pathsAtDepth = pathsByDepth.get(depth) || []
      const missingPaths = pathsAtDepth.filter(p => !categoryMap.has(p))

      if (missingPaths.length === 0) continue

      const categoriesToInsert = []

      for (const path of missingPaths) {
        const parts = path.split("/")
        const name = parts[parts.length - 1]
        const parentPath = parts.slice(0, parts.length - 1).join("/")
        const parentId = parentPath ? categoryMap.get(parentPath) : null

        // Only insert if parent exists (or it's root)
        // Since we process by depth, parent SHOULD exist if hierarchy is valid
        if (parentPath && parentId === undefined) {
          console.warn(`Skipping orphan category: ${path} (Parent missing: ${parentPath})`)
          continue
        }

        categoriesToInsert.push({
          user_id: user.id,
          name,
          path,
          parent_id: parentId
        })
      }

      if (categoriesToInsert.length > 0) {
        // Batch insert for this depth
        const { data: inserted, error } = await supabase
          .from("categories")
          .insert(categoriesToInsert)
          .select("id, path")

        if (error) {
          console.error(`Failed to batch insert categories at depth ${depth}:`, error)
          // Fallback or Abort? For now, we continue, but downstream bookmarks might fail or be un-categorized
        } else if (inserted) {
          for (const cat of inserted) {
            categoryMap.set(cat.path, cat.id)
          }
        }
      }
    }

    // 4. Prepare batch inserts
    const validBookmarks = []
    const errors: string[] = []

    for (const item of flattenedBookmarks) {
      try {
        validateUrl(item.href)

        // Resolve category ID from map (should exist now)
        const categoryId = categoryMap.get(item.folderPath) || null

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
