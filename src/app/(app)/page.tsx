import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { atLeast, requireUser } from "@/lib/session"
import { loadDashboard, parsePeriod } from "@/lib/dashboard"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { DashboardView } from "./dashboard-view"

export const generateMetadata = titleOf("nav.dashboard")
export const dynamic = "force-dynamic"

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT()
  const user = await requireUser()
  const sp = await searchParams
  if (!atLeast(user.role, "MANAGER")) redirect("/scan")
  const canEdit = atLeast(user.role, "HR")

  const [data, unknownPunches] = await Promise.all([
    loadDashboard(parsePeriod(sp), canEdit),
    canEdit ? db.attendancePunch.count({ where: { employeeId: null } }) : Promise.resolve(0),
  ])

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("dash.hello", { name: user.name.split(" ")[0] })} />
      {sp.denied && <p className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{t("dash.denied")}</p>}
      {unknownPunches > 0 && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          <b className="text-foreground">{t("dash.attention")}.</b> {t("dash.unknownPins", { n: unknownPunches })}{" "}
          <Link href="/attendance?match=unknown" className="text-primary hover:underline">
            {t("dash.reviewThem")}
          </Link>
        </p>
      )}
      <DashboardView data={data} canEdit={canEdit} />
    </>
  )
}
