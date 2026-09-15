"use client"

import { useEffect, useState } from "react"
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
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // We'll need to add API endpoints for these
        // For now, hardcode roles
        setRoles([
          { id: 'product-design', name: 'Product Design' },
          { id: 'product-management', name: 'Product Management' }
        ])
      } catch (err) {
        console.error('Failed to load admin data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCategorySubmit = async (data: any) => {
    try {
      if (editingCategory) {
        await api.updateSkillCategory(editingCategory.id, data)
      } else {
        await api.createSkillCategory(data)
      }
      setShowCategoryDialog(false)
      setEditingCategory(null)
      // Would refresh list here
    } catch (err: any) {
      alert(err.message || 'Failed to save category')
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
                        <Button variant="ghost" size="sm" className="text-destructive">
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
                        <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
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