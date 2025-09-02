export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    let query = supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, favicon_url, category_id, folder_path",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (category) {
      const categoryId = Number(category)
      if (!Number.isNaN(categoryId)) {
        query = query.eq("category_id", categoryId)
      } else {
        query = query.eq("folder_path", category)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch bookmarks:", error)
      return NextResponse.json(
        { error: "Failed to fetch bookmarks" },
        { status: 500 },
      )
    }

    return NextResponse.json({ bookmarks: data || [] })
  } catch (error) {
    console.error("Bookmarks GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookmarks" },
      { status: 500 },
    )
  }
}
