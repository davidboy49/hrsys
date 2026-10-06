"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { Maximize2, MapPin, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { getQrToken } from "./actions"

const REFRESH_MS = 15_000
const WINDOW_MS = 30_000

type Loc = { id: string; name: string; geofenced: boolean }

export function QrKiosk({ locations }: { locations: Loc[] }) {
  const [locId, setLocId] = useState(locations[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(WINDOW_MS / 1000)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const loc = locations.find((l) => l.id === locId)

  const refresh = useCallback(async () => {
    if (!locId || !canvas.current) return
    try {
      const token = await getQrToken(locId)
      const url = `${window.location.origin}/scan?t=${encodeURIComponent(token)}`
      await QRCode.toCanvas(canvas.current, url, { width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b2e2a", light: "#ffffff" } })
      setError(null)
      setLeft(REFRESH_MS / 1000)
    } catch {
      setError("Could not update the code. Check your connection.")
    }
  }, [locId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const t = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  if (locations.length === 0)
    return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Add a location in Masterdata first. Each location gets its own QR code.</p>

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <NativeSelect value={locId} onChange={(e) => setLocId(e.target.value)} aria-label="Location">
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </NativeSelect>
        <Button variant="outline" onClick={() => stage.current?.requestFullscreen?.().catch(() => {})} aria-label="Full screen">
          <Maximize2 /> Full screen
        </Button>
      </div>

      <div ref={stage} className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center fullscreen:justify-center fullscreen:bg-background">
        <p className="text-lg font-semibold">{loc?.name}</p>
        <div className="relative rounded-xl bg-white p-2 shadow-sm">
          <canvas ref={canvas} className="size-[min(72vw,360px)]" aria-label="Attendance QR code" />
        </div>
        <div className="w-full max-w-[360px] space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${(left / (REFRESH_MS / 1000)) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">New code in {left}s</p>
        </div>
        <p className="text-sm text-muted-foreground">Open the camera on your phone, scan, sign in, then tap Confirm.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 shrink-0" /> The code changes every 15 seconds, so a photo of it stops working within a minute.
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="size-3.5 shrink-0" />
          {loc?.geofenced ? "Phones must be near this location to punch." : "Distance check is off. Set latitude and longitude for this location in Masterdata to turn it on."}
        </li>
      </ul>
    </div>
  )
}
