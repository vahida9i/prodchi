"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api-client"

export default function OnboardingPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setRoles([
          { id: 'product-design', name: 'Product Design' },
          { id: 'product-management', name: 'Product Management' }
        ])
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
                <div className="text-4xl">🎨</div>
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {role.id === 'product-design' 
                      ? 'User research, wireframing, visual design, usability testing...' 
                      : 'Product strategy, roadmapping, metrics, experimentation...'}
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