import { NextRequest } from "next/server"
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

describe("API routes with missing Supabase config", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ""
    vi.resetModules()
  })

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it("add-link returns configuration error", async () => {
    const { POST } = await import("./add-link/route")
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })

  it("upload returns configuration error", async () => {
    const { POST } = await import("./upload/route")
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })

  it("chat returns configuration error", async () => {
    const { POST } = await import("./chat/route")
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })

  it("check-key returns configuration error", async () => {
    const { GET } = await import("./account/check-key/route")
    const res = await GET(new NextRequest("http://localhost"))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })

  it("save-key returns configuration error", async () => {
    const { POST } = await import("./account/save-key/route")
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })

  it("delete-key returns configuration error", async () => {
    const { DELETE } = await import("./account/delete-key/route")
    const res = await DELETE(new NextRequest("http://localhost", { method: "DELETE" }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Supabase environment variables are not set/)
  })
})
