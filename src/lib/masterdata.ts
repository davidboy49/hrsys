export type FieldDef = {
  name: string
  label: string
  type: "text" | "bool" | "date" | "time" | "number" | "select" | "relation"
  required?: boolean
  options?: { value: string; label: string }[]
  /** for relation fields: which entity supplies the options */
  of?: EntityKey
  /** show as a column in the table */
  column?: boolean
}

export type EntityKey = "departments" | "designations" | "contract-types" | "statuses" | "locations" | "shifts" | "holidays"

export type EntityDef = {
  key: EntityKey
  label: string
  singular: string
  model: "department" | "designation" | "contractType" | "employeeStatus" | "location" | "shift" | "holiday"
  hasEmployees: boolean
  fields: FieldDef[]
}

const BASIS = [
  { value: "MONTH", label: "Per month" },
  { value: "DAY", label: "Per day" },
  { value: "HOUR", label: "Per hour" },
]
const COLORS = ["green", "amber", "blue", "red", "gray"].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))

export const ENTITIES: EntityDef[] = [
  {
    key: "departments", label: "Departments", singular: "department", model: "department", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "parentId", label: "Parent department", type: "relation", of: "departments", column: true },
    ],
  },
  {
    key: "designations", label: "Designations", singular: "designation", model: "designation", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "departmentId", label: "Department", type: "relation", of: "departments", column: true },
    ],
  },
  {
    key: "contract-types", label: "Contract types", singular: "contract type", model: "contractType", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "requiresEndDate", label: "Requires end date", type: "bool", column: true },
      { name: "defaultRateBasis", label: "Default rate basis", type: "select", options: BASIS, required: true, column: true },
    ],
  },
  {
    key: "statuses", label: "Employee statuses", singular: "status", model: "employeeStatus", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "color", label: "Colour", type: "select", options: COLORS, required: true, column: true },
      { name: "countsAsActive", label: "Counts as active headcount", type: "bool", column: true },
    ],
  },
  {
    key: "locations", label: "Locations", singular: "location", model: "location", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "address", label: "Address", type: "text", column: true },
    ],
  },
  {
    key: "shifts", label: "Shifts", singular: "shift", model: "shift", hasEmployees: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "startTime", label: "Start", type: "time", required: true, column: true },
      { name: "endTime", label: "End", type: "time", required: true, column: true },
      { name: "graceMin", label: "Grace (minutes)", type: "number", required: true, column: true },
    ],
  },
  {
    key: "holidays", label: "Holidays", singular: "holiday", model: "holiday", hasEmployees: false,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, column: true },
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "date", label: "Date", type: "date", required: true, column: true },
    ],
  },
]

export const entityByKey = (k: string) => ENTITIES.find((e) => e.key === k)
