import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/session"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [setting, jar] = await Promise.all([db.setting.findUnique({ where: { key: "company.name" } }), cookies()])
  const company = setting?.value?.trim() || "PeopleDesk"
  // pinned unless the person has switched it off
  const initialPinned = jar.get("pd_sidebar")?.value !== "0"
  return (
    <AppShell user={user} company={company} initialPinned={initialPinned}>
      {children}
    </AppShell>
  )
}
