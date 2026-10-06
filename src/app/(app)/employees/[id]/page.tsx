import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil } from "lucide-react"
import { db } from "@/lib/db"
import { atLeast, requireRole } from "@/lib/session"
import { fmtDate, fmtRate, fmtTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/avatar"
import { StatusBadge } from "@/components/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const dynamic = "force-dynamic"

function tenure(from: Date) {
  const months = Math.max(0, Math.floor((Date.now() - from.getTime()) / (30.44 * 864e5)))
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} yr` : "", m || !y ? `${m} mo` : ""].filter(Boolean).join(" ")
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || "—"}</dd>
    </div>
  )
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MANAGER")
  const { id } = await params
  const e = await db.employee.findFirst({
    where: { id, deletedAt: null },
    include: { department: true, designation: true, contractType: true, status: true, location: true, shift: true },
  })
  if (!e) notFound()
  const canEdit = atLeast(user.role, "HR")
  const [history, daily] = await Promise.all([
    canEdit ? db.rateHistory.findMany({ where: { employeeId: id }, orderBy: { effectiveFrom: "desc" }, take: 10 }) : Promise.resolve([]),
    db.attendanceDaily.findMany({ where: { employeeId: id }, orderBy: { date: "desc" }, take: 14 }),
  ])
  // eslint-disable-next-line react-hooks/purity
  const expiring = e.contractEnd && e.contractEnd.getTime() - Date.now() < 60 * 864e5

  return (
    <div className="max-w-5xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/employees" className="hover:underline">
          Employees
        </Link>{" "}
        › {e.employeeNo}
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <PersonAvatar name={e.nameEn} url={e.photoUrl} className="size-20 text-xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {e.nameEn} {e.nameKm && <span className="font-normal text-muted-foreground">· {e.nameKm}</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge name={e.status.name} color={e.status.color} />
            <span>
              {e.designation.name} · {e.department.name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {e.employeeNo} · Joined {fmtDate(e.joiningDate)} · {tenure(e.joiningDate)} with the company
          </p>
        </div>
        {canEdit && (
          <Button render={<Link href={`/employees/${e.id}/edit`} />}>
            <Pencil /> Edit
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Personal</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Item label="Gender">{e.gender ? e.gender[0] + e.gender.slice(1).toLowerCase() : ""}</Item>
            <Item label="Date of birth">{e.dob ? fmtDate(e.dob) : ""}</Item>
            <Item label="Phone">{e.phone}</Item>
            <Item label="Email">{e.email}</Item>
            <Item label="National ID">{e.nationalId}</Item>
            <Item label="Address">{e.address}</Item>
          </dl>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Job and contract</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Item label="Contract">{e.contractType.name}</Item>
            <Item label="Contract end">
              {e.contractEnd ? (
                <span className={expiring ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                  {fmtDate(e.contractEnd)}
                  {expiring ? " · ending soon" : ""}
                </span>
              ) : (
                ""
              )}
            </Item>
            {canEdit && <Item label="Rate">{fmtRate(e.rateAmount, e.rateBasis, e.currency)}</Item>}
            <Item label="Location">{e.location?.name}</Item>
            <Item label="Shift">{e.shift ? `${e.shift.name} (${e.shift.startTime}–${e.shift.endTime})` : ""}</Item>
            <Item label="ZKTeco PIN">
              <span className="font-mono">{e.zkPin}</span>
            </Item>
          </dl>
        </section>
      </div>

      {canEdit && history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Rate history</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{fmtDate(h.effectiveFrom)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtRate(h.amount, h.basis, h.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{h.changedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent attendance</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Worked</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No attendance yet. Records appear after a device sync.
                  </TableCell>
                </TableRow>
              )}
              {daily.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(d.firstIn)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(d.lastOut)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.workedMin ? `${Math.floor(d.workedMin / 60)}h ${d.workedMin % 60}m` : "—"}</TableCell>
                  <TableCell>{d.state === "LATE" ? `Late ${d.lateMin}m` : d.state[0] + d.state.slice(1).toLowerCase()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
