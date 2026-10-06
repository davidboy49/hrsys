import { getSession } from "@/lib/session"
import { readPhoto, s3Configured } from "@/lib/uploads"

/** Streams a private photo from the Neon bucket to signed-in users only. */
export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!s3Configured() || !key.startsWith("employees/") || key.includes("..")) return new Response("Not found", { status: 404 })
  try {
    const p = await readPhoto(key)
    return new Response(p.body, {
      headers: {
        "Content-Type": p.type,
        ...(p.length ? { "Content-Length": String(p.length) } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
