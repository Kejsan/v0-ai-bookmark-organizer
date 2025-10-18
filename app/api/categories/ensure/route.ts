export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

interface EnsureCategoryBody {
  path?: string
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

  let body: EnsureCategoryBody
  try {
    body = (await request.json()) as EnsureCategoryBody
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const path = (body.path || "").trim()
  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 })
  }

  const segments = path.split("/").filter(Boolean)
  if (segments.length === 0) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 })
  }

  let parentId: number | null = null
  let currentPath = ""

  for (const segment of segments) {
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
      console.error("Failed to ensure category", error)
      return NextResponse.json({ error: "Failed to ensure category" }, { status: 500 })
    }

    parentId = created.id
  }

  return NextResponse.json({ id: parentId, path })
}
