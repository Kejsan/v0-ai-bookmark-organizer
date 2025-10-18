export type ParsedFolder = {
  name: string
  children: Array<ParsedFolder | ParsedLink>
}

export type ParsedLink = {
  title: string
  href: string
  add_date?: string
  icon?: string
}

export function parseNetscapeBookmarks(
  html: string,
): Array<ParsedFolder | ParsedLink> {
  if (!html) return []
  const root: Array<ParsedFolder | ParsedLink> = []
  const stack: ParsedFolder[] = []

  const lines = html.split(/\r?\n/)

  const getCurrentChildren = () => (stack.length > 0 ? stack[stack.length - 1].children : root)

  const decodeHtml = (value: string) =>
    value
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&")

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith("<DL")) {
      continue
    }

    if (line.startsWith("</DL")) {
      stack.pop()
      continue
    }

    const folderMatch = line.match(/<DT><H3[^>]*>(.*?)<\/H3>/i)
    if (folderMatch) {
      const folderName = decodeHtml(folderMatch[1].trim())
      const folder: ParsedFolder = { name: folderName, children: [] }
      getCurrentChildren().push(folder)
      stack.push(folder)
      continue
    }

    const linkMatch = line.match(/<DT><A[^>]*HREF="([^"]+)"[^>]*>(.*?)<\/A>/i)
    if (linkMatch) {
      const href = linkMatch[1].trim()
      const title = decodeHtml(linkMatch[2].trim())
      const addDateMatch = line.match(/ADD_DATE="?([^"\s>]+)"?/i)
      const iconMatch = line.match(/ICON="([^"]+)"/i)
      const link: ParsedLink = {
        title,
        href,
      }

      if (addDateMatch) {
        link.add_date = addDateMatch[1]
      }

      if (iconMatch) {
        link.icon = iconMatch[1]
      }

      getCurrentChildren().push(link)
    }
  }

  return root
}
