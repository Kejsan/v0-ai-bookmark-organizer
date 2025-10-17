export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  suggestBookmarkCategories,
  suggestDuplicateBookmarks,
  type BookmarkSummaryInput,
} from "@/lib/ai/gemini"

interface OrganizeRequestBody {
  prompt?: string
  limit?: number
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase environment variables are not set" },
      { status: 500 },
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: OrganizeRequestBody
  try {
    body = (await request.json()) as OrganizeRequestBody
  } catch {
    body = {}
  }

  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 200) : 100

  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, title, description, url, source, is_read")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !bookmarks) {
    console.error("Failed to load bookmarks for organization", error)
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 })
  }

  const summaryInput: BookmarkSummaryInput[] = bookmarks.map((bookmark) => ({
    id: bookmark.id,
    title: bookmark.title,
    description: bookmark.description,
    url: bookmark.url,
  }))

  try {
    const [categorySuggestions, duplicateSuggestions] = await Promise.all([
      suggestBookmarkCategories(user.id, summaryInput),
      suggestDuplicateBookmarks(user.id, summaryInput),
    ])

    return NextResponse.json({
      prompt: body.prompt ?? "organise my bookmarks by topic",
      categories: categorySuggestions,
      duplicates: duplicateSuggestions,
      bookmarks,
    })
  } catch (error) {
    console.error("AI organize error", error)
    return NextResponse.json({ error: "Failed to build AI suggestions" }, { status: 500 })
  }
}
