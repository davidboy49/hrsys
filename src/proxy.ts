import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get("pd_session")?.value
  let ok = false
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET), { algorithms: ["HS256"] })
      ok = true
    } catch {}
  }
  if (!ok && pathname !== "/login") {
    const url = new URL("/login", req.url)
    if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  if (ok && pathname === "/login") return NextResponse.redirect(new URL("/", req.url))
  return NextResponse.next()
}

export const config = {
  // device push endpoints authenticate by themselves
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|iclock/|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
