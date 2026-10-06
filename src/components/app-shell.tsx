"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useTheme } from "next-themes"
import { Clock, Database, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { logout } from "@/app/login/actions"
import { initials } from "@/lib/format"
import { useT } from "@/i18n/provider"
import { LanguageSwitcher } from "@/components/language-switcher"

type U = { name: string; email: string; role: string }

const NAV = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard, min: 0 },
  { href: "/employees", label: "nav.employees", icon: Users, min: 1 },
  { href: "/attendance", label: "nav.attendance", icon: Clock, min: 1 },
  { group: "nav.admin" },
  { href: "/masterdata", label: "nav.masterdata", icon: Database, min: 2 },
  { href: "/settings", label: "nav.settings", icon: Settings, min: 2 },
] as const

const RANK: Record<string, number> = { EMPLOYEE: 0, MANAGER: 1, HR: 2, ADMIN: 3 }

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 pb-4 font-semibold">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Users className="size-4" />
      </span>
      PeopleDesk
    </div>
  )
}

function Nav({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const t = useT()
  const path = usePathname()
  const rank = RANK[role] ?? 0
  const items = NAV.filter((n) => !("min" in n) || rank >= n.min)
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map((n, i) =>
        "group" in n ? (
          <p key={i} className="px-2 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t(n.group)}
          </p>
        ) : (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
              (n.href === "/" ? path === "/" : path.startsWith(n.href)) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
            )}
          >
            <n.icon className="size-4" />
            {t(n.label)}
          </Link>
        ),
      )}
    </nav>
  )
}

export function AppShell({ user, children }: { user: U; children: React.ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <Brand />
        <Nav role={user.role} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-3">
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <Brand />
          <Nav role={user.role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("nav.openMenu")}>
            <Menu />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" aria-label={t("nav.toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{initials(user.name)}</span>
            <div className="hidden leading-tight sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{t(`role.${user.role}`)}</p>
            </div>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" aria-label={t("nav.signOut")}>
              <LogOut />
            </Button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
