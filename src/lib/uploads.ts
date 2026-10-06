import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import fs from "node:fs/promises"
import path from "node:path"

export const MAX_PHOTO = 2 * 1024 * 1024
const OK = ["image/jpeg", "image/png", "image/webp"]

/** Neon Object Storage bucket (S3-compatible, private). Name must match neon.ts. */
export const BUCKET = process.env.STORAGE_BUCKET ?? "uploads"

export const s3Configured = () => Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

let client: S3Client | null = null
function s3() {
  client ??= new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION ?? process.env.NEON_STORAGE_REGION ?? "us-east-1",
    forcePathStyle: true, // the bucket name travels in the path
  })
  return client
}

/**
 * Stores a photo and returns the reference saved on the employee:
 *   "s3:<key>"     in the Neon bucket (served by /api/photo, login required)
 *   "/uploads/..." on local disk (development only)
 */
export async function savePhoto(file: File, name: string): Promise<string> {
  if (!OK.includes(file.type)) throw new Error("Photo must be a JPG, PNG or WebP image.")
  if (file.size > MAX_PHOTO) throw new Error("Photo must be 2 MB or smaller.")
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const file_name = `${name}-${Date.now()}.${ext}`
  const body = Buffer.from(await file.arrayBuffer())

  if (s3Configured()) {
    const key = `employees/${file_name}`
    await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: file.type }))
    return `s3:${key}`
  }
  if (process.env.VERCEL) throw new Error("Photo storage is not configured. Add the Neon bucket variables (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) to the Vercel project.")
  const dir = path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, file_name), body)
  return `/uploads/${file_name}`
}

export async function removePhoto(ref: string | null | undefined) {
  if (!ref) return
  try {
    if (ref.startsWith("s3:")) await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: ref.slice(3) }))
    else if (ref.startsWith("/uploads/")) await fs.unlink(path.join(process.cwd(), "public", ref))
  } catch {}
}

export async function readPhoto(key: string) {
  const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return { body: r.Body!.transformToWebStream(), type: r.ContentType ?? "image/jpeg", length: r.ContentLength }
}
