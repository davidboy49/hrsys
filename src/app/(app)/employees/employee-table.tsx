"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { PersonAvatar } from "@/components/avatar"
import { StatusBadge } from "@/components/status-badge"
import { useQueryParams } from "@/lib/use-query-params"
import { deleteEmployees } from "./actions"

export type Row = {
  id: string
  employeeNo: string
  name: string
  photoUrl: string | null
  designation: string
  department: string
  joining: string
  contract: string
  contractEnd: string | null
  rate: string
  statusName: string
  statusColor: string
}

const COLS: { key: string; label: string; sort?: string; right?: boolean; rate?: boolean }[] = [
  { key: "employee", label: "Employee", sort: "nameEn" },
  { key: "designation", label: "Designation", sort: "designation" },
  { key: "department", label: "Department", sort: "department" },
  { key: "joining", label: "Joining date", sort: "joiningDate" },
  { key: "contract", label: "Contract", sort: "contract" },
  { key: "rate", label: "Rate", sort: "rateAmount", right: true, rate: true },
  { key: "status", label: "Status", sort: "status" },
]

export function EmployeeTable({
  rows,
  total,
  page,
  size,
  sort,
  dir,
  canEdit,
  showRate,
  canExport,
}: {
  rows: Row[]
  total: number
  page: number
  size: number
  sort: string
  dir: string
  canEdit: boolean
  showRate: boolean
  canExport: boolean
}) {
  const { set } = useQueryParams()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [pending, start] = useTransition()

  const pages = Math.max(1, Math.ceil(total / size))
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id))
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function sortBy(key: string) {
    if (sort === key) set({ sort: key, dir: dir === "asc" ? "desc" : "asc" }, false)
    else set({ sort: key, dir: "asc" }, false)
  }

  function doDelete() {
    const ids = confirm ?? []
    start(async () => {
      const r = await deleteEmployees(ids)
      toast.success(`${r.count} employee${r.count === 1 ? "" : "s"} deleted`)
      setSel(new Set())
      setConfirm(null)
    })
  }

  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)

  const pageNums: (number | "…")[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) pageNums.push(i)
    else if (pageNums[pageNums.length - 1] !== "…") pageNums.push("…")
  }

  const exportSel = () => {
    const p = new URLSearchParams()
    p.set("ids", [...sel].join(","))
    p.set("format", "xlsx")
    return `/employees/export?${p.toString()}`
  }

  return (
    <div className="rounded-lg border">
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} selected</span>
          {canExport && (
            <Button size="sm" variant="outline" render={<a href={exportSel()} />}>
              Export selected
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="destructive" onClick={() => setConfirm([...sel])}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
            <X /> Clear
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10">
              <Checkbox checked={allOn} onCheckedChange={(c) => setSel(c ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all on page" />
            </TableHead>
            <TableHead className="w-12 font-mono text-[11px] uppercase tracking-wide">No</TableHead>
            {COLS.filter((c) => showRate || !c.rate).map((c) => (
              <TableHead key={c.key} className={c.right ? "text-right" : undefined}>
                <button onClick={() => sortBy(c.sort!)} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide hover:text-foreground">
                  {c.label}
                  {sort === c.sort ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                </button>
              </TableHead>
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                No employees match these filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={r.id} data-state={sel.has(r.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
              </TableCell>
              <TableCell className="font-mono text-muted-foreground tabular-nums">{(page - 1) * size + i + 1}</TableCell>
              <TableCell>
                <Link href={`/employees/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                  <PersonAvatar name={r.name} url={r.photoUrl} />
                  <span className="leading-tight">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.employeeNo}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>{r.designation}</TableCell>
              <TableCell>{r.department}</TableCell>
              <TableCell className="whitespace-nowrap">{r.joining}</TableCell>
              <TableCell className="whitespace-nowrap">
                {r.contract}
                {r.contractEnd && <span className="text-muted-foreground"> · {r.contractEnd}</span>}
              </TableCell>
              {showRate && <TableCell className="whitespace-nowrap text-right tabular-nums">{r.rate}</TableCell>}
              <TableCell>
                <StatusBadge name={r.statusName} color={r.statusColor} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`} />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link href={`/employees/${r.id}`} />}>View</DropdownMenuItem>
                    {canEdit && <DropdownMenuItem render={<Link href={`/employees/${r.id}/edit`} />}>Edit</DropdownMenuItem>}
                    {canEdit && <DropdownMenuSeparator />}
                    {canEdit && (
                      <DropdownMenuItem variant="destructive" onClick={() => setConfirm([r.id])}>
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            Showing {from}–{to} of {total}
          </span>
          <label className="flex items-center gap-1.5">
            <span className="sr-only sm:not-sr-only">Per page</span>
            <NativeSelect value={size} onChange={(e) => set({ size: e.target.value })} className="h-7 w-[4.5rem]" aria-label="Rows per page">
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          {pageNums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1">
                …
              </span>
            ) : (
              <Button key={n} variant={n === page ? "default" : "outline"} size="icon-sm" onClick={() => set({ page: String(n) }, false)} aria-current={n === page ? "page" : undefined}>
                {n}
              </Button>
            ),
          )}
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </nav>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirm?.length === 1 ? "employee" : `${confirm?.length} employees`}?</DialogTitle>
            <DialogDescription>They are removed from lists and attendance matching. Records are kept in the database so history stays intact.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
