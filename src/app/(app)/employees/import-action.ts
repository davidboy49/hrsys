"use server"

import { revalidatePath } from "next/cache"
import { assertRole } from "@/lib/session"
import { audit } from "@/lib/audit"
import { runImport, type ImportResult } from "@/lib/employee-io"

export async function importEmployees(form: FormData): Promise<ImportResult | { error: string }> {
  const user = await assertRole("HR")
  const file = form.get("file")
  const commit = form.get("commit") === "1"
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file first." }
  if (file.size > 4 * 1024 * 1024) return { error: "File is larger than 4 MB." }
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files are supported. Use the template." }
  try {
    const res = await runImport(await file.arrayBuffer(), commit)
    if (commit && res.created) {
      await audit(user.id, "import", "Employee", undefined, `${res.created} created`)
      revalidatePath("/employees")
    }
    return res
  } catch (e) {
    return { error: (e as Error).message }
  }
}
