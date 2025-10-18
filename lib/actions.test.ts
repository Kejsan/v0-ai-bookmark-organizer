import { beforeEach, describe, expect, it, vi } from "vitest"

const signInWithPasswordMock = vi.fn()
const signUpMock = vi.fn()
const resendMock = vi.fn()
const createClientMock = vi.fn()
const isSupabaseConfiguredMock = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
  isSupabaseConfigured: () => isSupabaseConfiguredMock(),
}))

const redirectMock = vi.fn(() => {
  throw new Error("REDIRECT")
})

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

describe("auth server actions", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset()
    signUpMock.mockReset()
    resendMock.mockReset()
    redirectMock.mockClear()
    createClientMock.mockReset()
    isSupabaseConfiguredMock.mockReset()
  })

  describe("signIn", () => {
    it("returns an error when form data is missing", async () => {
      const { signIn } = await import("./actions")

      const result = await signIn(null, null as unknown as FormData)

      expect(result).toEqual({ error: "Form data is missing" })
    })

    it("requires email and password", async () => {
      const { signIn } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "user@example.com")

      const result = await signIn(null, formData)

      expect(result).toEqual({ error: "Email and password are required" })
    })

    it("surfaces configuration issues", async () => {
      const { signIn } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "user@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(false)

      const result = await signIn(null, formData)

      expect(result?.error).toMatch(/Supabase/i)
      expect(signInWithPasswordMock).not.toHaveBeenCalled()
    })

    it("bubbles up authentication errors", async () => {
      const { signIn } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "user@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(true)
      signInWithPasswordMock.mockResolvedValueOnce({
        error: { message: "Invalid credentials" },
      })
      createClientMock.mockReturnValue({
        auth: {
          signInWithPassword: signInWithPasswordMock,
        },
      })

      const result = await signIn(null, formData)

      expect(result).toEqual({ error: "Invalid credentials" })
    })

    it("redirects when authentication succeeds", async () => {
      const { signIn } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "user@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(true)
      signInWithPasswordMock.mockResolvedValueOnce({ error: null })
      createClientMock.mockReturnValue({
        auth: {
          signInWithPassword: signInWithPasswordMock,
        },
      })

      await expect(signIn(null, formData)).rejects.toThrow("REDIRECT")
      expect(redirectMock).toHaveBeenCalledWith("/")
    })
  })

  describe("signUp", () => {
    it("validates presence of credentials", async () => {
      const { signUp } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "new@example.com")

      const result = await signUp(null, formData)

      expect(result).toEqual({ error: "Email and password are required" })
    })

    it("surfaces configuration errors", async () => {
      const { signUp } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "new@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(false)

      const result = await signUp(null, formData)

      expect(result).toEqual({ error: "Supabase is not configured" })
    })

    it("resends confirmation email when rate limited", async () => {
      const { signUp } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "new@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(true)
      signUpMock.mockResolvedValueOnce({ error: { message: "Rate limit exceeded" } })
      resendMock.mockResolvedValueOnce({ error: null })
      createClientMock.mockReturnValue({
        auth: {
          signUp: signUpMock,
          resend: resendMock,
        },
      })

      const result = await signUp(null, formData)

      expect(signUpMock).toHaveBeenCalled()
      expect(resendMock).toHaveBeenCalledWith({ type: "signup", email: "new@example.com" })
      expect(result).toEqual({
        success: "Confirmation email resent. Check your inbox to complete registration.",
      })
    })

    it("returns a helpful error when resend fails", async () => {
      const { signUp } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "new@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(true)
      signUpMock.mockResolvedValueOnce({ error: { message: "Rate limit" } })
      resendMock.mockResolvedValueOnce({ error: { message: "Resend failed" } })
      createClientMock.mockReturnValue({
        auth: {
          signUp: signUpMock,
          resend: resendMock,
        },
      })

      const result = await signUp(null, formData)

      expect(result).toEqual({ error: "Resend failed" })
    })

    it("returns success message when signup succeeds", async () => {
      const { signUp } = await import("./actions")
      const formData = new FormData()
      formData.set("email", "new@example.com")
      formData.set("password", "secret")
      isSupabaseConfiguredMock.mockReturnValue(true)
      signUpMock.mockResolvedValueOnce({ error: null })
      createClientMock.mockReturnValue({
        auth: {
          signUp: signUpMock,
          resend: resendMock,
        },
      })

      const result = await signUp(null, formData)

      expect(result).toEqual({ success: "Check your email to confirm your account." })
    })
  })
})
