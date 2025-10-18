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
  const autoCategorize = payload.autoCategorize !== false

  if (bookmarks.length === 0 && readingList.length === 0) {
    return NextResponse.json({ error: "No bookmark data provided" }, { status: 400 })
  }

  const allEntries = [...bookmarks, ...readingList]
  const uniqueUrls = Array.from(new Set(allEntries.map((item) => item.url))).filter(Boolean)

  const { data: existingBookmarks } = await supabase
    .from("bookmarks")
    .select("id, url, source")
    .in("url", uniqueUrls)
    .eq("user_id", user.id)

  const duplicateMap = new Map<string, { id: number; source: string | null }>()
  existingBookmarks?.forEach((item) => {
    if (item.url) {
      duplicateMap.set(item.url, { id: item.id, source: item.source ?? null })
    }
  })

  let insertedCount = 0
  let failedCount = 0
  const duplicates: Array<{ url: string; existingId: number }> = []
  const errors: string[] = []

  let aiEnabled = false
  if (autoCategorize) {
    const { data: geminiKeyRow, error: geminiKeyError } = await supabase
      .from("user_api_credentials")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "gemini")
      .maybeSingle()

    if (geminiKeyRow && !geminiKeyError) {
      aiEnabled = true
    } else if (geminiKeyError) {
      console.warn("Failed to check Gemini key presence", geminiKeyError)
    }
  }

  async function ensureCategory(path: string): Promise<number | null> {
    const safePath = path.trim()
    if (!safePath) {
      return null
    }

    const pathParts = safePath.split("/").filter(Boolean)
    let parentId: number | null = null
    let currentPath = ""

    for (const segment of pathParts) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

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
          name: segment,
          parent_id: parentId,
          path: currentPath,
        })
        .select("id")
        .single()

      if (error || !created) {
        throw error ?? new Error("Failed to create category")
      }

      parentId = created.id
    }

    return parentId
  }

  async function processEntry(entry: ChromeBookmarkPayload, options?: { source?: string }) {
    try {
      validateUrl(entry.url)
    } catch (error) {
      failedCount++
      if (error instanceof Error) {
        errors.push(error.message)
      }
      return
    }

    if (duplicateMap.has(entry.url)) {
      const duplicate = duplicateMap.get(entry.url)!
      duplicates.push({ url: entry.url, existingId: duplicate.id })
      return
    }

    const folderPath = extractFolderPath(entry)
    let categoryId: number | null = null
    try {
      categoryId = await ensureCategory(folderPath)
    } catch {
      failedCount++
      errors.push(`Failed to ensure category for ${entry.url}`)
      return
    }

    let metadata
    try {
      metadata = await fetchPageMetadata(entry.url)
    } catch (error) {
      console.warn("Failed to fetch metadata", error)
      metadata = {
        title: entry.title ?? entry.url,
        description: entry.description ?? null,
        favicon: entry.faviconUrl ?? null,
      }
    }

    let summary = metadata.description || entry.description || metadata.title || entry.url
    if (aiEnabled) {
      try {
        summary = await summarizeUrlWithGemini(
          user.id,
          entry.url,
          metadata.title ?? entry.title ?? undefined,
          metadata.description ?? entry.description ?? undefined,
        )
      } catch (error) {
        console.warn("Gemini summary failed", error)
      }
    }

    const bookmarkInsert: Record<string, any> = {
      user_id: user.id,
      title: metadata.title || entry.title || entry.url,
      url: entry.url,
      description: summary,
      favicon_url: metadata.favicon || entry.faviconUrl || null,
      category_id: categoryId,
      folder_path: folderPath,
    }

    const source = options?.source ?? entry.source
    if (source) {
      bookmarkInsert.source = source
    }
    const isRead = entry.isRead ?? (entry.status ? entry.status === "READ" : undefined)
    if (typeof isRead === "boolean") {
      bookmarkInsert.is_read = isRead
    }
    const createdAt = parseDate(entry.dateAdded)
    if (createdAt) {
      bookmarkInsert.created_at = createdAt
    }
    const updatedAt = parseDate(entry.dateGroupModified)
    if (updatedAt) {
      bookmarkInsert.updated_at = updatedAt
    }

    const { data: bookmark, error: insertError } = await supabase
      .from("bookmarks")
      .insert(bookmarkInsert)
      .select("id, title, url, description")
      .single()

    if (insertError || !bookmark) {
      failedCount++
      const message = insertError?.message || "Failed to insert bookmark"
      errors.push(message)
      return
    }

    insertedCount++
    if (aiEnabled) {
      const embeddingText = [bookmark.title, bookmark.url, bookmark.description].filter(Boolean).join(" ")
      if (embeddingText) {
        upsertBookmarkEmbedding(user.id, bookmark.id, embeddingText).catch((error) =>
          console.warn("Failed to upsert embedding", error),
        )
      }
    }
  }

  for (const item of bookmarks) {
    await processEntry(item, { source: item.source ?? "chrome" })
  }

  for (const item of readingList) {
    await processEntry(item, { source: item.source ?? "readingList" })
  }

  return NextResponse.json({
    imported: insertedCount,
    failed: failedCount,
    duplicates,
    errors,
  })
}
