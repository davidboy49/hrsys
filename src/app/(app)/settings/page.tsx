import Link from "next/link"
import { Download } from "lucide-react"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { fmtDateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { PasswordForm, SettingsForm, UsersPanel } from "./forms"

export const metadata = { title: "Settings" }
export const dynamic = "force-dynamic"

const TABS = [
  { id: "company", label: "Company" },
  { id: "users", label: "Users and roles", admin: true },
  { id: "attendance", label: "Attendance rules" },
  { id: "numbering", label: "Numbering" },
  { id: "templates", label: "Import templates" },
  { id: "audit", label: "Audit log", admin: true },
  { id: "account", label: "My account" },
]

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole("HR")
  const isAdmin = user.role === "ADMIN"
  const tabs = TABS.filter((t) => !t.admin || isAdmin)
  const sp = await searchParams
  const tab = tabs.find((t) => t.id === sp.tab)?.id ?? "company"

  const settings = Object.fromEntries((await db.setting.findMany()).map((s) => [s.key, s.value]))

  return (
    <>
      <PageHeader title="Settings" />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <Link key={t.id} href={`/settings?tab=${t.id}`} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "company" && (
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[
            { key: "company.name", label: "Company name" },
            { key: "company.currency", label: "Default currency", type: "currency", hint: "Pre-selected when adding an employee." },
          ]}
        />
      )}

      {tab === "users" && isAdmin && (
        <UsersPanel
          meId={user.id}
          employees={(await db.employee.findMany({ where: { deletedAt: null }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true, email: true } })).map((e) => ({
            id: e.id, label: `${e.employeeNo} · ${e.nameEn}`, name: e.nameEn, email: e.email ?? "",
          }))}
          users={(await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { employee: { select: { employeeNo: true, nameEn: true } } } })).map((u) => ({
            id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLogin: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never",
            employeeId: u.employeeId, employeeLabel: u.employee ? `${u.employee.employeeNo} · ${u.employee.nameEn}` : null,
          }))}
        />
      )}

      {tab === "attendance" && (
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[{ key: "attendance.lateGraceMin", label: "Default late grace (minutes)", type: "number", hint: "Each shift also has its own grace period in Masterdata, which takes priority." }]}
        />
      )}

      {tab === "numbering" && (
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[{ key: "employee.prefix", label: "Employee ID prefix", hint: "New employees are numbered PREFIX0001, PREFIX0002 and so on. Example: EMP-0042." }]}
        />
      )}

      {tab === "templates" && (
        <div className="max-w-xl space-y-3">
          <p className="text-sm text-muted-foreground">Download the Excel template for bulk employee import. It lists the column rules on its second sheet.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <Button variant="outline" render={<a href="/employees/template" />}>
            <Download /> Employee import template
          </Button>
        </div>
      )}

      {tab === "audit" && isAdmin && <Audit />}
      {tab === "account" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Signed in as <b className="text-foreground">{user.email}</b> ({user.role}).
          </p>
          <PasswordForm />
        </div>
      )}
    </>
  )
}

async function Audit() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: true } })
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap tabular-nums">{fmtDateTime(l.createdAt)}</TableCell>
              <TableCell>{l.user?.email ?? "system"}</TableCell>
              <TableCell>
                {l.action} <span className="text-muted-foreground">{l.entity}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">{l.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
