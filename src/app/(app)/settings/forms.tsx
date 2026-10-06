"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { changeOwnPassword, createUser, saveSettings, updateUser } from "./actions"

export function SettingsForm({ values, fields, disabled }: { values: Record<string, string>; fields: { key: string; label: string; hint?: string; type?: string }[]; disabled: boolean }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="max-w-xl space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await saveSettings(fd)
          if (r.error) setErr(r.error)
          else {
            setErr(null)
            toast.success("Settings saved")
          }
        })
      }
    >
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.type === "currency" ? (
            <NativeSelect id={f.key} name={f.key} defaultValue={values[f.key] ?? "USD"} disabled={disabled}>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </NativeSelect>
          ) : (
            <Input id={f.key} name={f.key} type={f.type ?? "text"} defaultValue={values[f.key] ?? ""} disabled={disabled} />
          )}
          {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
        </div>
      ))}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {!disabled && (
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      )}
    </form>
  )
}

type U = { id: string; name: string; email: string; role: string; isActive: boolean; lastLogin: string }

export function UsersPanel({ users, meId }: { users: U[]; meId: string }) {
  const [open, setOpen] = useState(false)
  const [reset, setReset] = useState<U | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else toast.success(ok)
    })

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Admin: everything. HR: employees, rate, masterdata, attendance. Manager: read only, no rate.</p>
        <Button onClick={() => { setErr(null); setOpen(true) }}>
          <Plus /> Add user
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <span className="block font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    value={u.role}
                    disabled={u.id === meId || pending}
                    onChange={(e) => run(() => updateUser(u.id, { role: e.target.value as "ADMIN" | "HR" | "MANAGER" }), "Role updated")}
                    className="h-7 w-28"
                    aria-label={`Role for ${u.name}`}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="HR">HR</option>
                    <option value="MANAGER">Manager</option>
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.lastLogin}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setErr(null); setReset(u) }}>
                    Reset password
                  </Button>
                  {u.id !== meId && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateUser(u.id, { isActive: !u.isActive }), u.isActive ? "User disabled" : "User enabled")}>
                      {u.isActive ? "Disable" : "Enable"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await createUser(fd)
                if (r.error) setErr(r.error)
                else {
                  setOpen(false)
                  toast.success("User created")
                }
              })
            }
          >
            <div className="space-y-1.5"><Label htmlFor="u-name">Name</Label><Input id="u-name" name="name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-email">Email</Label><Input id="u-email" name="email" type="email" required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="u-role">Role</Label>
              <NativeSelect id="u-role" name="role" defaultValue="HR">
                <option value="ADMIN">Admin</option>
                <option value="HR">HR</option>
                <option value="MANAGER">Manager</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="u-pw">Temporary password</Label><Input id="u-pw" name="password" type="text" minLength={8} required /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>Create user</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reset !== null} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {reset?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await updateUser(reset!.id, { password: String(fd.get("password") ?? "") })
                if (r.error) setErr(r.error)
                else {
                  setReset(null)
                  toast.success("Password reset")
                }
              })
            }
          >
            <div className="space-y-1.5"><Label htmlFor="r-pw">New password</Label><Input id="r-pw" name="password" type="text" minLength={8} required /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReset(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>Reset</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PasswordForm() {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="max-w-sm space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await changeOwnPassword(fd)
          if (r.error) setErr(r.error)
          else {
            setErr(null)
            toast.success("Password changed")
          }
        })
      }
    >
      <div className="space-y-1.5"><Label htmlFor="p-cur">Current password</Label><Input id="p-cur" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="p-new">New password</Label><Input id="p-new" name="next" type="password" autoComplete="new-password" minLength={8} required /></div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={pending}>Change password</Button>
    </form>
  )
}
