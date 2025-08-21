import { type NextRequest, NextResponse } from "next/server"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import crypto from "crypto"

const ALGO = "aes-256-gcm"

function encryptSecret(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const masterKey = process.env.APP_KMS_MASTER_KEY
  if (!masterKey) {
    throw new Error("Master encryption key not configured")
  }

  const key = Buffer.from(masterKey, "base64")
  const nonce = crypto.randomBytes(12) // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv(ALGO, key, nonce)

  let encrypted = cipher.update(plaintext, "utf8")
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()
  const ciphertext = Buffer.concat([encrypted, authTag])

  return { ciphertext, nonce }
}

export async function POST(request: NextRequest) {
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

    const { apiKey } = await request.json()

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    // Basic validation - Gemini API keys typically start with "AIza"
    if (!apiKey.startsWith("AIza")) {
      return NextResponse.json({ error: "Invalid Gemini API key format" }, { status: 400 })
    }

    // Encrypt the API key
    const { ciphertext, nonce } = encryptSecret(apiKey)

    // Store encrypted key in database
    const { error } = await supabase.from("user_api_credentials").upsert({
      user_id: user.id,
      provider: "gemini",
      encrypted_key: ciphertext.toString("base64"),
      nonce: nonce.toString("base64"),
    })

    if (error) {
      console.error("Failed to save API key:", error)
      return NextResponse.json({ error: "Failed to save API key" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "API key saved successfully",
    })
  } catch (error) {
    console.error("Save key error:", error)
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 })
  }
}
