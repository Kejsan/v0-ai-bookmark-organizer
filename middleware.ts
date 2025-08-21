import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth")

  if (isAuthRoute) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
