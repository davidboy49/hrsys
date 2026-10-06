"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { assertRole } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { nextEmployeeNo } from "@/lib/employees"
import { removePhoto, savePhoto } from "@/lib/uploads"
import { getT } from "@/i18n/server"

export type FormState = { error?: string; fields?: Record<string, string> }

const opt = (s: z.ZodString) => s.optional().or(z.literal("")).transform((v) => v || null)

const schema = z.object({
  employeeNo: z.string().trim().min(1, "err.employeeNoReq"),
  nameEn: z.string().trim().min(1, "err.nameReq"),
  nameKm: opt(z.string().trim()),
  gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).transform((v) => v || null),
  dob: opt(z.string()),
  phone: opt(z.string().trim()),
  email: z.string().trim().email("err.emailInvalid").optional().or(z.literal("")).transform((v) => v || null),
  nationalId: opt(z.string().trim()),
  address: opt(z.string().trim()),
  departmentId: z.string().min(1, "err.deptReq"),
  designationId: z.string().min(1, "err.desigReq"),
  contractTypeId: z.string().min(1, "err.contractReq"),
  statusId: z.string().min(1, "err.statusReq"),
  locationId: opt(z.string()),
  shiftId: opt(z.string()),
  joiningDate: z.string().min(1, "err.joiningReq"),
  contractEnd: opt(z.string()),
  rateAmount: z.coerce.number({ message: "err.rateNum" }).min(0, "err.rateNeg"),
  rateBasis: z.enum(["MONTH", "DAY", "HOUR"]),
  currency: z.string().min(3).max(3),
  zkPin: opt(z.string().trim()),
})

export async function saveEmployee(id: string | null, _: FormState, form: FormData): Promise<FormState> {
  const t = await getT()
  const user = await assertRole("HR")
  const raw = Object.fromEntries(form.entries()) as Record<string, string>
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= t(i.message)
    return { error: t("err.fixFields"), fields }
  }
  const d = parsed.data

  const ct = await db.contractType.findUnique({ where: { id: d.contractTypeId } })
  if (ct?.requiresEndDate && !d.contractEnd) return { error: t("err.fixFields"), fields: { contractEnd: t("err.needEnd", { v: ct.name }) } }

  const dupNo = await db.employee.findFirst({ where: { employeeNo: d.employeeNo, NOT: id ? { id } : undefined } })
  if (dupNo) return { error: t("err.fixFields"), fields: { employeeNo: t("err.dupId") } }
  if (d.zkPin) {
    const dupPin = await db.employee.findFirst({ where: { zkPin: d.zkPin, NOT: id ? { id } : undefined } })
    if (dupPin) return { error: t("err.fixFields"), fields: { zkPin: t("err.dupPin", { v: dupPin.nameEn }) } }
  }

  const photo = form.get("photo")
  const removeFlag = form.get("removePhoto") === "1"
  const prev = id ? await db.employee.findUnique({ where: { id } }) : null

  let photoUrl: string | null | undefined = undefined
  try {
    if (photo instanceof File && photo.size > 0) photoUrl = await savePhoto(photo, d.employeeNo.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    else if (removeFlag) photoUrl = null
  } catch (e) {
    return { error: t((e as Error).message) }
  }

  const data = {
    employeeNo: d.employeeNo,
    nameEn: d.nameEn,
    nameKm: d.nameKm,
    gender: d.gender,
    dob: toDate(d.dob),
    phone: d.phone,
    email: d.email,
    nationalId: d.nationalId,
    address: d.address,
    departmentId: d.departmentId,
    designationId: d.designationId,
    contractTypeId: d.contractTypeId,
    statusId: d.statusId,
    locationId: d.locationId,
    shiftId: d.shiftId,
    joiningDate: toDate(d.joiningDate)!,
    contractEnd: toDate(d.contractEnd),
    rateAmount: d.rateAmount,
    rateBasis: d.rateBasis,
    currency: d.currency.toUpperCase(),
    zkPin: d.zkPin,
    ...(photoUrl !== undefined ? { photoUrl } : {}),
  }

  let savedId = id
  if (id) {
    await db.employee.update({ where: { id }, data })
    const changed = prev && (Number(prev.rateAmount) !== d.rateAmount || prev.rateBasis !== d.rateBasis || prev.currency !== data.currency)
    if (changed) await db.rateHistory.create({ data: { employeeId: id, amount: d.rateAmount, basis: d.rateBasis, currency: data.currency, effectiveFrom: new Date(), changedBy: user.email } })
    if (photoUrl !== undefined) await removePhoto(prev?.photoUrl)
    await audit(user.id, "update", "Employee", id, d.nameEn)
  } else {
    const created = await db.employee.create({ data })
    savedId = created.id
    await db.rateHistory.create({ data: { employeeId: created.id, amount: d.rateAmount, basis: d.rateBasis, currency: data.currency, effectiveFrom: data.joiningDate, changedBy: user.email } })
    await audit(user.id, "create", "Employee", created.id, d.nameEn)
  }
  revalidatePath("/employees")
  redirect(`/employees/${savedId}`)
}

export async function deleteEmployees(ids: string[]) {
  const user = await assertRole("HR")
  if (!ids.length) return { count: 0 }
  const r = await db.employee.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: new Date(), zkPin: null } })
  await audit(user.id, "delete", "Employee", undefined, `${r.count} employee(s)`)
  revalidatePath("/employees")
  return { count: r.count }
}

export async function setStatus(ids: string[], statusId: string) {
  const user = await assertRole("HR")
  const r = await db.employee.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { statusId } })
  await audit(user.id, "status", "Employee", undefined, `${r.count} employee(s) -> ${statusId}`)
  revalidatePath("/employees")
  return { count: r.count }
}

export async function suggestEmployeeNo() {
  await assertRole("HR")
  return nextEmployeeNo()
}
