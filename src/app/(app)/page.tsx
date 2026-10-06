import Link from "next/link"
import { db } from "@/lib/db"
import { atLeast, requireUser } from "@/lib/session"
import { fmtDate, localDateKey } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { PersonAvatar } from "@/components/avatar"

export const metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

function Stat({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  if (!atLeast(user.role, "MANAGER")) {
    return <PageHeader title={`Welcome, ${user.name}`} description="Your account does not have access to HR data yet. Ask an admin to change your role." />
  }
  const canEdit = atLeast(user.role, "HR")
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * 864e5)
  const ago30 = new Date(now.getTime() - 30 * 864e5)
  const today = new Date(localDateKey(now) + "T00:00:00.000Z")
  const live = { deletedAt: null }

  const [active, total, joiners, ending, presentToday, byDept, endingList, recent, unknownPunches] = await Promise.all([
    db.employee.count({ where: { ...live, status: { countsAsActive: true } } }),
    db.employee.count({ where: live }),
    db.employee.count({ where: { ...live, joiningDate: { gte: ago30 } } }),
    db.employee.count({ where: { ...live, status: { countsAsActive: true }, contractEnd: { gte: now, lte: in60 } } }),
    db.attendanceDaily.count({ where: { date: today } }),
    db.employee.groupBy({ by: ["departmentId"], where: { ...live, status: { countsAsActive: true } }, _count: true }),
    db.employee.findMany({ where: { ...live, status: { countsAsActive: true }, contractEnd: { gte: now, lte: in60 } }, orderBy: { contractEnd: "asc" }, take: 6, include: { designation: true } }),
    db.employee.findMany({ where: live, orderBy: { createdAt: "desc" }, take: 5, include: { department: true } }),
    db.attendancePunch.count({ where: { employeeId: null } }),
  ])
  const depts = await db.department.findMany({ where: { id: { in: byDept.map((d) => d.departmentId) } } })
  const rows = byDept.map((d) => ({ name: depts.find((x) => x.id === d.departmentId)?.name ?? "—", n: d._count })).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))

  return (
    <>
      <PageHeader title="Dashboard" description={`Hello, ${user.name.split(" ")[0]}. Here is where things stand today.`} />
      {sp.denied && <p className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">You do not have access to that page.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active headcount" value={active} sub={`${total} on record`} href="/employees" />
        <Stat label="Joined, last 30 days" value={joiners} href="/employees?sort=joiningDate&dir=desc" />
        <Stat label="Contracts ending, 60 days" value={ending} sub={ending ? "Review below" : "Nothing due"} />
        <Stat label="Present today" value={presentToday} sub={`of ${active} active`} href="/attendance?tab=daily" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Headcount by department</h2>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.name} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.n / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{r.n}</span>
              </li>
            ))}
            {rows.length === 0 && <li className="text-sm text-muted-foreground">No data yet.</li>}
          </ul>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Contracts ending soon</h2>
          <ul className="divide-y">
            {endingList.map((e) => {
              const days = Math.ceil((e.contractEnd!.getTime() - now.getTime()) / 864e5)
              return (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <PersonAvatar name={e.nameEn} url={e.photoUrl} />
                  <Link href={`/employees/${e.id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate font-medium">{e.nameEn}</span>
                    <span className="text-xs text-muted-foreground">{e.designation.name}</span>
                  </Link>
                  <span className="text-right text-xs">
                    {fmtDate(e.contractEnd)}
                    <span className={days <= 30 ? "block text-amber-600 dark:text-amber-400" : "block text-muted-foreground"}>in {days} days</span>
                  </span>
                </li>
              )
            })}
            {endingList.length === 0 && <li className="py-2 text-sm text-muted-foreground">No fixed-term contracts end in the next 60 days.</li>}
          </ul>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Recently added</h2>
          <ul className="divide-y">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <PersonAvatar name={e.nameEn} url={e.photoUrl} />
                <Link href={`/employees/${e.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{e.nameEn}</span>
                  <span className="text-xs text-muted-foreground">{e.department.name}</span>
                </Link>
                <span className="text-xs text-muted-foreground">{fmtDate(e.joiningDate)}</span>
              </li>
            ))}
          </ul>
        </section>

        {canEdit && unknownPunches > 0 && (
          <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <h2 className="text-sm font-semibold">Attendance needs attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {unknownPunches} punches came from PINs that are not assigned to an employee.{" "}
              <Link href="/attendance?tab=punches&unknown=1" className="text-primary hover:underline">
                Review them
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </>
  )
}
