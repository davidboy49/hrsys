import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { ENTITIES, entityByKey } from "@/lib/masterdata"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { MasterTable, type MRow } from "./master-table"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const e = entityByKey((await params).entity)
  return { title: e ? e.label : "Masterdata" }
}

export default async function MasterdataPage({ params }: { params: Promise<{ entity: string }> }) {
  const user = await requireRole("HR")
  const { entity } = await params
  const ent = entityByKey(entity)
  if (!ent) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (db as any)[ent.model]
  const rows: Record<string, unknown>[] = await model.findMany({
    orderBy: ent.key === "holidays" ? { date: "asc" } : { name: "asc" },
    ...(ent.hasEmployees ? { include: { _count: { select: { employees: true } } } } : {}),
  })

  // options for relation fields
  const relOpts: Record<string, { value: string; label: string }[]> = {}
  for (const f of ent.fields) {
    if (f.type === "relation" && f.of) {
      const rel = entityByKey(f.of)!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: { id: string; name: string }[] = await (db as any)[rel.model].findMany({ orderBy: { name: "asc" } })
      relOpts[f.name] = list.map((x) => ({ value: x.id, label: x.name }))
    }
  }

  const data: MRow[] = rows.map((r) => {
    const values: Record<string, string | boolean> = {}
    const display: Record<string, string> = {}
    for (const f of ent.fields) {
      const raw = r[f.name]
      if (f.type === "bool") {
        values[f.name] = Boolean(raw)
        display[f.name] = raw ? "Yes" : "No"
      } else if (f.type === "date") {
        values[f.name] = raw ? new Date(raw as Date).toISOString().slice(0, 10) : ""
        display[f.name] = raw ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(raw as Date)) : "—"
      } else if (f.type === "relation") {
        values[f.name] = (raw as string | null) ?? ""
        display[f.name] = relOpts[f.name]?.find((o) => o.value === raw)?.label ?? "—"
      } else if (f.type === "select") {
        values[f.name] = String(raw ?? "")
        display[f.name] = f.options?.find((o) => o.value === raw)?.label ?? String(raw ?? "—")
      } else {
        values[f.name] = raw == null ? "" : String(raw)
        display[f.name] = raw == null || raw === "" ? "—" : String(raw)
      }
    }
    return {
      id: r.id as string,
      isActive: r.isActive as boolean,
      count: ent.hasEmployees ? ((r._count as { employees: number }).employees ?? 0) : null,
      values,
      display,
    }
  })

  return (
    <>
      <PageHeader title="Masterdata" description="Lookup lists used across the system. Items in use can be deactivated but not deleted." />
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Lists">
        {ENTITIES.map((e) => (
          <Link
            key={e.key}
            href={`/masterdata/${e.key}`}
            className={cn("rounded-full px-3 py-1 text-sm", e.key === ent.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {e.label}
          </Link>
        ))}
      </nav>
      <MasterTable
        key={ent.key}
        entityKey={ent.key}
        singular={ent.singular}
        fields={ent.fields}
        relOpts={relOpts}
        rows={data}
        showCount={ent.hasEmployees}
        isAdmin={user.role === "ADMIN"}
      />
    </>
  )
}
