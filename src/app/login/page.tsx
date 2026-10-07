import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { getSession } from "@/lib/session"
import { LoginForm } from "./login-form"
import { LoginArt } from "./login-art"
import { LanguageSwitcher } from "@/components/language-switcher"
import { getT } from "@/i18n/server"
import { getBranding } from "@/lib/branding"

export async function generateMetadata() {
  return { title: (await getT())("login.title") }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const t = await getT()
  const brand = await getBranding()
  // already signed in (and still allowed in): skip the form
  if (await getSession()) redirect(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/")
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <LoginArt company={brand.company} logoUrl={brand.logoUrl} />
      <section className="relative flex items-center justify-center p-6">
        <LanguageSwitcher className="absolute right-4 top-4" />
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 font-semibold lg:hidden">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border" />
            ) : (
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Users className="size-4" />
              </span>
            )}
            {brand.company}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{t("login.heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("login.sub")}</p>
          </div>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </section>
    </main>
  )
}
