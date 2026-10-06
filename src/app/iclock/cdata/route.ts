import { db } from "@/lib/db"
import { ingestPunches } from "@/lib/attendance"
import { fromLocal } from "@/lib/format"
import type { RawPunch } from "@/lib/devices/types"

/**
 * ZKTeco "push" (ADMS) endpoint. A device configured with this server address posts attendance logs here.
 * Devices are matched by serial number (SN) against a device in PUSH mode.
 * Optional hardening: set ADMS_TOKEN and add ?token=... to the device's server path.
 */
export const dynamic = "force-dynamic"

function authorised(url: URL) {
  const t = process.env.ADMS_TOKEN
  return !t || url.searchParams.get("token") === t
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!authorised(url)) return new Response("Unauthorized", { status: 401 })
  const sn = url.searchParams.get("SN")
  // handshake: reply with the options the device expects
  return new Response(`GET OPTION FROM: ${sn}\nATTLOGStamp=None\nOPERLOGStamp=9999\nErrorDelay=60\nDelay=30\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=TransData AttLog\nRealtime=1\nEncrypt=0\n`, {
    headers: { "Content-Type": "text/plain" },
  })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  if (!authorised(url)) return new Response("Unauthorized", { status: 401 })
  const sn = url.searchParams.get("SN")
  const table = url.searchParams.get("table")
  if (!sn) return new Response("Missing SN", { status: 400 })
  const device = await db.device.findFirst({ where: { serialNo: sn, mode: "PUSH", isActive: true } })
  if (!device) return new Response("Unknown device", { status: 404 })

  const body = await req.text()
  if (table !== "ATTLOG") return new Response("OK")

  // each line: PIN \t yyyy-mm-dd hh:mm:ss \t status \t verify ...
  const punches: RawPunch[] = []
  for (const line of body.split(/\r?\n/)) {
    const c = line.split("\t")
    if (c.length < 2) continue
    const m = c[1].match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):(\d{2})/)
    if (!m) continue
    const status = Number(c[2] ?? 0)
    punches.push({ pin: c[0].trim(), punchedAt: new Date(fromLocal(m[1], m[2]).getTime() + Number(m[3]) * 1000), type: status === 1 || status === 5 ? "OUT" : "IN" })
  }
  const r = await ingestPunches(device.id, punches)
  await db.device.update({ where: { id: device.id }, data: { lastSyncAt: new Date(), status: "ONLINE" } })
  await db.syncLog.create({ data: { deviceId: device.id, records: r.inserted, ok: true, message: "push" } })
  return new Response(`OK: ${punches.length}`)
}
