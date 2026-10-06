import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { QrKiosk } from "./kiosk"

export const metadata = { title: "QR attendance" }
export const dynamic = "force-dynamic"

export default async function QrPage() {
  await requireRole("HR")
  const locations = await db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, latitude: true } })
  return (
    <>
      <PageHeader title="QR attendance" description="Show this on a tablet or screen at the entrance. Employees scan it with their phone to check in or out." />
      <QrKiosk locations={locations.map((l) => ({ id: l.id, name: l.name, geofenced: l.latitude != null }))} />
    </>
  )
}
