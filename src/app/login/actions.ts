"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, destroySession } from "@/lib/session"
import { audit } from "@/lib/audit"

export type LoginState = { error?: string }

const MAX_FAILS = 5
const LOCK_MIN = 15

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase()
  const password = String(form.get("password") ?? "")
  const remember = form.get("remember") === "on"
  if (!email || !password) return { error: "Enter your email and password." }

  const user = await db.user.findUnique({ where: { email } })
  const generic = { error: "Email or password is incorrect." }
  if (!user || !user.isActive) return generic

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` }
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    const fails = user.failedLogins + 1
    await db.user.update({
      where: { id: user.id },
      data: fails >= MAX_FAILS
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) }
        : { failedLogins: fails },
    })
    return generic
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role }, remember)
  await audit(user.id, "login", "User", user.id)
  redirect("/employees")
}

export async function logout() {
  await destroySession()
  redirect("/login")
}
