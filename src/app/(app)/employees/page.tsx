import { db } from "@/lib/db"
import { atLeast, requireRole } from "@/lib/session"
import { buildOrderBy, buildWhere, employeeInclude, lookups, parseFilters, SORTS, type SP } from "@/lib/employees"
import { fmtDate, fmtRate } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Toolbar } from "./toolbar"
import { EmployeeTable, type Row } from "./employee-table"

export const metadata = { title: "Employees" }
export const dynamic = "force-dynamic"

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireRole("MANAGER")
  const sp = await searchParams
  const f = parseFilters(sp)
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

  const size = [10, 25, 50, 100].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 25
  const sortKey = (SORTS as readonly string[]).includes(one(sp.sort)) ? one(sp.sort) : "employeeNo"
  const dir = one(sp.dir) === "desc" ? "desc" : "asc"
  const where = buildWhere(f)
  // one parallel round for everything that does not depend on the page number
  const [total, lk, activeCount, all] = await Promise.all([
    db.employee.count({ where }),
    lookups(),
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: true } } }),
    db.employee.count({ where: { deletedAt: null } }),
  ])
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.min(Math.max(1, parseInt(one(sp.page), 10) || 1), pages)
  const emps = await db.employee.findMany({ where, include: employeeInclude, orderBy: buildOrderBy(sortKey, dir), skip: (page - 1) * size, take: size })

  const canEdit = atLeast(user.role, "HR")
  const rows: Row[] = emps.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.nameEn,
    photoUrl: e.photoUrl,
    designation: e.designation.name,
    department: e.department.name,
    joining: fmtDate(e.joiningDate),
    contract: e.contractType.name,
    contractEnd: e.contractEnd ? fmtDate(e.contractEnd) : null,
    rate: canEdit ? fmtRate(e.rateAmount, e.rateBasis, e.currency) : "",
    statusName: e.status.name,
    statusColor: e.status.color,
  }))
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }))

  return (
    <>
      <PageHeader title="Employees" description={`${all} employees · ${activeCount} active`} />
      <div className="space-y-3">
        <Toolbar
          opts={{ departments: opt(lk.departments), designations: opt(lk.designations), contractTypes: opt(lk.contractTypes), statuses: opt(lk.statuses) }}
          canEdit={canEdit}
          canExport={canEdit}
        />
        <EmployeeTable rows={rows} total={total} page={page} size={size} sort={sortKey} dir={dir} canEdit={canEdit} showRate={canEdit} canExport={canEdit} />
      </div>
    </>
  )
}
