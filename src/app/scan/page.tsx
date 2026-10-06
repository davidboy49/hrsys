import Link from "next/link"
import { redirect } from "next/navigation"
import { QrCode, Users } from "lucide-react"
import { db } from "@/lib/db"
import { atLeast, getSession } from "@/lib/session"
import { verifyToken } from "@/lib/qr"
import { suggestedType } from "@/lib/qr-attendance"
import { fmtDateTime } from "@/lib/format"
import { logout } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { ScanClient } from "./scan-client"

export const metadata = { title: "Check in or out" }
export const dynamic = "force-dynamic"

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams
  const token = typeof sp.t === "string" ? sp.t : ""
  const user = await getSession()
  if (!user) redirect(`/login${token ? `?next=${encodeURIComponent(`/scan?t=${token}`)}` : "?next=/scan"}`)

  const me = await db.user.findUnique({ where: { id: user.id }, include: { employee: true } })
  const emp = me?.employee && !me.employee.deletedAt ? me.employee : null
  const check = token ? verifyToken(token) : null
  const loc = check?.ok ? await db.location.findUnique({ where: { id: check.locationId } }) : null

  const [recent, suggested] = emp
    ? await Promise.all([
        db.attendancePunch.findMany({ where: { employeeId: emp.id }, orderBy: { punchedAt: "desc" }, take: 6, include: { device: true } }),
        suggestedType(emp.id),
      ])
    : [[], "IN" as const]

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-5 p-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Users className="size-4" />
          </span>
          PeopleDesk
        </div>
        <div className="flex items-center gap-1">
          {atLeast(user.role, "MANAGER") && (
            <Button variant="ghost" size="sm" render={<Link href="/" />}>
              Dashboard
            </Button>
          )}
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section>
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <h1 className="text-xl font-semibold tracking-tight">{emp?.nameEn ?? user.name}</h1>
        {emp && <p className="text-sm text-muted-foreground">{emp.employeeNo}</p>}
      </section>

      {!emp ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          Your login is not linked to an employee record yet, so punches cannot be saved. Ask HR to link your account in Settings → Users and roles.
        </p>
      ) : token && check?.ok && loc ? (
        <ScanClient token={token} suggested={suggested} location={loc.name} needsGeo={loc.latitude != null} />
      ) : token ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {check && !check.ok && check.reason === "expired" ? "This QR code has expired. Scan the code on the screen again." : "This QR code is not valid. Scan the code on the office screen."}
        </p>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <QrCode className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>Scan the QR code on the office screen with your phone camera to check in or out.</p>
        </div>
      )}

      {emp && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Your recent punches</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {recent.length === 0 && <li className="p-3 text-muted-foreground">Nothing yet.</li>}
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium">{p.type === "IN" ? "Check in" : "Check out"}</span>
                  <span className="block text-xs text-muted-foreground">{p.device.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtDateTime(p.punchedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
