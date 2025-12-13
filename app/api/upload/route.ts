export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { parseNetscapeBookmarks } from "@/lib/parse-bookmarks"
import { ingestBookmarks } from "@/lib/bookmarks/ingest"

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

    // Flatten logic
    const flattenedBookmarks: any[] = []
    function traverse(items: any[], pathPrefix: string[] = []) {
      for (const item of items) {
        if ("children" in item) {
          const newPath = [...pathPrefix, item.name]
          traverse(item.children, newPath)
        } else {
          const folderPath = pathPrefix.join("/")
          flattenedBookmarks.push({
            title: item.title,
            url: item.href,
            addDate: item.addDate,
            folderPath: folderPath || "Imported",
          })
        }
      }
    }
    traverse(bookmarkTree)

    // Map to Ingest format
    const ingestPayload = flattenedBookmarks.map(b => ({
      url: b.url,
      title: b.title,
      folderPath: b.folderPath,
      dateAdded: b.addDate ? new Date(parseInt(b.addDate) * 1000).toISOString() : undefined,
      source: "file_upload"
    }))

    const result = await ingestBookmarks({
      userId: user.id,
      bookmarks: ingestPayload,
      supabase
    })

    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to process bookmark file" }, { status: 500 })
  }
}
