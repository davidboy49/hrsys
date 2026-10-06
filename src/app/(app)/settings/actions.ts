"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertRole, getSession } from "@/lib/session"
import { audit } from "@/lib/audit"

type R = { error?: string; ok?: boolean }

const SETTING_KEYS = ["company.name", "company.currency", "employee.prefix", "attendance.lateGraceMin"] as const

export async function saveSettings(form: FormData): Promise<R> {
  const user = await assertRole("ADMIN")
  for (const k of SETTING_KEYS) {
    const v = form.get(k)
    if (v == null) continue
    const value = String(v).trim()
    if (k === "employee.prefix" && !/^[A-Za-z0-9-]{1,8}$/.test(value)) return { error: "Employee ID prefix: up to 8 letters, numbers or dashes" }
    if (k === "attendance.lateGraceMin" && !(Number(value) >= 0 && Number(value) <= 120)) return { error: "Grace minutes must be between 0 and 120" }
    await db.setting.upsert({ where: { key: k }, update: { value }, create: { key: k, value } })
  }
  await audit(user.id, "update", "Setting")
  revalidatePath("/settings")
  return { ok: true }
}

const pw = z.string().min(8, "Password must be at least 8 characters")

const newUser = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]),
  employeeId: z.string().optional(),
  password: pw,
})

export async function createUser(form: FormData): Promise<R> {
  const admin = await assertRole("ADMIN")
  const p = newUser.safeParse(Object.fromEntries(form.entries()))
  if (!p.success) return { error: p.error.issues[0].message }
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: "A user with this email already exists" }
  const employeeId = p.data.employeeId || null
  if (employeeId && (await db.user.findUnique({ where: { employeeId } }))) return { error: "That employee already has a login" }
  const u = await db.user.create({ data: { name: p.data.name, email: p.data.email, role: p.data.role, employeeId, passwordHash: await bcrypt.hash(p.data.password, 10) } })
  await audit(admin.id, "create", "User", u.id, u.email)
  revalidatePath("/settings")
  return { ok: true }
}

export async function updateUser(id: string, patch: { name?: string; email?: string; role?: "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE"; employeeId?: string | null; isActive?: boolean; password?: string }): Promise<R> {
  const admin = await assertRole("ADMIN")
  if (id === admin.id && (patch.isActive === false || (patch.role && patch.role !== "ADMIN"))) return { error: "You cannot demote or deactivate your own account" }
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) return { error: "Name is required" }
    data.name = name
  }
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase()
    if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" }
    const dup = await db.user.findFirst({ where: { email, NOT: { id } } })
    if (dup) return { error: "A user with this email already exists" }
    data.email = email
  }
  if (patch.role) data.role = patch.role
  if (patch.employeeId !== undefined) {
    const eid = patch.employeeId || null
    if (eid && (await db.user.findFirst({ where: { employeeId: eid, NOT: { id } } }))) return { error: "That employee already has a login" }
    data.employeeId = eid
  }
  if (patch.isActive !== undefined) data.isActive = patch.isActive
  if (patch.password !== undefined) {
    const p = pw.safeParse(patch.password)
    if (!p.success) return { error: p.error.issues[0].message }
    data.passwordHash = await bcrypt.hash(patch.password, 10)
    data.failedLogins = 0
    data.lockedUntil = null
  }
  await db.user.update({ where: { id }, data })
  await audit(admin.id, "update", "User", id, Object.keys(patch).join(","))
  revalidatePath("/settings")
  return { ok: true }
}

export async function changeOwnPassword(form: FormData): Promise<R> {
  const s = await getSession()
  if (!s) return { error: "Not signed in" }
  const cur = String(form.get("current") ?? "")
  const next = String(form.get("next") ?? "")
  const p = pw.safeParse(next)
  if (!p.success) return { error: p.error.issues[0].message }
  const u = await db.user.findUnique({ where: { id: s.id } })
  if (!u || !(await bcrypt.compare(cur, u.passwordHash))) return { error: "Current password is incorrect" }
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 10) } })
  await audit(u.id, "password", "User", u.id)
  return { ok: true }
}
