export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

interface CategoryNode {
  id: number
  name: string
  path: string
  parent_id: number | null
  children: CategoryNode[]
}

export async function GET() {
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

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, parent_id, path")
      .eq("user_id", user.id)
      .order("path", { ascending: true })

    if (error) {
      console.error("Failed to fetch categories:", error)
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 },
      )
    }

    const map = new Map<number, CategoryNode>()
    const roots: CategoryNode[] = []

    for (const cat of data || []) {
      map.set(cat.id, { ...cat, children: [] })
    }

    for (const cat of data || []) {
      const node = map.get(cat.id)!
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return NextResponse.json({ categories: roots })
  } catch (error) {
    console.error("Categories GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    )
  }
}
