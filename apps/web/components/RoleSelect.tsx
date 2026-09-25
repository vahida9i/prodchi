"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Check, Cpu, Loader2, Palette, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { getTranslations } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type RoleMeta = { icon: typeof Palette; accent: string; soft: string; focus: string[]; promise: string }

const ROLE_META: Record<string, RoleMeta> = {
  "Product Design": {
    icon: Palette,
    accent: "text-violet-700",
    soft: "bg-violet-50 border-violet-200",
    focus: ["پژوهش کاربر", "تجربه کاربری", "طراحی و آزمون"],
    promise: "یاد می‌گیری مسئله‌ی درست را پیدا کنی و تجربه‌ای بسازی که واقعاً به کاربر کمک کند.",
  },
  "Product Management": {
    icon: BarChart3,
    accent: "text-sky-700",
    soft: "bg-sky-50 border-sky-200",
    focus: ["تشخیص مسئله", "اولویت‌بندی", "راهبرد و سنجه"],
    promise: "تمرین می‌کنی با داده و محدودیت‌های واقعی، تصمیم‌های محصولی دقیق‌تری بگیری.",
  },
  "Tech Lead": {
    icon: Cpu,
    accent: "text-emerald-700",
    soft: "bg-emerald-50 border-emerald-200",
    focus: ["معماری و ریسک", "مدیریت رخداد", "رشد تیم"],
    promise: "تصمیم می‌گیری چه زمانی عمیق شوی، چه چیزی را ساده نگه داری و چطور تیم را همراه کنی.",
  },
}

const fallbackMeta: RoleMeta = {
  icon: Sparkles,
  accent: "text-primary",
  soft: "bg-primary/5 border-primary/20",
  focus: ["حل مسئله", "تصمیم‌گیری", "یادگیری عملی"],
  promise: "با سناریوهای واقعی، مهارت‌های نقش خودت را قدم‌به‌قدم تمرین می‌کنی.",
}

const CONFETTI = [
  ["-160px", "540deg", "#28a66a"], ["-112px", "-420deg", "#f3b73f"], ["-64px", "620deg", "#7c5cff"],
  ["-18px", "-500deg", "#ef6a62"], ["34px", "470deg", "#2495c5"], ["82px", "-640deg", "#f3b73f"],
  ["132px", "570deg", "#28a66a"], ["178px", "-460deg", "#7c5cff"], ["-136px", "720deg", "#ef6a62"],
  ["106px", "-700deg", "#2495c5"], ["-86px", "430deg", "#f3b73f"], ["58px", "-540deg", "#28a66a"],
] as const

function CelebrationBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-live="polite">
      <span className="sr-only">مسیر شما آماده شد</span>
      {CONFETTI.map(([x, rotation, color], index) => (
        <span
          key={index}
          aria-hidden="true"
          className="celebration-confetti absolute right-1/2 top-[12%] h-3 w-2 rounded-sm"
          style={{ backgroundColor: color, animationDelay: `${index * 22}ms`, "--confetti-x": x, "--confetti-r": rotation } as CSSProperties}
        />
      ))}
    </div>
  )
}

export function RoleSelect({ currentRoleId = null }: { currentRoleId?: string | null }) {
  const router = useRouter()
  const t = getTranslations()
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(currentRoleId)
  const [isLoading, setIsLoading] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [error, setError] = useState("")
  const [celebrating, setCelebrating] = useState(false)

  const fetchRoles = async () => {
    setRolesLoading(true)
    setError("")
    try {
      const data = await api.getRoles()
      setRoles(data.roles)
    } catch {
      setError(t.auth.errorGeneral)
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => { fetchRoles() }, [])
  useEffect(() => { if (currentRoleId) setSelectedRole(currentRoleId) }, [currentRoleId])

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError("لطفاً یکی از مسیرها را انتخاب کنید")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      await api.setRole(selectedRole)
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reducedMotion) {
        router.push("/home")
        router.refresh()
      } else {
        setCelebrating(true)
        window.setTimeout(() => { router.push("/home"); router.refresh() }, 720)
      }
    } catch {
      setError(t.auth.errorGeneral)
    } finally {
      setIsLoading(false)
    }
  }

  const hasCurrentRole = Boolean(currentRoleId)
  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="micro-shake flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={fetchRoles} disabled={rolesLoading}>{rolesLoading ? "در حال تلاش…" : "تلاش دوباره"}</Button>
        </div>
      )}

      {rolesLoading && roles.length === 0 && !error ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" aria-hidden />در حال آماده‌سازی مسیرها…</div>
      ) : (
        <div className="space-y-3">
          {roles.map(role => {
            const meta = ROLE_META[role.name] ?? fallbackMeta
            const Icon = meta.icon
            const selected = selectedRole === role.id
            const title = t.roles.byName[role.name as keyof typeof t.roles.byName]?.name ?? t.profile.roleLabel
            const description = t.roles.byName[role.name as keyof typeof t.roles.byName]?.description ?? meta.promise
            return (
              <button
                key={role.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { setSelectedRole(role.id); setError("") }}
                className={cn(
                  "group relative w-full rounded-2xl border-2 bg-card p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
                  selected ? `${meta.soft} role-card-pop shadow-md ring-2 ring-primary/15` : "border-border hover:border-primary/30"
                )}
              >
                {selected && <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={16} strokeWidth={3} aria-hidden /></span>}
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background transition-transform duration-200 group-hover:scale-105", meta.accent, selected && "scale-110")}><Icon size={25} strokeWidth={2.2} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-extrabold">{title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
                  </span>
                </div>
                <span className="mt-3 flex flex-wrap gap-1.5 pr-[3.75rem]">
                  {meta.focus.map(item => <span key={item} className={cn("rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-semibold", selected ? meta.accent : "text-muted-foreground")}>{item}</span>)}
                </span>
                {selected && <span className="mt-3 block border-t border-current/10 pt-3 text-xs leading-5 text-foreground/70">{meta.promise}</span>}
              </button>
            )
          })}
        </div>
      )}

      <Button type="button" onClick={handleSubmit} disabled={isLoading || rolesLoading || !selectedRole} className="button-shine touch-target w-full gap-2 text-base font-bold shadow-sm">
        {isLoading ? <><Loader2 size={18} className="animate-spin" aria-hidden />در حال ساخت مسیر…</> : hasCurrentRole ? "تغییر نقش و دیدن مسیر" : "شروع مسیر من"}
      </Button>
      {celebrating && <CelebrationBurst />}
    </div>
  )
}
