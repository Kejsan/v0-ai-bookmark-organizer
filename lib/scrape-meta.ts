import { JSDOM } from "jsdom"
import { validateUrl } from "./validate-url"

export interface PageMetadata {
  title: string
  description: string
  favicon?: string
}

export async function fetchPageMetadata(rawUrl: string): Promise<PageMetadata> {
  const url = validateUrl(rawUrl)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 second timeout

  try {
    const response = await fetch(url.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkOrganizer/1.0)",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const doc = new JSDOM(html).window.document

    // Extract title
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")
    const titleElement = doc.querySelector("title")
    const title = ogTitle || titleElement?.textContent || url.href

    // Extract description
    const ogDescription = doc
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content")
    const metaDescription = doc
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
    const description = ogDescription || metaDescription || ""

    // Extract favicon
    const iconLink =
      doc.querySelector('link[rel="icon"]') ||
      doc.querySelector('link[rel="shortcut icon"]')
    const faviconHref = iconLink?.getAttribute("href")
    const favicon = faviconHref ? new URL(faviconHref, url).href : undefined

    return {
      title: title.trim(),
      description: description.trim(),
      favicon,
    }
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${url.href}:`, error)
    // Return fallback metadata
    return {
      title: url.href,
      description: "",
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
