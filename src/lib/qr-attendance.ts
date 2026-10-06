import { db } from "@/lib/db"
import { fromLocal, localDateKey } from "@/lib/format"

/** Finds (or creates) the virtual device that stands for QR scans at a location. */
export async function qrDeviceFor(locationId: string, locationName: string) {
  const existing = await db.device.findFirst({ where: { mode: "QR", locationId } })
  if (existing) return existing
  return db.device.create({ data: { name: `QR · ${locationName}`, model: "Phone QR scan", mode: "QR", locationId, status: "ONLINE" } })
}

/** The type a new punch should have: the opposite of the employee's last punch today. */
export async function suggestedType(employeeId: string): Promise<"IN" | "OUT"> {
  const start = fromLocal(localDateKey(new Date()), "00:00")
  const last = await db.attendancePunch.findFirst({ where: { employeeId, punchedAt: { gte: start } }, orderBy: { punchedAt: "desc" }, select: { type: true } })
  return last?.type === "IN" ? "OUT" : "IN"
}

