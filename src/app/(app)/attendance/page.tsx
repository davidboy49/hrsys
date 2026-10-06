import Link from "next/link"
import { db } from "@/lib/db"
import { atLeast, requireRole } from "@/lib/session"
import { fmtDate, fmtDateTime, fmtTime, fromLocal, localDateKey } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DeviceCards, SyncAllButton, type DeviceView } from "./device-cards"

export const metadata = { title: "Attendance" }
export const dynamic = "force-dynamic"

type SP = { tab?: string; date?: string; unknown?: string }

const pill = (tone: "ok" | "warn" | "bad" | "mute", text: string) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
      tone === "ok" && "bg-green-500/15 text-green-700 dark:text-green-300",
      tone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      tone === "bad" && "bg-red-500/15 text-red-700 dark:text-red-300",
      tone === "mute" && "bg-muted text-muted-foreground",
    )}
  >
    <span className="size-1.5 rounded-full bg-current" />
    {text}
  </span>
)

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireRole("MANAGER")
  const sp = await searchParams
  const tab = sp.tab === "punches" || sp.tab === "daily" ? sp.tab : "devices"
  const canEdit = atLeast(user.role, "HR")
  const isAdmin = user.role === "ADMIN"
  const today = localDateKey(new Date())

  const tabs = [
    { id: "devices", label: "Devices and sync" },
    { id: "punches", label: "Punches" },
    { id: "daily", label: "Daily records" },
  ]

  return (
    <>
      <PageHeader
        title="Attendance"
        description="ZKTeco devices run in mock mode until a real device is connected."
        actions={canEdit && tab === "devices" ? <SyncAllButton /> : undefined}
      />
      <nav className="mb-5 flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/attendance?tab=${t.id}`}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "devices" && <Devices canEdit={canEdit} isAdmin={isAdmin} today={today} />}
      {tab === "punches" && <Punches onlyUnknown={sp.unknown === "1"} />}
      {tab === "daily" && <Daily date={sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today} />}
    </>
  )
}

async function Devices({ canEdit, isAdmin, today }: { canEdit: boolean; isAdmin: boolean; today: string }) {
  const start = fromLocal(today, "00:00")
  const [devices, locations, logs, userCounts, todayCounts] = await Promise.all([
    db.device.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 12, include: { device: true } }),
    db.employee.groupBy({ by: ["locationId"], where: { deletedAt: null, zkPin: { not: null } }, _count: true }),
    db.attendancePunch.groupBy({ by: ["deviceId"], where: { punchedAt: { gte: start } }, _count: true }),
  ])
  const view: DeviceView[] = devices.map((d) => ({
    id: d.id,
    name: d.name,
    model: d.model,
    ip: d.ip,
    port: d.port,
    serialNo: d.serialNo,
    mode: d.mode,
    status: d.status,
    locationId: d.locationId,
    lastSync: d.lastSyncAt ? fmtDateTime(d.lastSyncAt) : "Never",
    todayPunches: todayCounts.find((c) => c.deviceId === d.id)?._count ?? 0,
    users: userCounts.find((c) => c.locationId === d.locationId)?._count ?? 0,
  }))
  return (
    <div className="space-y-6">
      <DeviceCards devices={view} locations={locations.map((l) => ({ id: l.id, name: l.name }))} canEdit={canEdit} isAdmin={isAdmin} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Sync log</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="text-right">New records</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    No syncs yet. Press Sync all now.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular-nums">{fmtDateTime(l.startedAt)}</TableCell>
                  <TableCell>{l.device.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.records}</TableCell>
                  <TableCell>
                    {l.ok ? pill("ok", "Success") : pill("bad", "Failed")} {l.message && <span className="ml-1 text-xs text-muted-foreground">{l.message}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

async function Punches({ onlyUnknown }: { onlyUnknown: boolean }) {
  const rows = await db.attendancePunch.findMany({
    where: onlyUnknown ? { employeeId: null } : {},
    orderBy: { punchedAt: "desc" },
    take: 60,
    include: { device: true, employee: true },
  })
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <Link href="/attendance?tab=punches" className={cn("rounded-md px-2.5 py-1", !onlyUnknown ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
          All
        </Link>
        <Link href="/attendance?tab=punches&unknown=1" className={cn("rounded-md px-2.5 py-1", onlyUnknown ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
          Unknown PIN only
        </Link>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No punches to show.
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums">{fmtDateTime(p.punchedAt)}</TableCell>
                <TableCell className="font-mono">{p.pin}</TableCell>
                <TableCell>{p.employee ? <Link className="hover:underline" href={`/employees/${p.employee.id}`}>{p.employee.nameEn}</Link> : "—"}</TableCell>
                <TableCell>{p.device.name}</TableCell>
                <TableCell>{p.type === "IN" ? "Check in" : "Check out"}</TableCell>
                <TableCell>{p.employee ? pill("ok", "Matched") : pill("warn", "Unknown PIN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Showing the latest 60 punches. To fix an unknown PIN, set it on the employee profile, then press Sync all now to link the old punches.</p>
    </div>
  )
}

async function Daily({ date }: { date: string }) {
  const d = new Date(date + "T00:00:00.000Z")
  const [rows, total] = await Promise.all([
    db.attendanceDaily.findMany({ where: { date: d }, include: { employee: { include: { department: true } } }, orderBy: { employee: { employeeNo: "asc" } } }),
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: true } } }),
  ])
  const late = rows.filter((r) => r.state === "LATE").length
  const incomplete = rows.filter((r) => r.state === "INCOMPLETE").length
  const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10)
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/attendance?tab=daily&date=${prev}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
          ‹ Prev
        </Link>
        <span className="min-w-32 text-center text-sm font-medium">{fmtDate(d)}</span>
        <Link href={`/attendance?tab=daily&date=${next}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
          Next ›
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} present of {total} active · {late} late · {incomplete} missing check-out · {Math.max(0, total - rows.length)} no punch
        </span>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead className="text-right">Worked</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No records for this day. Sync the devices on the first tab.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/employees/${r.employeeId}`} className="hover:underline">
                    {r.employee.nameEn}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">{r.employee.employeeNo}</span>
                </TableCell>
                <TableCell>{r.employee.department.name}</TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.firstIn)}</TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.lastOut)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.workedMin ? `${Math.floor(r.workedMin / 60)}h ${r.workedMin % 60}m` : "—"}</TableCell>
                <TableCell>{r.state === "PRESENT" ? pill("ok", "Present") : r.state === "LATE" ? pill("warn", `Late ${r.lateMin}m`) : r.state === "INCOMPLETE" ? pill("bad", "No check-out") : pill("mute", "Absent")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
