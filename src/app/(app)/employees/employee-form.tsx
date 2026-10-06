"use client"

import Link from "next/link"
import { useActionState, useMemo, useState } from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { PersonAvatar } from "@/components/avatar"
import { saveEmployee, type FormState } from "./actions"

type Opt = { id: string; name: string; requiresEndDate?: boolean; defaultRateBasis?: string; departmentId?: string | null }

export type FormValues = {
  employeeNo: string
  nameEn: string
  nameKm: string
  gender: string
  dob: string
  phone: string
  email: string
  nationalId: string
  address: string
  departmentId: string
  designationId: string
  contractTypeId: string
  statusId: string
  locationId: string
  shiftId: string
  joiningDate: string
  contractEnd: string
  rateAmount: string
  rateBasis: string
  currency: string
  zkPin: string
  photoUrl: string | null
}

export function EmployeeForm({
  id,
  values,
  lookups,
}: {
  id: string | null
  values: FormValues
  lookups: { departments: Opt[]; designations: Opt[]; contractTypes: Opt[]; statuses: Opt[]; locations: Opt[]; shifts: Opt[] }
}) {
  const [state, action, pending] = useActionState(saveEmployee.bind(null, id), {} as FormState)
  const [v, setV] = useState(values)
  const [preview, setPreview] = useState<string | null>(values.photoUrl)
  const [removed, setRemoved] = useState(false)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const f = state.fields ?? {}
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }))

  const ct = lookups.contractTypes.find((c) => c.id === v.contractTypeId)
  const desigs = useMemo(
    () => (v.departmentId ? lookups.designations.filter((d) => !d.departmentId || d.departmentId === v.departmentId) : lookups.designations),
    [lookups.designations, v.departmentId],
  )

  const field = (k: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {input}
      {f[k] ? (
        <p className="text-xs text-destructive" role="alert">
          {f[k]}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )

  const text = (k: keyof FormValues, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={k} name={k} value={(v[k] as string) ?? ""} onChange={set(k)} aria-invalid={!!f[k]} {...props} />
  )
  const select = (k: keyof FormValues, opts: Opt[], blank?: string) => (
    <NativeSelect id={k} name={k} value={(v[k] as string) ?? ""} onChange={set(k)} aria-invalid={!!f[k]}>
      {(blank !== undefined || !v[k]) && <option value="">{blank ?? "Select…"}</option>}
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </NativeSelect>
  )

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="removePhoto" value={removed ? "1" : "0"} />

      <section className="flex flex-wrap items-center gap-5 rounded-lg border p-4">
        <PersonAvatar name={v.nameEn || "?"} url={removed ? null : preview} className="size-24 text-2xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" render={<label htmlFor="photo" className="cursor-pointer" />}>
              <Camera /> {preview && !removed ? "Replace photo" : "Upload photo"}
            </Button>
            {preview && !removed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRemoved(true)
                  const el = document.getElementById("photo") as HTMLInputElement
                  if (el) el.value = ""
                }}
              >
                <Trash2 /> Remove
              </Button>
            )}
          </div>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 2 * 1024 * 1024) {
                setFileErr("Photo must be 2 MB or smaller.")
                e.target.value = ""
                return
              }
              setFileErr(null)
              setRemoved(false)
              setPreview(URL.createObjectURL(file))
            }}
          />
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB. A square photo works best.</p>
          {fileErr && <p className="text-xs text-destructive">{fileErr}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Personal</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("nameEn", "Full name (English)", text("nameEn", { required: true }))}
          {field("nameKm", "Full name (Khmer)", text("nameKm", { lang: "km" }))}
          {field(
            "gender",
            "Gender",
            <NativeSelect id="gender" name="gender" value={v.gender} onChange={set("gender")}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </NativeSelect>,
          )}
          {field("dob", "Date of birth", text("dob", { type: "date" }))}
          {field("phone", "Phone", text("phone", { type: "tel" }))}
          {field("email", "Email", text("email", { type: "email" }))}
          {field("nationalId", "National ID", text("nationalId"))}
          <div className="sm:col-span-2">{field("address", "Address", text("address"))}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Job</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("employeeNo", "Employee ID", text("employeeNo", { required: true, className: "font-mono" }))}
          {field("departmentId", "Department", select("departmentId", lookups.departments))}
          {field("designationId", "Designation", select("designationId", desigs))}
          {field("statusId", "Status", select("statusId", lookups.statuses))}
          {field("joiningDate", "Joining date", text("joiningDate", { type: "date", required: true }))}
          {field("locationId", "Location", select("locationId", lookups.locations, "—"))}
          {field("shiftId", "Shift", select("shiftId", lookups.shifts, "—"))}
          {field("zkPin", "ZKTeco PIN", text("zkPin", { className: "font-mono" }), "The number this person enters on the attendance device.")}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Contract and rate</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field(
            "contractTypeId",
            "Contract type",
            <NativeSelect
              id="contractTypeId"
              name="contractTypeId"
              value={v.contractTypeId}
              aria-invalid={!!f.contractTypeId}
              onChange={(e) => {
                const c = lookups.contractTypes.find((x) => x.id === e.target.value)
                setV((s) => ({ ...s, contractTypeId: e.target.value, rateBasis: !id && c?.defaultRateBasis ? c.defaultRateBasis : s.rateBasis }))
              }}
            >
              <option value="">Select…</option>
              {lookups.contractTypes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>,
          )}
          {field("contractEnd", ct?.requiresEndDate ? "Contract end (required)" : "Contract end", text("contractEnd", { type: "date" }))}
          <div />
          {field("rateAmount", "Rate", text("rateAmount", { type: "number", step: "0.01", min: "0", required: true }))}
          {field(
            "rateBasis",
            "Rate basis",
            <NativeSelect id="rateBasis" name="rateBasis" value={v.rateBasis} onChange={set("rateBasis")}>
              <option value="MONTH">Per month</option>
              <option value="DAY">Per day</option>
              <option value="HOUR">Per hour</option>
            </NativeSelect>,
          )}
          {field(
            "currency",
            "Currency",
            <NativeSelect id="currency" name="currency" value={v.currency} onChange={set("currency")}>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </NativeSelect>,
            id ? "Changing the rate adds an entry to rate history." : undefined,
          )}
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button variant="outline" render={<Link href={id ? `/employees/${id}` : "/employees"} />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {id ? "Save changes" : "Create employee"}
        </Button>
      </div>
    </form>
  )
}
