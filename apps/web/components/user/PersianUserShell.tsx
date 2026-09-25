"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleUserRound, Map, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTranslations } from "@/lib/i18n"
import { RoleChip } from "@/components/RoleChip"

const navItems = [
  { href: "/home", key: "home" as const, icon: Map },
  { href: "/progress", key: "progress" as const, icon: Sparkles },
  { href: "/profile", key: "profile" as const, icon: CircleUserRound },
]

export function PersianUserShell({
  children,
  title,
  showHeader = true,
}: {
  children: React.ReactNode
  title?: string
  showHeader?: boolean
}) {
  const pathname = usePathname()
  const t = getTranslations()

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {showHeader && (
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-primary">{t.appName}</p>
              {title && <h1 className="truncate text-base font-bold">{title}</h1>}
            </div>
            <RoleChip />
          </div>
        </header>
      )}

      <main className="safe-bottom mx-auto w-full max-w-3xl px-4 py-5">{children}</main>

      <nav aria-label="ناوبری اصلی" className="safe-nav fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-4px_20px_rgba(22,45,34,0.08)] backdrop-blur">
        <div className="mx-auto grid h-16 max-w-3xl grid-cols-3 px-3">
          {navItems.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || (href === "/home" && pathname.startsWith("/sessions"))
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.7 : 2} aria-hidden />
                <span>{t.nav[key]}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
