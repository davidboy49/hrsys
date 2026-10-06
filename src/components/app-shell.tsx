"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useTheme } from "next-themes"
import { Clock, Database, LayoutDashboard, LogOut, Menu, Moon, Pin, PinOff, Settings, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { logout } from "@/app/login/actions"
import { initials } from "@/lib/format"
import { useT } from "@/i18n/provider"
import { LanguageSwitcher } from "@/components/language-switcher"
import { NotificationsBell } from "@/components/notifications-bell"

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
const PIN_COOKIE = "pd_sidebar"

function Brand({ company, compact }: { company: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Users className="size-4" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold" title={company}>
            {company}
          </span>
          <span className="block text-[11px] text-muted-foreground">PeopleDesk</span>
        </span>
      )}
    </div>
  )
}

function Nav({ role, onNavigate, compact }: { role: string; onNavigate?: () => void; compact?: boolean }) {
  const t = useT()
  const path = usePathname()
  const rank = RANK[role] ?? 0
  const items = NAV.filter((n) => !("min" in n) || rank >= n.min)
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map((n, i) =>
        "group" in n ? (
          compact ? (
            <span key={i} className="mx-2 my-2 border-t" />
          ) : (
            <p key={i} className="px-2 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t(n.group)}
            </p>
          )
        ) : (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            title={compact ? t(n.label) : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
              (n.href === "/" ? path === "/" : path.startsWith(n.href)) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
            )}
          >
            <n.icon className="size-4 shrink-0" />
            {!compact && t(n.label)}
          </Link>
        ),
      )}
    </nav>
  )
}

export function AppShell({ user, company, initialPinned, children }: { user: U; company: string; initialPinned: boolean; children: React.ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(initialPinned)
  const [hover, setHover] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const expanded = pinned || hover
  const canSeeAlerts = (RANK[user.role] ?? 0) >= 1

  function togglePin() {
    const next = !pinned
    setPinned(next)
    // remembered in a cookie so the server renders the right width on the next page load
    document.cookie = `${PIN_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar. Pinned: always open. Unpinned: a narrow icon rail that opens over the page on hover. */}
      <aside className={cn("relative hidden shrink-0 transition-[width] duration-200 md:block", pinned ? "w-60" : "w-16")}>
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocusCapture={() => setHover(true)}
          onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHover(false)}
          className={cn(
            "sticky top-0 z-30 flex h-svh flex-col overflow-hidden border-r bg-sidebar p-3 transition-[width,box-shadow] duration-200",
            expanded ? "w-60" : "w-16",
            !pinned && hover && "shadow-xl",
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-1 px-0.5">
            {user.role === "ADMIN" && expanded ? (
              <Link href="/settings?tab=company" className="min-w-0 rounded-lg hover:opacity-80" title={t("shell.editCompany")}>
                <Brand company={company} />
              </Link>
            ) : (
              <Brand company={company} compact={!expanded} />
            )}
            {expanded && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePin}
                aria-pressed={pinned}
                aria-label={pinned ? t("shell.unpin") : t("shell.pin")}
                title={pinned ? t("shell.unpin") : t("shell.pin")}
                className={cn(pinned && "text-primary")}
              >
                {pinned ? <Pin /> : <PinOff />}
              </Button>
            )}
          </div>
          <Nav role={user.role} compact={!expanded} />
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-3">
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <div className="mb-4 px-0.5">
            <Brand company={company} />
          </div>
          <Nav role={user.role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("nav.openMenu")}>
            <Menu />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          {canSeeAlerts && <NotificationsBell />}
          <Button variant="ghost" size="icon" aria-label={t("nav.toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{initials(user.name)}</span>
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
