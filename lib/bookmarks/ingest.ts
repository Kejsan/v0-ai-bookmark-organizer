import { type SupabaseClient } from "@supabase/supabase-js"
import { validateUrl } from "@/lib/validate-url"

export interface IngestBookmark {
    url: string
    title: string
    folderPath?: string
    description?: string
    faviconUrl?: string | null
    source?: string
    isRead?: boolean
    dateAdded?: string // ISO string
    dateGroupModified?: string // ISO string
}

export interface IngestOptions {
    userId: string
    bookmarks: IngestBookmark[]
    supabase: SupabaseClient
}

export interface IngestResult {
    imported: number
    failed: number
    duplicates: { url: string }[]
    errors: string[]
}

/**
 * Unified ingestion function for saving bookmarks.
 * Handles batch category creation and bulk bookmark insertion.
 */
export async function ingestBookmarks({
    userId,
    bookmarks,
    supabase,
}: IngestOptions): Promise<IngestResult> {
    const result: IngestResult = {
        imported: 0,
        failed: 0,
        duplicates: [],
        errors: [],
    }

    if (!bookmarks.length) {
        return result
    }

    // 1. Deduplicate & Validate Input
    const uniqueEntries: IngestBookmark[] = []
    const seenUrls = new Set<string>()

    // Gather URLs to correct duplicates against DB
    const validBookmarks = []
    for (const b of bookmarks) {
        try {
            if (!b.url) continue
            validateUrl(b.url)

            // Local dedup
            if (seenUrls.has(b.url)) {
                continue // Skip exact duplicate in payload
            }
            seenUrls.add(b.url)
            validBookmarks.push(b)
        } catch {
            result.failed++
            result.errors.push(`Invalid URL: ${b.url}`)
        }
    }

    // 2. Check DB for duplicates (Batch)
    // Check in chunks of 200
    const existingUrls = new Set<string>()
    const CHUNK_SIZE = 200
    const allUrls = validBookmarks.map((b) => b.url)

    for (let i = 0; i < allUrls.length; i += CHUNK_SIZE) {
        const batch = allUrls.slice(i, i + CHUNK_SIZE)
        const { data: found } = await supabase
            .from("bookmarks")
            .select("url")
            .eq("user_id", userId)
            .in("url", batch)

        if (found) {
            found.forEach((r) => existingUrls.add(r.url))
        }
    }

    const toInsert: IngestBookmark[] = []
    for (const b of validBookmarks) {
        if (existingUrls.has(b.url)) {
            result.duplicates.push({ url: b.url })
        } else {
            toInsert.push(b)
        }
    }

    if (toInsert.length === 0) {
        return result
    }

    // 3. Resolve Categories (Optimized Batch Depth-First)
    const categoryMap = new Map<string, number>()

    // Load existing categories
    const { data: existingCats } = await supabase
        .from("categories")
        .select("id, path")
        .eq("user_id", userId)

    if (existingCats) {
        existingCats.forEach((c) => categoryMap.set(c.path, c.id))
    }

    // Collect unique paths from payload
    const pathsToEnsure = new Set<string>()
    toInsert.forEach((b) => {
        const p = b.folderPath ? b.folderPath.trim() : "Imported"
        // Normalize path just in case
        const safePath = p.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/")
        if (safePath) pathsToEnsure.add(safePath)
        // Update reference in object
        b.folderPath = safePath
    })

    // Group by depth
    const pathsByDepth = new Map<number, Set<string>>()
    let maxDepth = 0

    pathsToEnsure.forEach((path) => {
        const parts = path.split("/")
        const depth = parts.length
        if (depth > maxDepth) maxDepth = depth

        // Ensure parents
        let currentPath = ""
        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part
            const level = index + 1
            if (!pathsByDepth.has(level)) {
                pathsByDepth.set(level, new Set())
            }
            pathsByDepth.get(level)!.add(currentPath)
        })
    })

    // Create missing categories level by level
    for (let level = 1; level <= maxDepth; level++) {
        const pathsAtLevel = pathsByDepth.get(level)
        if (!pathsAtLevel) continue

        const missingPaths = Array.from(pathsAtLevel).filter((p) => !categoryMap.has(p))
        if (missingPaths.length === 0) continue

        const categoriesToInsert = missingPaths.map((path) => {
            const parts = path.split("/")
            const name = parts[parts.length - 1]
            const parentPath = parts.slice(0, -1).join("/")
            const parentId = parentPath ? categoryMap.get(parentPath) : null
            return {
                user_id: userId,
                name,
                path,
                parent_id: parentId,
            }
        })

        const { data: inserted, error } = await supabase
            .from("categories")
            .insert(categoriesToInsert)
            .select("id, path")

        if (error) {
            result.errors.push(`Category creation failed at depth ${level}: ${error.message}`)
            // Don't abort completely, try to insert bookmarks anyway (might fail category constraint if rigid, but usually ok with null)
        } else if (inserted) {
            inserted.forEach((c) => categoryMap.set(c.path, c.id))
        }
    }

    // 4. Batch Insert Bookmarks
    const dbRecords = toInsert.map((b) => ({
        user_id: userId,
        title: b.title || b.url,
        url: b.url,
        description: b.description || "",
        catgory_id: b.folderPath ? categoryMap.get(b.folderPath) : null, // Typo in original DB? check schema. usually category_id
        category_id: b.folderPath ? categoryMap.get(b.folderPath) : null,
        folder_path: b.folderPath,
        favicon_url: b.faviconUrl || null,
        source: b.source || "import",
        is_read: b.isRead || false,
        created_at: b.dateAdded ? new Date(b.dateAdded).toISOString() : new Date().toISOString(),
        updated_at: b.dateGroupModified ? new Date(b.dateGroupModified).toISOString() : new Date().toISOString(),
    }))

    const INSERT_CHUNK = 100
    for (let i = 0; i < dbRecords.length; i += INSERT_CHUNK) {
        const chunk = dbRecords.slice(i, i + INSERT_CHUNK)
        const { error } = await supabase.from("bookmarks").insert(chunk)

        if (error) {
            result.failed += chunk.length
            result.errors.push(`Bookmark batch failed: ${error.message}`)
        } else {
            result.imported += chunk.length
        }
    }

    return result
}
