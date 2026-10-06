import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { lookups, nextEmployeeNo } from "@/lib/employees"
import { PageHeader } from "@/components/page-header"
import { EmployeeForm, type FormValues } from "../employee-form"

export const metadata = { title: "Add employee" }
export const dynamic = "force-dynamic"

export default async function NewEmployeePage() {
  await requireRole("HR")
  const [lk, no, cur] = await Promise.all([lookups(), nextEmployeeNo(), db.setting.findUnique({ where: { key: "company.currency" } })])
  const active = lk.statuses.find((s) => s.code === "ACTIVE") ?? lk.statuses[0]
  const values: FormValues = {
    employeeNo: no, nameEn: "", nameKm: "", gender: "", dob: "", phone: "", email: "", nationalId: "", address: "",
    departmentId: "", designationId: "", contractTypeId: "", statusId: active?.id ?? "", locationId: "", shiftId: "",
    joiningDate: new Date().toISOString().slice(0, 10), contractEnd: "", rateAmount: "", rateBasis: "MONTH", currency: cur?.value ?? "USD", zkPin: "", photoUrl: null,
  }
  return (
    <>
      <PageHeader title="Add employee" description="Fill in the details. You can change everything later." />
      <EmployeeForm id={null} values={values} lookups={lk} />
    </>
  )
}
