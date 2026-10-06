import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { getSession } from "@/lib/session"
import { LoginForm } from "./login-form"
import { LoginArt } from "./login-art"

export const metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  // already signed in (and still allowed in): skip the form
  if (await getSession()) redirect(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/")
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <LoginArt />
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Users className="size-4" />
            </span>
            PeopleDesk
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use the account your HR admin created for you.</p>
          </div>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </section>
    </main>
  )
}
