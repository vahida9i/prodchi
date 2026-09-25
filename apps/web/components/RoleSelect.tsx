"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { getTranslations } from "@/lib/i18n"

/**
 * The role-track selector: both seeded tracks as cards, the current one
 * pre-selected, submit via POST /auth/onboarding/role (first pick, switch, and
 * same-role no-op all land here). On success the candidate lands on /home,
 * which renders the path OF THE SELECTED TRACK — profile and progress follow
 * the same scoping, so switching is a full context switch, never a merge.
 */

// Keyed by name so a new seed role renders as soon as it exists (unknown roles
// fall back to the compass emoji and the generic line).
const ROLE_EMOJI: Record<string, string> = {
  'Product Design': '🎨',
  'Product Management': '📊'
}

const ROLE_DESCRIPTION: Record<string, string> = {
  'Product Design': 'User research, wireframing, visual design, usability testing...',
  'Product Management': 'Diagnosis, strategy, prioritization, roadmapping, measurement...'
}

const roleEmoji = (name: string) => ROLE_EMOJI[name] ?? '🧭'
const roleDescription = (name: string) => ROLE_DESCRIPTION[name] ?? 'Practice the decisions your role makes every day.'

export function RoleSelect({ currentRoleId = null }: { currentRoleId?: string | null }) {
  const router = useRouter()
  const t = getTranslations()
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  // The current track pre-selects its own card so "Continue" without a click
  // is a harmless no-op re-pick.
  const [selectedRole, setSelectedRole] = useState<string | null>(currentRoleId)
  const [isLoading, setIsLoading] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [error, setError] = useState('')

  // Roles are fixed seed data exposed by GET /api/v1/roles - never hardcode their
  // UUIDs on the client (spec Section 4).
  const fetchRoles = async () => {
    setRolesLoading(true)
    setError('')
    try {
      const data = await api.getRoles()
      setRoles(data.roles)
    } catch (err) {
      setError('Failed to load roles')
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  // Follow prop changes (the /role page resolves the current track async).
  useEffect(() => {
    if (currentRoleId) setSelectedRole(currentRoleId)
  }, [currentRoleId])

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError('Please select a role')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await api.setRole(selectedRole)
      // Home renders the selected track's path — that IS the "home of role".
      router.push("/home")
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to set role')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-center gap-3 text-sm text-destructive text-center">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchRoles} disabled={rolesLoading}>
            {rolesLoading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}
      {rolesLoading && roles.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center">Loading roles…</p>
      )}
      <div className="grid gap-4">
        {roles.map((role) => (
          <Button
            key={role.id}
            variant={selectedRole === role.id ? "default" : "outline"}
            className="h-24 w-full justify-start text-left rtl:text-right gap-4"
            onClick={() => setSelectedRole(role.id)}
          >
            <div className="text-4xl">{roleEmoji(role.name)}</div>
            <div>
              <p className="font-medium">
                {t.roles.byName[role.name as keyof typeof t.roles.byName]?.name ?? role.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.roles.byName[role.name as keyof typeof t.roles.byName]?.description ?? roleDescription(role.name)}
              </p>
            </div>
          </Button>
        ))}
      </div>
      <Button onClick={handleSubmit} disabled={isLoading || rolesLoading || !selectedRole} className="w-full">
        {isLoading ? t.auth.continue + '...' : t.auth.continue}
      </Button>
    </div>
  )
}