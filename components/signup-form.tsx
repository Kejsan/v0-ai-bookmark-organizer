"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { signUp } from "@/lib/actions"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#54a09b] hover:bg-[#4a8f8a] text-white py-6 text-lg font-medium rounded-lg h-[60px]"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing up...
        </>
      ) : (
        "Sign Up"
      )}
    </Button>
  )
}

export default function SignUpForm() {
  const [state, formAction] = useActionState(signUp, null)

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Create an account</h1>
        <p className="text-lg text-gray-300">Sign up to organize your bookmarks</p>
      </div>

      <form action={formAction} className="space-y-6">
        {state?.error && (
          <div className="bg-[#fb6163]/10 border border-[#fb6163]/50 text-[#fb6163] px-4 py-3 rounded">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="bg-[#54a09b]/10 border border-[#54a09b]/50 text-[#54a09b] px-4 py-3 rounded">
            {state.success}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>

        <SubmitButton />

        <div className="text-center text-gray-300">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-white hover:underline">
            Log in
          </Link>
        </div>
      </form>
    </div>
  )
}
