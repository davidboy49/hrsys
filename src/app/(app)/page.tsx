import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { atLeast, requireUser } from "@/lib/session"
import { fmtDate, localDateKey } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { PersonAvatar } from "@/components/avatar"
import { getT, titleOf } from "@/i18n/server"

export const generateMetadata = titleOf("nav.dashboard")
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
  const t = await getT()
  const user = await requireUser()
  const sp = await searchParams
  if (!atLeast(user.role, "MANAGER")) redirect("/scan")
  const canEdit = atLeast(user.role, "HR")
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * 864e5)
  const ago30 = new Date(now.getTime() - 30 * 864e5)
  const today = new Date(localDateKey(now) + "T00:00:00.000Z")
  const live = { deletedAt: null }

  const [active, total, joiners, ending, presentToday, byDept, endingList, recent, unknownPunches, depts] = await Promise.all([
    db.employee.count({ where: { ...live, status: { countsAsActive: true } } }),
    db.employee.count({ where: live }),
    db.employee.count({ where: { ...live, joiningDate: { gte: ago30 } } }),
    db.employee.count({ where: { ...live, status: { countsAsActive: true }, contractEnd: { gte: now, lte: in60 } } }),
    db.attendanceDaily.count({ where: { date: today } }),
    db.employee.groupBy({ by: ["departmentId"], where: { ...live, status: { countsAsActive: true } }, _count: true }),
    db.employee.findMany({ where: { ...live, status: { countsAsActive: true }, contractEnd: { gte: now, lte: in60 } }, orderBy: { contractEnd: "asc" }, take: 6, include: { designation: true } }),
    db.employee.findMany({ where: live, orderBy: { createdAt: "desc" }, take: 5, include: { department: true } }),
    db.attendancePunch.count({ where: { employeeId: null } }),
    db.department.findMany({ select: { id: true, name: true } }),
  ])
  const rows = byDept.map((d) => ({ name: depts.find((x) => x.id === d.departmentId)?.name ?? "—", n: d._count })).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("dash.hello", { name: user.name.split(" ")[0] })} />
      {sp.denied && <p className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{t("dash.denied")}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("dash.active")} value={active} sub={t("dash.onRecord", { n: total })} href="/employees" />
        <Stat label={t("dash.joined")} value={joiners} href="/employees?sort=joiningDate&dir=desc" />
        <Stat label={t("dash.ending")} value={ending} sub={ending ? t("dash.reviewBelow") : t("dash.nothingDue")} />
        <Stat label={t("dash.present")} value={presentToday} sub={t("dash.ofActive", { n: active })} href="/attendance?tab=daily" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("dash.byDept")}</h2>
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
            {rows.length === 0 && <li className="text-sm text-muted-foreground">{t("common.noData")}</li>}
          </ul>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("dash.endingSoon")}</h2>
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
                    <span className={days <= 30 ? "block text-amber-600 dark:text-amber-400" : "block text-muted-foreground"}>{t("dash.inDays", { n: days })}</span>
                  </span>
                </li>
              )
            })}
            {endingList.length === 0 && <li className="py-2 text-sm text-muted-foreground">{t("dash.noEnding")}</li>}
          </ul>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("dash.recent")}</h2>
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
            <h2 className="text-sm font-semibold">{t("dash.attention")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dash.unknownPins", { n: unknownPunches })}{" "}
              <Link href="/attendance?match=unknown" className="text-primary hover:underline">
                {t("dash.reviewThem")}
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </>
  )
}
