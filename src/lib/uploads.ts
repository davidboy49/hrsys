import { put, del } from "@vercel/blob"
import fs from "node:fs/promises"
import path from "node:path"

export const MAX_PHOTO = 2 * 1024 * 1024
const OK = ["image/jpeg", "image/png", "image/webp"]

export async function savePhoto(file: File, key: string): Promise<string> {
  if (!OK.includes(file.type)) throw new Error("Photo must be a JPG, PNG or WebP image.")
  if (file.size > MAX_PHOTO) throw new Error("Photo must be 2 MB or smaller.")
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const name = `${key}-${Date.now()}.${ext}`
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`employees/${name}`, file, { access: "public", addRandomSuffix: false })
    return blob.url
  }
  if (process.env.VERCEL) throw new Error("Photo storage is not configured. Add a Vercel Blob store to the project.")
  const dir = path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()))
  return `/uploads/${name}`
}

export async function removePhoto(url: string | null | undefined) {
  if (!url) return
  try {
    if (url.startsWith("http")) await del(url)
    else await fs.unlink(path.join(process.cwd(), "public", url))
  } catch {}
}
