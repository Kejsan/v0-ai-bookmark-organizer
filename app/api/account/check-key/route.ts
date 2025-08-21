import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
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

    const { data, error } = await supabase
      .from("user_api_credentials")
      .select("provider, created_at")
      .eq("user_id", user.id)
      .eq("provider", "gemini")
      .maybeSingle()

    if (error) {
      console.error("Failed to check API key:", error)
      return NextResponse.json({ error: "Failed to check API key status" }, { status: 500 })
    }

    return NextResponse.json({
      hasKey: !!data,
      provider: data?.provider,
      createdAt: data?.created_at,
    })
  } catch (error) {
    console.error("Check key error:", error)
    return NextResponse.json({ error: "Failed to check API key status" }, { status: 500 })
  }
}
