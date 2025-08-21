import { isIP } from "node:net"

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost") return true
  const ip = isIP(hostname)
  if (ip) {
    if (
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.")
    ) {
      return true
    }
    if (hostname.startsWith("172.")) {
      const second = Number(hostname.split(".")[1])
      if (second >= 16 && second <= 31) return true
    }
  }
  return false
}

export function validateUrl(raw: string): URL {
  const url = new URL(raw)
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed")
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Private network URLs are not allowed")
  }
  return url
}
