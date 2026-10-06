import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import type { Role } from "@prisma/client"
import { db } from "@/lib/db"

export const COOKIE = "pd_session"
const MAX_AGE = 60 * 60 * 24 * 7

export type SessionUser = { id: string; email: string; name: string; role: Role }
type Claims = { id: string; v: number }

function key() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters")
  return new TextEncoder().encode(s)
}

async function encrypt(claims: Claims, remember: boolean) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(remember ? "7d" : "12h")
    .sign(key())
}

async function decrypt(token: string | undefined): Promise<Claims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    if (typeof payload.id !== "string" || typeof payload.v !== "number") return null
    return { id: payload.id, v: payload.v }
  } catch {
    return null
  }
}

/** The cookie holds only who and which token version. Name and role are always read from the database. */
export async function createSession(user: { id: string; tokenVersion: number }, remember: boolean) {
  const token = await encrypt({ id: user.id, v: user.tokenVersion }, remember)
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

/**
 * The signed-in user, or null. Checked against the database on every request (once per request),
 * so disabling a user, changing their role or resetting their password takes effect immediately.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const claims = await decrypt(jar.get(COOKIE)?.value)
  if (!claims) return null
  const u = await db.user.findUnique({ where: { id: claims.id }, select: { id: true, email: true, name: true, role: true, isActive: true, tokenVersion: true } })
  if (!u || !u.isActive || u.tokenVersion !== claims.v) return null
  return { id: u.id, email: u.email, name: u.name, role: u.role }
})

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
