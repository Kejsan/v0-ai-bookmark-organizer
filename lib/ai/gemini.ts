import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"

const ALGO = "aes-256-gcm"

export async function getUserGeminiKey(userId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("user_api_credentials")
    .select("encrypted_key, nonce")
    .eq("user_id", userId)
    .eq("provider", "gemini")
    .single()

  if (error || !data) {
    throw new Error("Gemini API key not found. Please add your API key in account settings.")
  }

  const masterKey = process.env.APP_KMS_MASTER_KEY
  if (!masterKey) {
    throw new Error("Master encryption key not configured")
  }

  const key = Buffer.from(masterKey, "base64")
  const nonce = Buffer.from(data.nonce)
  const encryptedData = Buffer.from(data.encrypted_key)

  // Split encrypted data and auth tag (last 16 bytes)
  const authTag = encryptedData.slice(-16)
  const ciphertext = encryptedData.slice(0, -16)

  const decipher = crypto.createDecipheriv(ALGO, key, nonce)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString("utf8")
}

export async function embedTextWithGemini(userId: string, text: string): Promise<number[]> {
  const apiKey = await getUserGeminiKey(userId)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedText?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.substring(0, 2048), // Limit text length
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embedding API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const embedding = data?.embedding?.values

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid embedding response from Gemini")
  }

  return embedding
}

export async function summarizeUrlWithGemini(
  userId: string,
  url: string,
  title?: string,
  description?: string,
): Promise<string> {
  const apiKey = await getUserGeminiKey(userId)

  const prompt = `You are organizing a personal toolbox of web links. Summarize this URL in 1-2 sentences for quick scanning.

Title: ${title || "N/A"}
Description: ${description || "N/A"}
URL: ${url}

Provide a concise, helpful summary:`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.3,
        },
      }),
    },
  )

  if (!response.ok) {
    console.warn(`Gemini summary API error: ${response.status}`)
    return description || title || "No description available"
  }

  const data = await response.json()
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text

  return summary?.trim() || description || title || "No description available"
}
