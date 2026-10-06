"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Bookmark, Download, Filter, Plus, Search, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MultiSelect, type Option } from "@/components/multi-select"
import { useQueryParams } from "@/lib/use-query-params"
import { ImportDialog } from "./import-dialog"

type Opts = { departments: Option[]; designations: Option[]; contractTypes: Option[]; statuses: Option[] }
type F = { dept: string[]; desig: string[]; contract: string[]; status: string[]; joinFrom: string; joinTo: string; rateMin: string; rateMax: string }
const KEYS = ["dept", "desig", "contract", "status", "joinFrom", "joinTo", "rateMin", "rateMax"] as const

const csv = (s: string | null) => (s ? s.split(",").filter(Boolean) : [])

export function Toolbar({ opts, canEdit, canExport }: { opts: Opts; canEdit: boolean; canExport: boolean }) {
  const { sp, set } = useQueryParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [views, setViews] = useState<{ name: string; qs: string }[]>([])

  const applied: F = useMemo(
    () => ({
      dept: csv(sp.get("dept")),
      desig: csv(sp.get("desig")),
      contract: csv(sp.get("contract")),
      status: csv(sp.get("status")),
      joinFrom: sp.get("joinFrom") ?? "",
      joinTo: sp.get("joinTo") ?? "",
      rateMin: sp.get("rateMin") ?? "",
      rateMax: sp.get("rateMax") ?? "",
    }),
    [sp],
  )
  const [draft, setDraft] = useState<F>(applied)

  // debounce search
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => set({ q: q || null }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViews(JSON.parse(localStorage.getItem("pd-emp-views") ?? "[]"))
    } catch {}
  }, [])

  const count = KEYS.filter((k) => (Array.isArray(applied[k]) ? (applied[k] as string[]).length : applied[k])).length
  const label = (o: Option[], id: string) => o.find((x) => x.value === id)?.label ?? id

  const chips: { k: string; text: string; clear: () => void }[] = []
  const addList = (k: "dept" | "desig" | "contract" | "status", name: string, o: Option[]) => {
    if (applied[k].length) chips.push({ k, text: `${name}: ${applied[k].map((id) => label(o, id)).join(", ")}`, clear: () => set({ [k]: null }) })
  }
  addList("dept", "Department", opts.departments)
  addList("desig", "Designation", opts.designations)
  addList("contract", "Contract", opts.contractTypes)
  addList("status", "Status", opts.statuses)
  if (applied.joinFrom || applied.joinTo)
    chips.push({ k: "join", text: `Joined: ${applied.joinFrom || "…"} – ${applied.joinTo || "…"}`, clear: () => set({ joinFrom: null, joinTo: null }) })
  if (applied.rateMin || applied.rateMax)
    chips.push({ k: "rate", text: `Rate: ${applied.rateMin || "0"} – ${applied.rateMax || "∞"}`, clear: () => set({ rateMin: null, rateMax: null }) })

  function apply() {
    set({
      dept: draft.dept.join(",") || null,
      desig: draft.desig.join(",") || null,
      contract: draft.contract.join(",") || null,
      status: draft.status.join(",") || null,
      joinFrom: draft.joinFrom || null,
      joinTo: draft.joinTo || null,
      rateMin: draft.rateMin || null,
      rateMax: draft.rateMax || null,
    })
  }
  function clearAll() {
    setQ("")
    set(Object.fromEntries([...KEYS, "q"].map((k) => [k, null])))
  }
  function persist(next: { name: string; qs: string }[]) {
    setViews(next)
    try {
      localStorage.setItem("pd-emp-views", JSON.stringify(next))
    } catch {}
  }
  function saveView() {
    const name = window.prompt("Name this view")
    if (!name) return
    persist([...views.filter((v) => v.name !== name), { name, qs: sp.toString() }])
  }

  const base = new URLSearchParams([...sp.entries()].filter(([k]) => k !== "page" && k !== "size"))
  const exportHref = (fmt: string) => {
    const p = new URLSearchParams(base)
    p.set("format", fmt)
    return `/employees/export?${p.toString()}`
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, phone or email" className="pl-8" aria-label="Search employees" />
        </div>
        <Button variant={count ? "secondary" : "outline"} onClick={() => {
            setDraft(applied)
            setOpen((o) => !o)
          }} aria-expanded={open}>
          <Filter /> Advanced filter
          {count > 0 && <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <Bookmark /> Views
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">None yet. Set filters, then save.</p>}
            {views.map((v) => (
              <DropdownMenuItem
                key={v.name}
                onClick={() => {
                  window.location.search = v.qs
                }}
              >
                <span className="flex-1 truncate">{v.name}</span>
                <span
                  role="button"
                  aria-label={`Delete view ${v.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    persist(views.filter((x) => x.name !== v.name))
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={saveView}>Save current filters as view…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload /> Import
          </Button>
        )}
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Current filtered result</DropdownMenuLabel>
              <DropdownMenuItem render={<a href={exportHref("xlsx")} />}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem render={<a href={exportHref("csv")} />}>CSV (.csv)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canEdit && (
          <Button render={<Link href="/employees/new" />}>
            <Plus /> Add employee
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <MultiSelect options={opts.departments} value={draft.dept} onChange={(v) => setDraft({ ...draft, dept: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <MultiSelect options={opts.designations} value={draft.desig} onChange={(v) => setDraft({ ...draft, desig: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contract</Label>
              <MultiSelect options={opts.contractTypes} value={draft.contract} onChange={(v) => setDraft({ ...draft, contract: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <MultiSelect options={opts.statuses} value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jf">Joined from</Label>
              <Input id="jf" type="date" value={draft.joinFrom} onChange={(e) => setDraft({ ...draft, joinFrom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jt">Joined to</Label>
              <Input id="jt" type="date" value={draft.joinTo} onChange={(e) => setDraft({ ...draft, joinTo: e.target.value })} />
            </div>
            {canEdit && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="rmin">Rate min</Label>
                  <Input id="rmin" type="number" min="0" value={draft.rateMin} onChange={(e) => setDraft({ ...draft, rateMin: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rmax">Rate max</Label>
                  <Input id="rmax" type="number" min="0" value={draft.rateMax} onChange={(e) => setDraft({ ...draft, rateMax: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
            <Button onClick={apply}>Apply filters</Button>
          </div>
        </div>
      )}

      {(chips.length > 0 || q) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button key={c.k} onClick={c.clear} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20">
              {c.text} <X className="size-3" />
            </button>
          ))}
          <button onClick={clearAll} className="px-1 text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        </div>
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
