
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enrichBookmarksBatch } from "@/lib/ai/gemini"

export const maxDuration = 60 // Allow longer timeout for batch processing

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { ids, all } = body

        let bookmarksToProcess = []

        // Fetch bookmarks based on selection
        if (all) {
            const { data } = await supabase
                .from("bookmarks")
                .select("id, title, url, description")
                .eq("user_id", user.id)

            bookmarksToProcess = data || []
        } else if (Array.isArray(ids) && ids.length > 0) {
            const { data } = await supabase
                .from("bookmarks")
                .select("id, title, url, description")
                .eq("user_id", user.id)
                .in("id", ids)

            bookmarksToProcess = data || []
        } else {
            return NextResponse.json({ error: "No bookmarks selected" }, { status: 400 })
        }

        if (bookmarksToProcess.length === 0) {
            return NextResponse.json({ message: "No bookmarks found to process" })
        }

        // Process in chunks of 10 to avoid hitting token limits
        const CHUNK_SIZE = 10
        const results = []

        for (let i = 0; i < bookmarksToProcess.length; i += CHUNK_SIZE) {
            const chunk = bookmarksToProcess.slice(i, i + CHUNK_SIZE)
            const enrichedChunk = await enrichBookmarksBatch(user.id, chunk)
            results.push(...enrichedChunk)
        }

        // Update database
        let updatedCount = 0
        const errors = []

        for (const item of results) {
            // Create a description that includes tags for searchability
            const descriptionWithTags = item.tags && item.tags.length > 0
                ? `${item.summary}\n\nTags: ${item.tags.join(", ")}`
                : item.summary

            const { error } = await supabase
                .from("bookmarks")
                .update({
                    description: descriptionWithTags,
                    // If you had a dedicated tags column, you'd update it here too.
                    // For now, we append to description or assume description field usage.
                })
                .eq("id", item.id)
                .eq("user_id", user.id)

            if (error) {
                errors.push(`Failed to update ${item.id}: ${error.message}`)
            } else {
                updatedCount++
            }
        }

        return NextResponse.json({
            success: true,
            processed: bookmarksToProcess.length,
            updated: updatedCount,
            errors
        })

    } catch (error) {
        console.error("Batch enrich error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
