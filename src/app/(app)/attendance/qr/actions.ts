"use server"

import { assertRole } from "@/lib/session"
import { makeToken } from "@/lib/qr"

/** Called by the office screen every few seconds to get the current rotating token. */
export async function getQrToken(locationId: string) {
  await assertRole("HR")
  return makeToken(locationId)
}
