import ExcelJS from "exceljs"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { toDate } from "@/lib/format"
import { nextEmployeeNo } from "@/lib/employees"

export const HEADERS = [
  "Employee ID",
  "Name (English)",
  "Name (Khmer)",
  "Gender",
  "Date of Birth",
  "Phone",
  "Email",
  "Department",
  "Designation",
  "Joining Date",
  "Contract",
  "Contract End",
  "Rate",
  "Rate Basis",
  "Currency",
  "Status",
  "ZK PIN",
] as const

const widths = [14, 24, 20, 10, 14, 16, 26, 18, 22, 14, 16, 14, 10, 11, 10, 14, 10]

type Emp = Prisma.EmployeeGetPayload<{ include: { department: true; designation: true; contractType: true; status: true } }>

const d = (v: Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "")

export function employeeRow(e: Emp): (string | number)[] {
  return [
    e.employeeNo,
    e.nameEn,
    e.nameKm ?? "",
    e.gender ?? "",
    d(e.dob),
    e.phone ?? "",
    e.email ?? "",
    e.department.name,
    e.designation.name,
    d(e.joiningDate),
    e.contractType.name,
    d(e.contractEnd),
    Number(e.rateAmount),
    e.rateBasis,
    e.currency,
    e.status.name,
    e.zkPin ?? "",
  ]
}

export async function buildWorkbook(rows: (string | number)[][], sheet = "Employees", note?: string[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheet, { views: [{ state: "frozen", ySplit: 1 }] })
  ws.addRow([...HEADERS])
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F1EE" } }
  ws.columns.forEach((c, i) => (c.width = widths[i]))
  for (const r of rows) ws.addRow(r)
  if (note) {
    const n = wb.addWorksheet("Instructions")
    n.getColumn(1).width = 100
    for (const line of note) n.addRow([line])
  }
  return wb
}

export const TEMPLATE_NOTES = [
  "Fill one employee per row on the Employees sheet. Do not rename or reorder the columns.",
  "Required: Name (English), Department, Designation, Joining Date, Contract, Rate, Status.",
  "Employee ID: leave blank to generate the next number automatically.",
  "Department, Designation, Contract and Status must match a name or code from Masterdata.",
  "Dates use yyyy-mm-dd (for example 2024-03-15).",
  "Gender: MALE, FEMALE or OTHER. Rate Basis: MONTH, DAY or HOUR (defaults to MONTH). Currency defaults to USD.",
  "Contract types that require an end date (for example Fixed term) need a Contract End.",
  "ZK PIN is the number the employee uses on the ZKTeco device. It must be unique.",
]

export type ImportIssue = { row: number; message: string }
export type ImportResult = { total: number; valid: number; created: number; issues: ImportIssue[] }

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object") {
    if ("text" in v) return String((v as { text: string }).text).trim()
    if ("result" in v) return String((v as { result: unknown }).result ?? "").trim()
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim()
  }
  return String(v).trim()
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

export async function runImport(buf: ArrayBuffer, commit: boolean): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.getWorksheet("Employees") ?? wb.worksheets[0]
  if (!ws) throw new Error("The file has no sheets.")
  if (ws.rowCount > 5001) throw new Error("The file has more than 5,000 rows. Split it into smaller files.")

  const head = HEADERS.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value))
  const bad = HEADERS.filter((h, i) => head[i].toLowerCase() !== h.toLowerCase())
  if (bad.length) throw new Error(`Columns do not match the template. Check: ${bad.join(", ")}. Download a fresh template.`)

  const [depts, desigs, cts, sts] = await Promise.all([
    db.department.findMany(),
    db.designation.findMany(),
    db.contractType.findMany(),
    db.employeeStatus.findMany(),
  ])
  const find = <T extends { id: string; name: string; code: string }>(list: T[], v: string) =>
    list.find((x) => x.name.toLowerCase() === v.toLowerCase() || x.code.toLowerCase() === v.toLowerCase())

  const existingNos = new Set((await db.employee.findMany({ select: { employeeNo: true } })).map((e) => e.employeeNo))
  const existingPins = new Set((await db.employee.findMany({ where: { zkPin: { not: null } }, select: { zkPin: true } })).map((e) => e.zkPin!))
  const seenNos = new Set<string>()
  const seenPins = new Set<string>()

  const issues: ImportIssue[] = []
  const good: Prisma.EmployeeUncheckedCreateInput[] = []
  let total = 0
  let seq: number | null = null
  let prefix = "EMP-"
  {
    const first = await nextEmployeeNo()
    const m = first.match(/^(.*?)(\d+)$/)
    if (m) {
      prefix = m[1]
      seq = parseInt(m[2], 10)
    }
  }

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const c = HEADERS.map((_, i) => cellText(row.getCell(i + 1).value))
    if (c.every((x) => !x)) continue
    total++
    const errs: string[] = []
    const [no, nameEn, nameKm, gender, dob, phone, email, dept, desig, joining, contract, cend, rate, basis, cur, status, pin] = c

    if (!nameEn) errs.push("Name (English) is required")
    const dp = find(depts, dept)
    if (!dp) errs.push(`Department "${dept}" not found`)
    const ds = find(desigs, desig)
    if (!ds) errs.push(`Designation "${desig}" not found`)
    const ct = find(cts, contract)
    if (!ct) errs.push(`Contract "${contract}" not found`)
    const st = find(sts, status)
    if (!st) errs.push(`Status "${status}" not found`)
    if (!isDate(joining)) errs.push("Joining Date must be yyyy-mm-dd")
    if (dob && !isDate(dob)) errs.push("Date of Birth must be yyyy-mm-dd")
    if (cend && !isDate(cend)) errs.push("Contract End must be yyyy-mm-dd")
    if (ct?.requiresEndDate && !cend) errs.push(`${ct.name} needs a Contract End`)
    const rateN = Number(rate)
    if (rate === "" || Number.isNaN(rateN) || rateN < 0) errs.push("Rate must be a number")
    const bs = (basis || "MONTH").toUpperCase()
    if (!["MONTH", "DAY", "HOUR"].includes(bs)) errs.push("Rate Basis must be MONTH, DAY or HOUR")
    const g = gender.toUpperCase()
    if (g && !["MALE", "FEMALE", "OTHER"].includes(g)) errs.push("Gender must be MALE, FEMALE or OTHER")
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.push("Email is not valid")

    let empNo = no
    if (empNo) {
      if (existingNos.has(empNo) || seenNos.has(empNo)) errs.push(`Employee ID ${empNo} already exists`)
    } else if (seq !== null) {
      do {
        empNo = `${prefix}${String(seq).padStart(4, "0")}`
        seq++
      } while (existingNos.has(empNo) || seenNos.has(empNo))
    }
    if (pin) {
      if (existingPins.has(pin) || seenPins.has(pin)) errs.push(`ZK PIN ${pin} already in use`)
    }

    if (errs.length) {
      issues.push({ row: r, message: errs.join("; ") })
      continue
    }
    seenNos.add(empNo)
    if (pin) seenPins.add(pin)
    good.push({
      employeeNo: empNo,
      nameEn,
      nameKm: nameKm || null,
      gender: (g || null) as "MALE" | "FEMALE" | "OTHER" | null,
      dob: toDate(dob),
      phone: phone || null,
      email: email || null,
      departmentId: dp!.id,
      designationId: ds!.id,
      contractTypeId: ct!.id,
      statusId: st!.id,
      joiningDate: toDate(joining)!,
      contractEnd: toDate(cend),
      rateAmount: rateN,
      rateBasis: bs as "MONTH" | "DAY" | "HOUR",
      currency: (cur || "USD").toUpperCase(),
      zkPin: pin || null,
    })
  }

  let created = 0
  if (commit && good.length && issues.length === 0) {
    await db.$transaction(async (tx) => {
      for (const g of good) {
        const e = await tx.employee.create({ data: g })
        await tx.rateHistory.create({ data: { employeeId: e.id, amount: g.rateAmount, basis: g.rateBasis!, currency: g.currency!, effectiveFrom: g.joiningDate as Date, changedBy: "import" } })
        created++
      }
    }, { timeout: 60000, maxWait: 10000 })
  }
  return { total, valid: good.length, created, issues }
}
