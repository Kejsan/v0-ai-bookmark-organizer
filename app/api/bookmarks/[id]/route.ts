import { NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid bookmark id" }, { status: 400 })
    }

    const body = await request.json()
    const update: {
      category_id?: number | null
      folder_path?: string | null
      is_read?: boolean
      source?: string
    } = {}
    if ("category_id" in body) {
      update.category_id = body.category_id
    } else if ("categoryId" in body) {
      update.category_id = body.categoryId
    }
    if ("folder_path" in body) {
      update.folder_path = body.folder_path
    } else if ("folderPath" in body) {
      update.folder_path = body.folderPath
    }
    if ("is_read" in body) {
      update.is_read = Boolean(body.is_read)
    } else if ("isRead" in body) {
      update.is_read = Boolean(body.isRead)
    }
    if ("source" in body && typeof body.source === "string") {
      update.source = body.source
    }

    const { error } = await supabase
      .from("bookmarks")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Failed to update bookmark:", error)
      return NextResponse.json(
        { error: "Failed to update bookmark" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Bookmarks PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid bookmark id" }, { status: 400 })
    }

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Failed to delete bookmark:", error)
      return NextResponse.json(
        { error: "Failed to delete bookmark" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Bookmarks DELETE error:", error)
    return NextResponse.json(
      { error: "Failed to delete bookmark" },
      { status: 500 },
    )
  }
}
