export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  createClientWithAccessToken,
  isSupabaseConfigured,
} from "@/lib/supabase/server"
import { ingestBookmarks } from "@/lib/bookmarks/ingest"

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

  // Map to Ingest format
  const ingestPayload = allEntries.map(entry => {
    const isRead = entry.isRead ?? (entry.status ? entry.status === "READ" : undefined)

    return {
      url: entry.url,
      title: entry.title || entry.url,
      folderPath: extractFolderPath(entry),
      description: entry.description || "",
      faviconUrl: entry.faviconUrl,
      source: entry.source || "chrome",
      isRead: typeof isRead === "boolean" ? isRead : false,
      dateAdded: parseDate(entry.dateAdded),
      dateGroupModified: parseDate(entry.dateGroupModified)
    }
  })

  // Use unified engine
  const result = await ingestBookmarks({
    userId: user.id,
    bookmarks: ingestPayload,
    supabase
  })

  return NextResponse.json({
    success: true,
    ...result
  })
}
