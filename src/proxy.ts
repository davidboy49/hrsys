import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

/**
 * Cheap first gate: no valid signed cookie means off to the login page.
 * This only checks the signature. Whether the user is still active, and their role, is checked
 * against the database in getSession(), which every page and action uses.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/login") return NextResponse.next()

  const token = req.cookies.get("pd_session")?.value
  let ok = false
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET), { algorithms: ["HS256"] })
      ok = true
    } catch {}
  }
  if (!ok) {
    const url = new URL("/login", req.url)
    if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // device push endpoints and public assets handle themselves
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|iclock/|api/logo|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
