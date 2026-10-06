"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { distanceM, verifyToken } from "@/lib/qr"
import { rebuildDaily } from "@/lib/attendance"
import { localDateKey } from "@/lib/format"
import { audit } from "@/lib/audit"
import { qrDeviceFor } from "@/lib/qr-attendance"
import { rateLimit } from "@/lib/rate-limit"

export type PunchResult = { ok: true; type: "IN" | "OUT"; at: string; location: string } | { ok: false; error: string }

export async function punchByQr(token: string, type: "IN" | "OUT", geo: { lat: number; lng: number; accuracy: number } | null): Promise<PunchResult> {
  const user = await getSession()
  if (!user) return { ok: false, error: "Please sign in first." }

  if (!(await rateLimit(`punch:${user.id}`, 10, 60)).ok) return { ok: false, error: "Too many attempts. Wait a minute and try again." }
  if (type !== "IN" && type !== "OUT") return { ok: false, error: "Choose check in or check out." }

  const v = verifyToken(token)
  if (!v.ok) return { ok: false, error: v.reason === "expired" ? "This QR code has expired. Scan the code on the screen again." : "This QR code is not valid." }

  const [me, loc] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, include: { employee: true } }),
    db.location.findUnique({ where: { id: v.locationId } }),
  ])
  if (!me?.isActive) return { ok: false, error: "Your account is disabled." }
  if (!me.employee || me.employee.deletedAt) return { ok: false, error: "Your login is not linked to an employee record. Ask HR to link it." }
  if (!loc || !loc.isActive) return { ok: false, error: "This location is no longer active." }

  // optional geofence: only when the location has coordinates
  if (loc.latitude != null && loc.longitude != null) {
    if (!geo) return { ok: false, error: "Location is required for this site. Allow location access and try again." }
    const d = distanceM(geo.lat, geo.lng, loc.latitude, loc.longitude)
    const allowed = loc.radiusM + Math.min(Math.max(geo.accuracy, 0), 50)
    if (d > allowed) return { ok: false, error: `You appear to be ${Math.round(d)} m from ${loc.name}. Move closer and try again.` }
  }

  const emp = me.employee
  const recent = await db.attendancePunch.findFirst({ where: { employeeId: emp.id, punchedAt: { gte: new Date(Date.now() - 60_000) } } })
  if (recent) return { ok: false, error: "You already punched a moment ago. Wait a minute before punching again." }

  const device = await qrDeviceFor(loc.id, loc.name)
  const now = new Date(Math.floor(Date.now() / 1000) * 1000)
  const pin = emp.zkPin ?? `QR-${emp.employeeNo}`
  await db.attendancePunch.create({ data: { deviceId: device.id, pin, punchedAt: now, type, employeeId: emp.id } })
  await db.device.update({ where: { id: device.id }, data: { lastSyncAt: now, status: "ONLINE" } })
  await rebuildDaily(emp.id, localDateKey(now))
  await audit(user.id, "qr-punch", "AttendancePunch", undefined, `${type} at ${loc.name}`)
  revalidatePath("/attendance")
  return { ok: true, type, at: now.toISOString(), location: loc.name }
}
