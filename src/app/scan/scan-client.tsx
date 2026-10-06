"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { punchByQr, type PunchResult } from "./actions"

type Geo = { lat: number; lng: number; accuracy: number }

function getPosition(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share location."))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "Location is blocked. Allow location for this site in your browser settings, then try again." : "Could not get your location. Try again outdoors or near a window.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    )
  })
}

export function ScanClient({ token, suggested, location, needsGeo }: { token: string; suggested: "IN" | "OUT"; location: string; needsGeo: boolean }) {
  const [type, setType] = useState<"IN" | "OUT">(suggested)
  const [result, setResult] = useState<PunchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()

  async function confirm() {
    setBusy(true)
    setResult(null)
    try {
      const geo = needsGeo ? await getPosition() : null
      start(async () => {
        setResult(await punchByQr(token, type, geo))
        setBusy(false)
      })
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message })
      setBusy(false)
    }
  }

  if (result?.ok)
    return (
      <div role="status" className="flex flex-col items-center gap-2 rounded-2xl border border-green-500/40 bg-green-500/10 p-8 text-center">
        <CheckCircle2 className="size-12 text-green-600 dark:text-green-400" />
        <p className="text-xl font-semibold">{result.type === "IN" ? "Checked in" : "Checked out"}</p>
        <p className="tabular-nums text-muted-foreground">
          {new Date(result.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" })} · {result.location}
        </p>
      </div>
    )

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div>
        <p className="text-sm text-muted-foreground">Location</p>
        <p className="flex items-center gap-1.5 font-medium">
          <MapPin className="size-4 text-primary" />
          {location}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Punch type">
        {(["IN", "OUT"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={cn("rounded-lg border px-3 py-3 text-sm font-medium transition-colors", type === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {t === "IN" ? "Check in" : "Check out"}
          </button>
        ))}
      </div>
      <Button size="lg" className="h-12 w-full text-base" onClick={confirm} disabled={busy || pending}>
        {(busy || pending) && <Loader2 className="animate-spin" />}
        Confirm {type === "IN" ? "check in" : "check out"}
      </Button>
      {needsGeo && <p className="text-xs text-muted-foreground">Your phone will ask to share its location. It is only used to confirm you are at this site.</p>}
      {result && !result.ok && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      )}
    </div>
  )
}
