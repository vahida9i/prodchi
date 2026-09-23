"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api-client"

// Roles are fixed seed data exposed by GET /api/v1/roles; the emoji and the
// one-line description are keyed by name so a new seed role renders as soon
// as it exists (unknown roles fall back to the compass emoji).
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

export default function OnboardingPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Roles are fixed seed data exposed by GET /api/v1/roles - never hardcode their
    // UUIDs on the client (spec Section 4).
    const fetchRoles = async () => {
      try {
        const data = await api.getRoles()
        setRoles(data.roles)
      } catch (err) {
        setError('Failed to load roles')
      }
    }
    fetchRoles()
  }, [])

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError('Please select a role')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await api.setRole(selectedRole)
      router.push("/home")
      router.refresh()
    } catch (err: any) {
      // The role track is one-time (spec Section 6.1): 409 means it is already set,
      // so send the user on rather than blocking them on the onboarding screen.
      if (err.status === 409) {
        router.push("/home")
        return
      }
      setError(err.message || 'Failed to set role')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Choose your role</CardTitle>
          <CardDescription className="text-center">
            This determines which skills and challenges you'll see. You can only choose once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive text-center">{error}</div>
          )}
          <div className="grid gap-4">
            {roles.map((role) => (
              <Button
                key={role.id}
                variant={selectedRole === role.id ? "default" : "outline"}
                className="h-24 w-full justify-start text-left gap-4"
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="text-4xl">{roleEmoji(role.name)}</div>
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleDescription(role.name)}
                  </p>
                </div>
              </Button>
            ))}
          </div>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedRole} className="w-full">
            {isLoading ? 'Saving...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}