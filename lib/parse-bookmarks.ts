import { JSDOM } from "jsdom"

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

export function parseNetscapeBookmarks(html: string): Array<ParsedFolder | ParsedLink> {
  // Use JSDOM to safely parse the incoming bookmark HTML in Node
  const dom = new JSDOM(html)
  const doc = dom.window.document

  const dl = doc.querySelector("dl")
  if (!dl) return []

  function walkDL(node: Element): Array<ParsedFolder | ParsedLink> {
    const out: Array<ParsedFolder | ParsedLink> = []
    const dtElements = Array.from(node.children).filter((child) => child.tagName === "DT")

    for (let i = 0; i < dtElements.length; i++) {
      const dt = dtElements[i] as Element
      const h3 = dt.querySelector("h3")
      const a = dt.querySelector("a")

      if (h3) {
        // This is a folder
        const name = h3.textContent?.trim() || "Untitled Folder"
        // Look for the next sibling DL element
        let nextSibling = dt.nextElementSibling
        while (nextSibling && nextSibling.tagName !== "DL" && nextSibling.tagName !== "DT") {
          nextSibling = nextSibling.nextElementSibling
        }

        const nested = nextSibling?.tagName === "DL" ? (nextSibling as Element) : null
        out.push({
          name,
          children: nested ? walkDL(nested) : [],
        })
      } else if (a) {
        // This is a bookmark
        const title = a.textContent?.trim() || "Untitled"
        const href = a.getAttribute("href") || ""
        const add_date = a.getAttribute("add_date") || undefined
        const icon = a.getAttribute("icon") || undefined

        if (href) {
          out.push({ title, href, add_date, icon })
        }
      }
    }
    return out
  }

  return walkDL(dl)
}
