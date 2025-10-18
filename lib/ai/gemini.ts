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
  const nonce = Buffer.from(data.nonce, "base64")
  const encryptedData = Buffer.from(data.encrypted_key, "base64")

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

export interface BookmarkSummaryInput {
  id: number
  title: string | null
  description?: string | null
  url?: string | null
}

export interface CategorySuggestion {
  category: string
  bookmarkIds: number[]
  rationale?: string
}

export async function suggestBookmarkCategories(
  userId: string,
  bookmarks: BookmarkSummaryInput[],
): Promise<CategorySuggestion[]> {
  if (bookmarks.length === 0) {
    return []
  }

  const apiKey = await getUserGeminiKey(userId)
  const prompt = `Cluster the following bookmarks into thematic categories. Respond only with JSON in the form [{"category": string, "bookmarkIds": number[], "rationale": string}].

${bookmarks
    .map((bookmark, index) => {
      const parts = [
        `Bookmark #${index + 1}`,
        `ID: ${bookmark.id}`,
        `Title: ${bookmark.title || "Untitled"}`,
        bookmark.description ? `Description: ${bookmark.description}` : undefined,
        bookmark.url ? `URL: ${bookmark.url}` : undefined,
      ].filter(Boolean)

      return parts.join("\n")
    })
    .join("\n\n")}

Group similar bookmarks under meaningful category names and cite the bookmark IDs in each group.`

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
          maxOutputTokens: 512,
          temperature: 0.2,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini category suggestion API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const textResponse: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textResponse) {
    return []
  }

  const jsonStart = textResponse.indexOf("[")
  const jsonEnd = textResponse.lastIndexOf("]")

  if (jsonStart === -1 || jsonEnd === -1) {
    return []
  }

  const rawJson = textResponse.slice(jsonStart, jsonEnd + 1)

  try {
    const parsed = JSON.parse(rawJson) as CategorySuggestion[]
    return parsed.filter((entry) => Array.isArray(entry.bookmarkIds) && entry.category)
  } catch (error) {
    console.warn("Failed to parse Gemini category suggestions", error)
    return []
  }
}

export interface DuplicateSuggestion {
  firstId: number
  secondId: number
  score: number
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  if (magA === 0 || magB === 0) {
    return 0
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function suggestDuplicateBookmarks(
  userId: string,
  bookmarks: BookmarkSummaryInput[],
  similarityThreshold = 0.92,
): Promise<DuplicateSuggestion[]> {
  if (bookmarks.length < 2) {
    return []
  }

  const embeddings = await Promise.all(
    bookmarks.map((bookmark) => {
      const text = [bookmark.title, bookmark.description, bookmark.url]
        .filter(Boolean)
        .join(" ")

      return embedTextWithGemini(userId, text || "bookmark")
    }),
  )

  const suggestions: DuplicateSuggestion[] = []

  for (let i = 0; i < bookmarks.length; i++) {
    for (let j = i + 1; j < bookmarks.length; j++) {
      const score = cosineSimilarity(embeddings[i], embeddings[j])
      if (score >= similarityThreshold) {
        suggestions.push({
          firstId: bookmarks[i].id,
          secondId: bookmarks[j].id,
          score,
        })
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score)
}
