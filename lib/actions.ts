"use server"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signIn(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" }
  }

  const email = formData.get("email")
  const password = formData.get("password")

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" }
  }

  const supabase = createClient()
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toString(),
      password: password.toString(),
    })

    if (error) {
      return { error: error.message }
    }
  } catch (error) {
    console.error("Login error:", error)
    if (error instanceof Error) {
      if (
        error.message === "NEXT_REDIRECT" ||
        (error as any).digest === "NEXT_REDIRECT"
      ) {
        throw error
      }
      return { error: error.message }
    }
    return { error: "An unexpected error occurred. Please try again." }
  }

  redirect("/")
}

export async function signUp(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" }
  }

  const email = formData.get("email")
  const password = formData.get("password")

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" }
  }

  const supabase = createClient()

  try {
    const { error } = await supabase.auth.signUp({
      email: email.toString(),
      password: password.toString(),
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
      },
    })

    if (error) {
      return { error: error.message }
    }

    return { success: "Check your email to confirm your account." }
  } catch (error) {
    console.error("Sign up error:", error)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" }
  }
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}
