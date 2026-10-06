"use client"

import { useState, useTransition } from "react"
import { Loader2, Pencil, Plug, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { deleteDevice, saveDevice, syncAll, syncOne, testDevice } from "./actions"

export type DeviceView = {
  id: string
  name: string
  model: string | null
  ip: string | null
  port: number
  serialNo: string | null
  mode: "MOCK" | "PULL" | "PUSH" | "QR"
  status: "ONLINE" | "OFFLINE"
  locationId: string | null
  lastSync: string
  todayPunches: number
  users: number
}

const MODE_LABEL = { MOCK: "Mock", PULL: "Pull (TCP)", PUSH: "Push (ADMS)", QR: "Phone QR" }

export function SyncAllButton() {
  const [pending, start] = useTransition()
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncAll()
          if (r.failed) toast.warning(`${r.inserted} new punches. ${r.failed} device(s) failed.`)
          else toast.success(`${r.inserted} new punches from ${r.devices} device(s)`)
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync all now
    </Button>
  )
}

export function DeviceCards({ devices, locations, canEdit, isAdmin }: { devices: DeviceView[]; locations: { id: string; name: string }[]; canEdit: boolean; isAdmin: boolean }) {
  const [edit, setEdit] = useState<DeviceView | "new" | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const cur = edit && edit !== "new" ? edit : null

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {devices.map((d) => (
          <div key={d.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {d.model ?? "ZKTeco"} {d.ip ? `· ${d.ip}:${d.port}` : ""}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "ONLINE" ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>
                <span className="size-1.5 rounded-full bg-current" />
                {d.status === "ONLINE" ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <div>
                <b className="block text-base text-foreground tabular-nums">{d.users}</b>users
              </div>
              <div>
                <b className="block text-base text-foreground tabular-nums">{d.todayPunches}</b>punches today
              </div>
              <div>
                <b className="block text-base text-foreground">{d.lastSync}</b>last sync
              </div>
              <div>
                <b className="block text-base text-foreground">{MODE_LABEL[d.mode]}</b>mode
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === d.id || d.mode === "PUSH" || d.mode === "QR"}
                  onClick={() =>
                    run(d.id, async () => {
                      const r = await syncOne(d.id)
                      if (r.ok) toast.success(`${r.inserted} new punches`)
                      else toast.error(r.message)
                    })
                  }
                >
                  {busy === d.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === d.id}
                  onClick={() =>
                    run(d.id, async () => {
                      const r = await testDevice(d.id)
                      if (r.ok) toast.success(r.message)
                      else toast.error(r.message)
                    })
                  }
                >
                  <Plug /> Test connection
                </Button>
                {isAdmin && (
                  <>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${d.name}`} onClick={() => { setErr(null); setEdit(d) }}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${d.name}`}
                      onClick={() => {
                        if (window.confirm(`Delete ${d.name} and its punches?`)) start(async () => { await deleteDevice(d.id); toast.success("Device deleted") })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            )}
            {d.mode === "PUSH" && (
              <p className="text-xs text-muted-foreground">
                Point the device server address to <span className="font-mono">/iclock/cdata</span> on this site. Serial: <span className="font-mono">{d.serialNo ?? "not set"}</span>
              </p>
            )}
          </div>
        ))}
        {isAdmin && (
          <button onClick={() => { setErr(null); setEdit("new") }} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/40">
            <Plus className="size-4" /> Add device
          </button>
        )}
      </div>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cur ? "Edit device" : "Add device"}</DialogTitle>
          </DialogHeader>
          <form
            key={cur?.id ?? "new"}
            action={(fd) =>
              start(async () => {
                const r = await saveDevice(cur?.id ?? null, fd)
                if (r.error) setErr(r.error)
                else {
                  setEdit(null)
                  toast.success("Device saved")
                }
              })
            }
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="d-name">Name</Label>
              <Input id="d-name" name="name" defaultValue={cur?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-model">Model</Label>
                <Input id="d-model" name="model" defaultValue={cur?.model ?? ""} placeholder="SpeedFace-V5L" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-serial">Serial number</Label>
                <Input id="d-serial" name="serialNo" defaultValue={cur?.serialNo ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-ip">IP address</Label>
                <Input id="d-ip" name="ip" defaultValue={cur?.ip ?? ""} placeholder="192.168.1.201" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-port">Port</Label>
                <Input id="d-port" name="port" type="number" defaultValue={cur?.port ?? 4370} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-mode">Mode</Label>
                <NativeSelect id="d-mode" name="mode" defaultValue={cur?.mode ?? "MOCK"}>
                  <option value="MOCK">Mock (test data)</option>
                  <option value="PULL">Pull (server connects)</option>
                  <option value="PUSH">Push (device sends)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-loc">Location</Label>
                <NativeSelect id="d-loc" name="locationId" defaultValue={cur?.locationId ?? ""}>
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
