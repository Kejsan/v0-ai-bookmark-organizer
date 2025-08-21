import { describe, it, expect } from "vitest"
import { validateUrl } from "./validate-url"

describe("validateUrl", () => {
  it("allows https URLs", () => {
    const url = validateUrl("https://example.com")
    expect(url.protocol).toBe("https:")
  })

  it("rejects non-http schemes", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow()
  })

  it("rejects private network hosts", () => {
    expect(() => validateUrl("http://localhost")).toThrow()
    expect(() => validateUrl("http://192.168.0.1")).toThrow()
  })
})
