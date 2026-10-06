import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { atLeast, getSession } from "@/lib/session"
import { buildPunchWhere, parsePunchFilters } from "@/lib/punches"
import { localDateKey } from "@/lib/format"
import { audit } from "@/lib/audit"

export const dynamic = "force-dynamic"

const HEAD = ["Date", "Time", "PIN", "Employee ID", "Employee", "Department", "Device", "Type", "Match"]
const MAX_ROWS = 50000

export async function GET(req: Request) {
  const user = await getSession()
  if (!user || !atLeast(user.role, "HR")) return new Response("Forbidden", { status: 403 })
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries())
  const rows = await db.attendancePunch.findMany({
    where: buildPunchWhere(parsePunchFilters(sp)),
    orderBy: { punchedAt: "desc" },
    take: MAX_ROWS,
    include: { device: true, employee: { include: { department: true } } },
  })
  const t = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16)
  const data = rows.map((p) => [
    localDateKey(p.punchedAt),
    t(p.punchedAt),
    p.pin,
    p.employee?.employeeNo ?? "",
    p.employee?.nameEn ?? "",
    p.employee?.department.name ?? "",
    p.device.name,
    p.type === "IN" ? "Check in" : "Check out",
    p.employee ? "Matched" : "Unknown PIN",
  ])
  const stamp = localDateKey(new Date())
  await audit(user.id, "export", "AttendancePunch", undefined, `${data.length} rows`)

  if (sp.format === "csv") {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const csv = "﻿" + [HEAD, ...data].map((r) => r.map(esc).join(",")).join("\r\n")
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="punches-${stamp}.csv"` } })
  }
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Punches", { views: [{ state: "frozen", ySplit: 1 }] })
  ws.addRow(HEAD)
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F1EE" } }
  ;[12, 8, 8, 14, 24, 18, 24, 11, 13].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  for (const r of data) ws.addRow(r)
  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="punches-${stamp}.xlsx"`,
    },
  })
}
