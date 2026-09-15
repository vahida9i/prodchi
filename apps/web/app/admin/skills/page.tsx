"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SkillCategoryForm } from "@/components/admin/SkillCategoryForm"
import { api } from "@/lib/api-client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function AdminSkillsPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)

  const fetchData = useCallback(async () => {
    // Taxonomy lists come from the admin API - the page no longer hardcodes roles or
    // pretends to have no endpoints for categories/skills (spec Section 6.5).
    const [rolesRes, categoriesRes, skillsRes] = await Promise.all([
      api.getRoles(),
      api.getAdminSkillCategories(),
      api.getAdminSkills()
    ])
    setRoles(rolesRes.roles)
    setCategories(categoriesRes.categories)
    setSkills(skillsRes.skills)
  }, [])

  useEffect(() => {
    fetchData()
      .catch((err) => console.error('Failed to load admin data:', err))
      .finally(() => setLoading(false))
  }, [fetchData])

  const handleCategorySubmit = async (data: any) => {
    try {
      if (editingCategory) {
        await api.updateSkillCategory(editingCategory.id, data)
      } else {
        await api.createSkillCategory(data)
      }
      setShowCategoryDialog(false)
      setEditingCategory(null)
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to save category')
    }
  }

  const handleDeleteCategory = async (category: any) => {
    if (!confirm(`Delete skill category "${category.name}"?`)) return
    try {
      await api.deleteSkillCategory(category.id)
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete category')
    }
  }

  const handleDeleteSkill = async (skill: any) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return
    try {
      await api.deleteSkill(skill.id)
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete skill')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin: Skills</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Skill Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Skill Categories</h2>
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button>Add Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Edit' : 'Create'} Skill Category</DialogTitle>
                </DialogHeader>
                <SkillCategoryForm
                  onSubmit={handleCategorySubmit}
                  initialData={editingCategory}
                  roles={roles}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{roles.find(r => r.id === category.roleId)?.name || category.roleId}</TableCell>
                      <TableCell>{category.order}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingCategory(category)
                          setShowCategoryDialog(true)
                        }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteCategory(category)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Skills */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Skills</h2>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Unlock Threshold</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.map((skill) => (
                    <TableRow key={skill.id}>
                      <TableCell className="font-medium">{skill.name}</TableCell>
                      <TableCell>{categories.find(c => c.id === skill.skillCategoryId)?.name || skill.skillCategoryId}</TableCell>
                      <TableCell>{skill.order}</TableCell>
                      <TableCell>
                        {skill.unlockThreshold !== null ? (
                          <Badge variant="secondary">{skill.unlockThreshold}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Always unlocked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteSkill(skill)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}