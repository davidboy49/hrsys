import { Users } from "lucide-react"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-foreground text-primary">
            <Users className="size-4" />
          </span>
          PeopleDesk
        </div>
        <div className="space-y-3">
          <h1 className="max-w-[16ch] text-4xl font-semibold leading-tight">Everything about your people, in one place.</h1>
          <p className="text-sm opacity-80">Employees · Attendance · Masterdata</p>
        </div>
        <p className="text-xs opacity-70">Authorised users only. Activity is logged.</p>
      </section>
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
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
