import { describe, it, expect, vi } from "vitest"
import { fetchPageMetadata } from "./scrape-meta"

describe("fetchPageMetadata", () => {
  it("parses metadata and resolves favicon", async () => {
    const html = `<!doctype html><html><head>
      <title>Sample Title</title>
      <meta name="description" content="Sample description" />
      <link rel="icon" href="/favicon.ico" />
    </head></html>`

    const originalFetch = global.fetch
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => html,
      })) as any,
    )

    const metadata = await fetchPageMetadata("https://example.com/page")

    expect(metadata.title).toBe("Sample Title")
    expect(metadata.description).toBe("Sample description")
    expect(metadata.favicon).toBe("https://example.com/favicon.ico")

    global.fetch = originalFetch
  })

  it("rejects invalid URLs", async () => {
    await expect(fetchPageMetadata("http://localhost")).rejects.toThrow()
  })
})
