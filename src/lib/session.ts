import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

export const COOKIE = "pd_session"
const MAX_AGE = 60 * 60 * 24 * 7

export type SessionUser = { id: string; email: string; name: string; role: Role }

function key() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is not set")
  return new TextEncoder().encode(s)
}

export async function encrypt(user: SessionUser, remember: boolean) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(remember ? "7d" : "12h")
    .sign(key())
}

export async function decrypt(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    return { id: payload.id as string, email: payload.email as string, name: payload.name as string, role: payload.role as Role }
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser, remember: boolean) {
  const token = await encrypt(user, remember)
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: MAX_AGE } : {}),
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function getSession() {
  const jar = await cookies()
  return decrypt(jar.get(COOKIE)?.value)
}

export async function requireUser() {
  const u = await getSession()
  if (!u) redirect("/login")
  return u
}

const RANK: Record<Role, number> = { EMPLOYEE: 0, MANAGER: 1, HR: 2, ADMIN: 3 }

export function atLeast(role: Role, min: Role) {
  return RANK[role] >= RANK[min]
}

export async function requireRole(min: Role) {
  const u = await requireUser()
  if (!atLeast(u.role, min)) redirect("/?denied=1")
  return u
}

/** For server actions: throws instead of redirecting. */
export async function assertRole(min: Role) {
  const u = await getSession()
  if (!u || !atLeast(u.role, min)) throw new Error("Not allowed")
  return u
}
