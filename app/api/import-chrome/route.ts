export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  createClientWithAccessToken,
  isSupabaseConfigured,
} from "@/lib/supabase/server"
import { fetchPageMetadata } from "@/lib/scrape-meta"
import { validateUrl } from "@/lib/validate-url"
import { summarizeUrlWithGemini } from "@/lib/ai/gemini"
import { upsertBookmarkEmbedding } from "@/lib/embeddings"

interface ChromeBookmarkPayload {
  id?: string
  title?: string
  url: string
  path?: string
  folderPath?: string
  faviconUrl?: string | null
  dateAdded?: string | number
  dateGroupModified?: string | number
  source?: string
  isRead?: boolean
  status?: "READ" | "UNREAD"
  description?: string | null
}

interface ChromeImportPayload {
  bookmarks?: ChromeBookmarkPayload[]
  readingList?: ChromeBookmarkPayload[]
  folders?: Array<{
    id: string
    title: string
    path: string
  }>
  autoCategorize?: boolean
}

function parseDate(input?: string | number): string | undefined {
  if (!input) return undefined
  if (typeof input === "number") {
    return new Date(input).toISOString()
  }
  const numeric = Number(input)
  if (!Number.isNaN(numeric) && numeric > 0) {
    try {
      return new Date(numeric).toISOString()
    } catch {
      return undefined
    }
  }
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }
  return parsed.toISOString()
}

function extractFolderPath(entry: ChromeBookmarkPayload): string {
  if (entry.folderPath) return entry.folderPath
  if (entry.path) return entry.path
  return "Chrome/Imported"
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase environment variables are not set" },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get("authorization") || ""
  const tokenHeader = request.headers.get("x-supabase-access-token") || ""
  const accessToken =
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : tokenHeader.trim()

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: ChromeImportPayload
  try {
    payload = (await request.json()) as ChromeImportPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const supabase = createClientWithAccessToken(accessToken)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bookmarks = payload.bookmarks ?? []
  const readingList = payload.readingList ?? []

  if (bookmarks.length === 0 && readingList.length === 0) {
    return NextResponse.json({ error: "No bookmark data provided" }, { status: 400 })
  }

  const allEntries = [...bookmarks, ...readingList]

  // 1. Check for potential duplicates (bulk fetch)
  const chunkedUrls = []
  const entriesWithUrl = allEntries.filter(e => e.url)
  const allUrls = Array.from(new Set(entriesWithUrl.map(e => e.url)))

  // Supabase 'in' filter limit is somewhat high but let's be safe if thousands of URLs
  const DUPE_CHECK_CHUNK = 200
  const existingSet = new Set<string>()

  for (let i = 0; i < allUrls.length; i += DUPE_CHECK_CHUNK) {
    const batch = allUrls.slice(i, i + DUPE_CHECK_CHUNK)
    const { data: found } = await supabase
      .from("bookmarks")
      .select("url")
      .eq("user_id", user.id)
      .in("url", batch)

    if (found) {
      found.forEach(b => existingSet.add(b.url))
    }
  }

  const duplicates = []
  const uniqueEntries = []

  for (const entry of allEntries) {
    if (existingSet.has(entry.url)) {
      duplicates.push({ url: entry.url, existingId: 0 }) // We didn't fetch ID to save BW, client just wants to know it exists
    } else {
      uniqueEntries.push(entry)
      // Add to set to prevent duplicate duplicates within the payload itself
      existingSet.add(entry.url)
    }
  }

  // 2. Resolve Categories (Batch optimized)
  const categoryMap = new Map<string, number>()
  const { data: existingCats } = await supabase.from("categories").select("id, path").eq("user_id", user.id)
  if (existingCats) {
    existingCats.forEach(c => categoryMap.set(c.path, c.id))
  }

  async function ensureCategoryPath(fullPath: string): Promise<number | null> {
    if (!fullPath) return null
    const safePath = fullPath.trim()
    if (!safePath) return null

    if (categoryMap.has(safePath)) return categoryMap.get(safePath)!

    const parts = safePath.split("/").filter(Boolean)
    let currentPath = ""
    let parentId: number | null = null

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (categoryMap.has(currentPath)) {
        parentId = categoryMap.get(currentPath)!
      } else {
        // Create 
        const { data: created } = await supabase
          .from("categories")
          .insert({
            user_id: user.id,
            name: part,
            path: currentPath,
            parent_id: parentId
          })
          .select("id")
          .single()

        if (created) {
          parentId = created.id
          categoryMap.set(currentPath, created.id)
        } else {
          // Race condition lookup
          const { data: found } = await supabase.from("categories").select("id").eq("path", currentPath).single()
          if (found) {
            parentId = found.id
            categoryMap.set(currentPath, found.id)
          }
        }
      }
    }
    return parentId
  }

  // Pre-scan categories
  const pathsToEnsure = new Set<string>()
  uniqueEntries.forEach(e => {
    const p = extractFolderPath(e)
    if (p) pathsToEnsure.add(p)
  })

  // Ensure all sorted paths
  for (const p of Array.from(pathsToEnsure).sort()) {
    await ensureCategoryPath(p)
  }

  // 3. Prepare Bulk Insert
  const toInsert = []
  let failedCount = 0
  const errors: string[] = []

  for (const entry of uniqueEntries) {
    try {
      validateUrl(entry.url)
      const folderPath = extractFolderPath(entry)
      const categoryId = categoryMap.get(folderPath) || null

      const isRead = entry.isRead ?? (entry.status ? entry.status === "READ" : undefined)

      toInsert.push({
        user_id: user.id,
        title: entry.title || entry.url,
        url: entry.url,
        description: entry.description || "",
        favicon_url: entry.faviconUrl || null,
        category_id: categoryId,
        folder_path: folderPath,
        source: entry.source || "chrome",
        is_read: typeof isRead === "boolean" ? isRead : false,
        created_at: parseDate(entry.dateAdded),
        updated_at: parseDate(entry.dateGroupModified)
      })
    } catch (e: any) {
      failedCount++
      errors.push(`Invalid URL: ${entry.url}`)
    }
  }

  // 4. Execute Insertion (Chunks)
  const INSERT_CHUNK = 100
  let insertedCount = 0

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from("bookmarks").insert(chunk)

    if (error) {
      console.error("Bulk insert failed", error)
      failedCount += chunk.length
      errors.push(`Chunk failed: ${error.message}`)
    } else {
      insertedCount += chunk.length
    }
  }

  return NextResponse.json({
    imported: insertedCount,
    failed: failedCount,
    duplicates,
    errors,
  })
}
