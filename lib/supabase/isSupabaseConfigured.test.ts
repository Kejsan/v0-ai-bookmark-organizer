import { describe, it, expect, afterAll } from "vitest"
import { isSupabaseConfigured } from "@/lib/supabase/server"

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

afterAll(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
})

describe("isSupabaseConfigured", () => {
  it("reflects runtime environment variable changes", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ""
    expect(isSupabaseConfigured()).toBe(false)

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.com"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"
    expect(isSupabaseConfigured()).toBe(true)

    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ""
    expect(isSupabaseConfigured()).toBe(false)
  })
})
