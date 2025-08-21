export interface PageMetadata {
  title: string
  description: string
  favicon?: string
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkOrganizer/1.0)",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Extract title
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")
    const titleElement = doc.querySelector("title")
    const title = ogTitle || titleElement?.textContent || url

    // Extract description
    const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute("content")
    const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute("content")
    const description = ogDescription || metaDescription || ""

    // Extract favicon
    const iconLink = doc.querySelector('link[rel="icon"]') || doc.querySelector('link[rel="shortcut icon"]')
    const favicon = iconLink?.getAttribute("href")

    return {
      title: title.trim(),
      description: description.trim(),
      favicon: favicon || undefined,
    }
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${url}:`, error)
    // Return fallback metadata
    return {
      title: url,
      description: "",
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
