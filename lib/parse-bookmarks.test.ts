import { describe, it, expect } from "vitest"
import { parseNetscapeBookmarks, ParsedLink, ParsedFolder } from "./parse-bookmarks"

describe("parseNetscapeBookmarks", () => {
  it("should parse a complex bookmarks HTML file", () => {
    const html = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1609459200" LAST_MODIFIED="1609459200">Folder 1</H3>
    <DL><p>
        <DT><A HREF="http://example.com/" ADD_DATE="1609459200">Example</A>
        <DT><H3 ADD_DATE="1609459200" LAST_MODIFIED="1609459200">Folder 2</H3>
        <DL><p>
            <DT><A HREF="http://google.com/" ADD_DATE="1609459200">Google</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="http://facebook.com/" ADD_DATE="1609459200">Facebook</A>
</DL><p>
`
    const expected = [
      {
        name: "Folder 1",
        children: [
          {
            title: "Example",
            href: "http://example.com/",
          },
          {
            name: "Folder 2",
            children: [
              {
                title: "Google",
                href: "http://google.com/",
              },
            ],
          },
        ],
      },
      {
        title: "Facebook",
        href: "http://facebook.com/",
      },
    ]

    const result = parseNetscapeBookmarks(html)

    // A simple way to compare the structure without exact matching of all properties.
    // This is because the library might not parse all attributes like ADD_DATE.
    const simplify = (items: Array<ParsedFolder | ParsedLink>) => {
      return items.map((item) => {
        if ("children" in item) {
          return {
            name: item.name,
            children: simplify(item.children),
          }
        } else {
          return {
            title: item.title,
            href: item.href,
          }
        }
      })
    }

    expect(simplify(result)).toEqual(expected)
  })

  it("should return an empty array for empty or invalid html", () => {
    expect(parseNetscapeBookmarks("")).toEqual([])
    expect(parseNetscapeBookmarks("invalid html")).toEqual([])
  })
})
